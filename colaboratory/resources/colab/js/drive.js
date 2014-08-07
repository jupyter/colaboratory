/**
 *
 * @fileoverview Functions for dealing with Google Drive.
 *
 * TODO(colab-team): Move NotebookModel out of drive into notebookModel.js.
 *     Deal with circular dependencies.
 */

goog.provide('colab.drive');

goog.require('colab.drive.ApiWrapper');
goog.require('colab.error.GapiError');
goog.require('colab.nbformat');
goog.require('goog.array');
goog.require('goog.Uri');


/**
 * Name of newly created notebook files.
 * @type {string}
 */
colab.drive.NEW_NOTEBOOK_TITLE = 'Untitled';


/**
 * Extension for notebook files.
 * @type {string}
 */
colab.drive.NOTEBOOK_EXTENSION = 'ipynb';


/**
 * Mimetype of Colaboratory notebooks.
 * @type {string}
 */
colab.drive.NOTEBOOK_MIMETYPE = 'application/colab';


/**
 * Google Drive SDK app id.
 *
 * @type {string}
 */
colab.drive.APP_ID = '26410270374';


/**
 * Boundary for multipart uploads
 * @type {string}
 */
colab.drive.MULTIPART_BOUNDARY = '-------314159265358979323846';


/**
 * @type {?string}
 */
colab.drive.rootFolderId = null;


/**
 * Contains id of this user permission
 * @type {?string}
 */
colab.drive.userPermissionId = '';


colab.drive.ApiWrapper.getInstance().driveApiReady.then(function() {
  var request = gapi.client.drive.about.get();
  request.execute(function(resp) {
    colab.drive.rootFolderId = resp['rootFolderId'];
    colab.drive.userPermissionId = resp['user']['permissionId'];
  });
});


/**
 * Uploads a notebook to Drive, either creating a new one or saving an
 * existing one.
 *
 * @param {string} data The file contents as a string
 * @param {Object} metadata File metadata
 * @param {function(gapi.client.drive.files.Resource)} onSuccess callback for
 *     success
 * @param {function(?):?} onError callback for error, takes response object
 * @param {string=} opt_fileId file Id.  If false, a new file is created.
 * @param {Object?=} opt_params
 */
colab.drive.uploadToDrive = function(data, metadata, onSuccess, onError,
                                     opt_fileId, opt_params) {
  var params = opt_params || {};
  var delimiter = '\r\n--' + colab.drive.MULTIPART_BOUNDARY + '\r\n';
  var close_delim = '\r\n--' + colab.drive.MULTIPART_BOUNDARY + '--';
  var body = delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + colab.drive.NOTEBOOK_MIMETYPE + '\r\n' +
      '\r\n' +
      data +
      close_delim;

  var path = '/upload/drive/v2/files';
  var method = 'POST';
  if (opt_fileId) {
    path += '/' + opt_fileId;
    method = 'PUT';
  }

  colab.drive.ApiWrapper.getInstance().driveApiReady.then(function() {
    var request = gapi.client.request({
      'path': path,
      'method': method,
      'params': {'uploadType': 'multipart', 'pinned' : params['pinned']},
      'headers': {
        'Content-Type': 'multipart/mixed; boundary="' +
            colab.drive.MULTIPART_BOUNDARY + '"'
      },
      'body': body
    });
    request.execute(function(response) {
      if (!response || response['error']) {
        onError(new colab.error.GapiError(response ? response['error'] : null));
        return;
      }

      onSuccess(/** @type {gapi.client.drive.files.Resource} */ (response));
    });
  }, onError);
};


/**
 * Obtains the filename that should be used for a new file in a given folder.
 * This is the next file in the series Untitled0, Untitled1, ... in the given
 * drive folder.  As a fallback, returns Untitled.
 *
 * @param {function(string)} callback Called with the name for the new file.
 * @param {string=} opt_folderId optinal Drive folder Id to search for
 *     filenames.  Uses root, if none is specified.
 */
