"""Messaging interface for colab client.

This is the primary interface of how javascript can
communicate with kernel.  The individual outputs can post message
to a fronend, that will in turn will relay it to the handler.

Any previously executed cells can subscribe to listen for updates
coming from javascript and use it to update their state.
"""
import json
import sys

# Need to be able to write triple double quote in a docstring.
# pylint: disable=g-docstring-quotes


class Handler(object):
  """Base class to handle message passing."""

  def __init__(self):
    self.subscribers = {}

  def Subscribers(self, tag_id):
    """Returns true if given tag_id has subscriber."""
    return self.subscribers.get(tag_id, ())

  def Subscribe(self, tag_id, callback, clear_existing=False):

    """Registers given callback for given tag_id.

    Callback is called whenever a message with given tag_id is received.

    Args:
      tag_id: string
      callback: function that takes tag_id, data and origin_info
       json-like datastructure  (array, or dictionary)
      clear_existing: set to True if want to remove all existing
        listners. Use when given tag is meant for only one subscriber.
    """
    if tag_id not in self.subscribers or clear_existing:
      self.subscribers[tag_id] = []
    self.subscribers[tag_id].append(callback)

  def PostMessage(self, tag_id, json_data, origin_info=None):
    '''Posts message to all callbacks with givent tag_id.

    This function is meant to be used by frontend when proxying
    data from secure iframe into kernel.  For example:

    handler.PostMessage(tag, '"""'   + JSON.stringify(data) + '"""',
                 {'url': '....'})

    Note the tripple quotes, valid JSON cannot contain triple quotes,
    so this is a valid literal.

    Args:
      tag_id: string
      json_data: string containing valid json, provided by user.

      origin_info: a dictionary containing origin_info
         (filled by frontend)

    '''
    if origin_info is None:
      origin_info = {}
    data = json.loads(json_data)

    for callback in self.subscribers.get(tag_id, ()):
      # TODO(sandler): what if callback fails, should we still call all others?
      callback(tag_id, data, origin_info)


handler = Handler()


# Posts a user-level message to the kernel.
# Applications can subscribe to receive messages addressed to individual tag_ids
# pylint: disable = invalid-name
Post = handler.PostMessage
Subscribe = handler.Subscribe
# pylint: enable = invalid-name


def _BlockOnRawInputReplyZMQ():
  """Blocks until a message in the stdin channel is recieved.

  Returns:
    The value of the message, which is assumed to be of type raw_input_reply
  """

  # pylint: disable=g-import-not-at-top
  from IPython.kernel.zmq.kernelapp import IPKernelApp

  app = IPKernelApp.instance()
  kernel = app.kernel
  stdin_socket = kernel.stdin_socket
  while True:
    try:
      _, reply = kernel.session.recv(stdin_socket, 0)
    except Exception:
      # Handle invalid message
      pass
    except KeyboardInterrupt:
      # re-raise KeyboardInterrupt, to truncate traceback
      raise KeyboardInterrupt
    else:
      break
  try:
    value = reply['content']['value']
  except KeyError:
    # handle bad raw_input reply
    value = ''
  return value


def _BlockOnRawInputReplyPepper():
  """Blocks until a message in the stdin channel is recieved.

  For use while running the PNaCl/Pepper kernel.

  Returns:
    The value of the message, which is assumed to be of type raw_input_reply
  """

  # pylint: disable=g-import-not-at-top,protected-access,bare-except
  from pyppapi import nacl_instance
  raw_reply = nacl_instance.wait_for_message()
  try:
    reply = json.loads(raw_reply['json'])
    value = reply['content']['value']
  except:
    # handle bad raw_input reply
    value = raw_reply
  return value


def BlockingRequest(request_type, request=''):
  """Calls the front end with a request, and blocks until a reply is received.

  Args:
    request_type: type of request being made
    request: Jsonable object to send to front end as the request.

  Returns:
    Reply by front end (Json'able ojbect).
  """

  # pylint: disable=g-import-not-at-top
  from IPython import display
  display.display('', metadata={'colabtools_input_request_type': request_type,
                                'colabtools_request_json': json.dumps(request)})

  block_on_raw_input_reply = _BlockOnRawInputReplyZMQ
  # Detect if this is the PNaCl kernel, and use the alternate reply mechanism
  # if this is the case.  BlockOnRawInputReplyPepper_ is defined by the
  # Pepper kernel as a global variable.
  if 'pnacl' in sys.version:
    block_on_raw_input_reply = _BlockOnRawInputReplyPepper

  # Block on reply and return its value.
  return block_on_raw_input_reply()

def DisplayDialog(content, title):
  request = {'content': content, 'title': title}
  return BlockingRequest('dialog', request=request)
