/**
 *
 * @fileoverview Register services that the frontend performs for the kernel.
 *
 */

goog.provide('colab.services');

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
 * @param {function(Object,  function(string))} callback the callback function
 *     to register.  This function should take two arguments, the first is the
 *     request message, and the second is a callback to call with the reply.
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
    colab.globalKernel.send_input_reply(
        /** @type {JsonObject } */ ({ 'error': err }));
    return;
  }
  listener(requestContent, goog.bind(colab.globalKernel.send_input_reply,
      colab.globalKernel));
};