colab.drive.getNewFilename = function(callback, opt_folderId) {
  /** @type {string} */
  var folderId = opt_folderId || 'root';
  var query = 'title contains \'' + colab.drive.NEW_NOTEBOOK_TITLE + '\'' +
      ' and \'' + folderId + '\' in parents' +
      ' and trashed = false';
  var request = gapi.client.drive.files.list({
    'maxResults': 1000,
    'folderId' : folderId,
    'q': query
  });

  request.execute(function(response) {
    // Use 'Untitled.ipynb' as a fallback in case of error
    var fallbackFilename = colab.drive.NEW_NOTEBOOK_TITLE + '.' +
        colab.drive.NOTEBOOK_EXTENSION;
    if (!response || response['error']) {
      callback(fallbackFilename);
      return;
    }

    var files = response['items'] || [];
    var existingFilenames = goog.array.map(files, function(filesResource) {
      return filesResource['title'];
    });

    // Loop over file names Untitled0, ... , UntitledN where N is the number of
    // elements in existingFilenames.  Select the first file name that does not
    // belong to existingFilenames.  This is guaranteed to find a file name
    // that does not belong to existingFilenames, since there are N + 1 file
    // names tried, and existingFilenames contains N elements.
    for (var i = 0; i <= existingFilenames.length; i++) {
      /** @type {string} */
      var filename = colab.drive.NEW_NOTEBOOK_TITLE + i + '.' +
          colab.drive.NOTEBOOK_EXTENSION;
      if (existingFilenames.indexOf(filename) == -1) {
        callback(filename);
        return;
      }
    }

    // Control should not reach this point, so an error has occured
    callback(fallbackFilename);
  });
};


/**
 * Creates a new Notebook file in Drive, and calls either onSuccess, with
 * the fileId, or onError with an error.
 *
 * This function creates a file on Drive, but not a realtime document.
 * TODO(kestert): make this a valid notebook file, not an empty file.
 *
 * @param {function(Object)} onSuccess callback for success
 * @param {function(Object)} onError callback for error
 * @param {string=} opt_folderId optional Drive folder ID to create file in.
 */
colab.drive.createNewNotebook = function(onSuccess, onError, opt_folderId) {
  colab.drive.getNewFilename(function(newFilename) {
    var parents = [];
    if (opt_folderId) {
      parents.push({id: opt_folderId});
    }

    // String containing file contents for a new notebook.
    var data = colab.nbformat.createEmptyJsonNotebook(newFilename);

    var metadata = {
      'parents': parents,
      'title': newFilename,
      'description': 'IP[y] file',
      'mimeType': colab.drive.NOTEBOOK_MIMETYPE,
      'colabVersion': colab.nbformat.COLAB_VERSION
    };
    colab.drive.uploadToDrive(data, metadata, onSuccess, onError);
  }, opt_folderId);
};


/**
 * Creates a UUID (if the realtime doc doesn't have one already)
 * and saves this in the model and also the file.
 *
 * @param {gapi.drive.realtime.Model} model realtime model
 * @param {string} fileId the file Id for the drive file
 */
colab.drive.createModelUUID = function(model, fileId)  {
  if (!model.isReadOnly) {
    if (model.getRoot().get('metadata') == null) {
      model.getRoot().set('metadata', model.createMap());
    }
    var metadata = model.getRoot().get('metadata');
    if (metadata.get('UUID') == null) {
      metadata.set('UUID', (new Date()) + '');
    }
    var uuid = metadata.get('UUID');
    var request = gapi.client.drive.properties.insert({
      'fileId': fileId,
      'resource': {'key': 'UUID', 'value': uuid, 'visibility': 'PUBLIC'}
    });
    request.execute(function(response) {
      if (!response || response['error']) {
        console.log('Error saving UUID to file');
      }
    });
  }
};


/**
 * Checks that the UUID stored in the model is the same as the one on drive
 * @param {gapi.drive.realtime.Model} model realtime model
 * @param {string} fileId file Id of file on drive
 * @param {function(boolean)} onFoundUUIDs if both UUIDs are found, calls with
 *     boolean argument indicating whether they match or not.
 * @param {function((Object|string))} onError callback for no match
 */
colab.drive.checkModelUUID = function(model, fileId, onFoundUUIDs, onError) {
  var metadata = model.getRoot().get('metadata');
  var uuid = metadata && metadata.get('UUID');
  if (!uuid) {
    onError('Error getting document UUID');
    return;
  }

  var request = gapi.client.drive.properties.get({
    'fileId': fileId,
    'propertyKey': 'UUID',
    'visibility': 'PUBLIC'
  });
  request.execute(function(response) {
    if (!response || response['error']) {
      onError(new colab.error.GapiError(response ? response['error'] : null));
      return;
    }

    onFoundUUIDs(response.value == uuid);
  });
};


/**
 * Utility function to set https as the protocol for URLs that are missing
 * the protocol.  Otherwise, for the Chrome App, it will incorrectly
 * implicitly use the protocol 'chrome-extension'.
 * @param {string} url the URL to add the https protocol to.
 * @return {string} The modified URL
 */
colab.drive.urlWithHttpsProtocol = function(url) {
  return goog.Uri.parse(url).setScheme('https').toString();
};
