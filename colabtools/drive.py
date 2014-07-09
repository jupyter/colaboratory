"""Library for accessing Google Drive APIs from inside the kernel.

This library provides tools to load and save data to Google Drive from inside
the IPython kernel.  It assumes the the front end passes in an OAuth token
before these funcitons are called
"""
import json
import time
from urllib import urlencode
import urllib2

import colabtools.message

oauth_token = None
expiration_time = 0

DATA_MIMETYPE = 'application/colaboratory.colabtools.data'

GOOGLE_API_URL = 'https://www.googleapis.com'

UPLOAD_BASE_URL = GOOGLE_API_URL + '/upload/drive/v2/files'
FILES_BASE_URL = GOOGLE_API_URL + '/drive/v2/files'
TOKEN_INFO_URL = GOOGLE_API_URL + '/oauth2/v1/tokeninfo'


def _ObtainOAuthToken(force_new_token=False):
  """Obtains an OAuth token (if the current token has expired).

  Args:
    force_new_token: If True, obtains a new token even if current token has not
    expired.

  Returns:
    True on success, False on failure.
  """

  global oauth_token
  global expiration_time

  # Exits early if token hasn't expired.
  if (not force_new_token) and oauth_token and time.time() < expiration_time:
    return True

  result = colabtools.message.BlockingRequest('get_access_token', '')
  if not isinstance(result, basestring):
    return False

  url = TOKEN_INFO_URL + '?access_token=' + result
  url_request = urllib2.urlopen(url)
  reply = json.loads(url_request.read())
  url_request.close()
  # TODO(kestert): validate token.
  oauth_token = result
  expiration_time = time.time() + reply['expires_in']
  return True


def _DoRequest(method, url, headers=None, data=None):
  """Execute an HTTP request, adding OAuth token to the list of headers.

  Args:
    method: HTTP method
    url: The URL
    headers: A list of key-value pairs
    data: A string containing the request body

  Returns:
    The HTTP response body
  """

  if headers is None:
    headers = []
  opener = urllib2.build_opener(urllib2.HTTPHandler)
  request = urllib2.Request(url, data=data)
  for header in headers:
    request.add_header(header[0], header[1])
  request.add_header('Authorization', 'Bearer ' + oauth_token)
  request.get_method = lambda: method
  return opener.open(request).read()


def _FindFile(filename):
  """Finds the unique file with the given name, and the mime type DATA_MIMETYPE.

  Args:
    filename: The filename to search for

  Returns:
    The fileId if a unique file with the given filename, and None otherwise.
  """

  query_string = 'title = "%s"' % filename
  url = FILES_BASE_URL + '?' + urlencode([('q', query_string)])
  result_string = _DoRequest('GET', url)

  file_list = json.loads(result_string)
  items = file_list['items']
  if len(items) != 1:
    return None
  file_id = items[0]['id']
  return file_id


def _UploadFile(data, file_id=None, mime_type=DATA_MIMETYPE):
  """Uploads a file with the given data to drive.

  If a file id is specified, uploads to the given file, otherwise creates a new
  file.

  Args:
    data: data to upload
    file_id: file ID of file on drive
    mime_type: mime type of uploaded file

  Returns:
    The file ID of the uploaded file
  """

  if file_id is None:
    method = 'POST'
    url = UPLOAD_BASE_URL + '?uploadType=media'
  else:
    method = 'PUT'
    url = UPLOAD_BASE_URL + '/' + file_id + '?uploadType=media'

  result_string = _DoRequest(method,
                             url,
                             headers=[('Content-Type', mime_type),
                                      ('Content-Length', len(data))],
                             data=data)
  file_metadata = json.loads(result_string)
  return file_metadata['id']

# Public methods


def FileExists(filename):
  """Checks with a unique data file with a given name exists.

  Args:
    filename: The file name to search for

  Returns:
    True if a unique data file with that name exists
  """

  if not _ObtainOAuthToken():
    return

  return _FindFile(filename) is not None


def LoadFile(filename):
  """Loads data from a data file with a given file name.

  Args:
    filename: The filename to load from.

  Returns:
    The content of the given file
  """

  if not _ObtainOAuthToken():
    return

  file_id = _FindFile(filename)
  url = FILES_BASE_URL + '/' + file_id
  result_string = _DoRequest('GET', url)

  file_metadata = json.loads(result_string)
  download_url = file_metadata['downloadUrl']
  return _DoRequest('GET', download_url)


def SaveFile(filename, data, overwrite_warning=True):
  """Saves the data to a data file with the given name.

  Overwrites any data file with that specified name (a data file is a file with
  the mime type DATA_MIMETYPE).

  Args:
    filename: The file name to save to
    data: The data to write
    overwrite_warning: Whether to display a warning dialog for overwrites
  """

  if not _ObtainOAuthToken():
    return

  file_id = _FindFile(filename)
  if file_id is None:
    # create new file
    file_id = _UploadFile(data)

    # Update its metadata
    _DoRequest('PATCH', FILES_BASE_URL + '/' + file_id,
               headers=[('Content-Type', 'application/json')],
               data=json.dumps({'title': filename}))
  else:
    # overwrite existing file, after prompting user
    message = 'Really overwrite file %s ?' % filename
    title = 'File Exists in Drive'
    if overwrite_warning:
      if not colabtools.message.DisplayDialog(message, title):
        return
    _UploadFile(data, file_id=file_id)
