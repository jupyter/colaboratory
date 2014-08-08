/**
 *
 * @fileoverview Register services that the frontend performs for the kernel.
 *
 */

goog.provide('colab.services');

goog.require('colab.Global');
goog.require('goog.events');
goog.require('goog.ui.Dialog');


/**
 * Message metadata key for message type
 */
colab.services.REQUEST_TYPE_KEY = 'colabtools_input_request_type';


/**
 * Message metadata key for message content
 */
colab.services.REQUEST_JSON_KEY = 'colabtools_request_json';


/**
 * Callbacks for requests from kernel
 * @type {Object}
 * @private
 */
colab.services.kernelRequestCallbacks_ = {};


/**
 * Adds a listener for requests from drive
 * @param {string} requestType the type of request to register for
 * @param {function(Object,  function(*))} callback the callback
 *     function to register.  This function should take two arguments, the first
 *     is the request message, and the second is a callback to call with the
 *     reply.
 */
colab.services.setKernelRequestListener = function(requestType, callback) {
  colab.services.kernelRequestCallbacks_[requestType] = callback;
};


/**
 * Handles a request from the kernel.  This function is called when a
 * display_output that contains the correctly formatted metadata is recieved
 *
 * @param {Object} request The request, which is passed in as display_output
 *     metadata.
 */
colab.services.handleKernelRequest = function(request) {
  var requestType = request[colab.services.REQUEST_TYPE_KEY];
  var requestContent = JSON.parse(request[colab.services.REQUEST_JSON_KEY]);

  var listener = colab.services.kernelRequestCallbacks_[requestType];
  if (!listener) {
    // If no handler was specified, return with error message
    var err = {'type': 'NO_HANDLER_ERROR',
      'description': 'No handler was provided for the given request type'};
    colab.Global.getInstance().kernel.send_input_reply(
        /** @type {JsonObject } */ ({ 'error': err }));
    return;
  }
  listener(requestContent, goog.bind(
      colab.Global.getInstance().kernel.send_input_reply,
      colab.Global.getInstance().kernel));
};


/**
 * Handles request from kernel to display a dialog to the user
 * @param {{content: string, title:string}} params Dialog parameters
 * @param {function(boolean)} callback Callback with result
 * @private
 */
colab.services.dialogServiceCallback_ = function(params, callback) {
  var dialog = new goog.ui.Dialog();
  dialog.setDisposeOnHide(true);
  dialog.setContent(params['content']);
  dialog.setTitle(params['title']);

  dialog.setButtonSet(goog.ui.Dialog.ButtonSet.createYesNoCancel());

  goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, function(e) {
    var reply = e.key == goog.ui.Dialog.DefaultButtonKeys.YES;
    callback(reply);
  });

  dialog.setVisible(true);
};


/**
 * Provide a service that displays a dialog and returns the response
 */
colab.services.setKernelRequestListener('dialog',
    /** @type {function(Object, function(*))} */
    (colab.services.dialogServiceCallback_));
