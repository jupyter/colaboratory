/**
 *
 * @fileoverview Interface for with webview
 *
 * This provides utilities for communication with a webview.  The
 * file colab/js/app.js contains the corresponding code that is run
 * in the webview to recieve these messages.
 */

var colab = colab || {};

colab.webview = {};

/**
 * The origin for this Chrome App's resources.
 * @type {string}
 * @private
 */
colab.webview.extensionOrigin_ = chrome.runtime.getURL('/').replace(/\/$/, '');

/**
 * Hash params (in format key=value&key=value, without any leading or
 * trailing &'s) that is used to indicate to the webview that it is
 * running in a webview and not as a regular webpage.
 */
colab.webview.hashParams = 'mode=app&extensionOrigin=' +
    encodeURIComponent(colab.webview.extensionOrigin_);


/**
 * Adds a listener for a given message type from the webview.
 * Message types are user defined strings.
 * @param {Window} contentWindow Content window of webview
 * @param {string} messageType message type to listen for
 * @param {function{string, Object}} callback called with message type and content.
 */
colab.webview.addMessageListener = function(contentWindow, messageType, callback) {
  window.addEventListener('message', function(message) {
    if (message.source != contentWindow ||
      message.origin != colab.webview.extensionOrigin_) {
      return;
    }

    if (message.data['type'] == messageType) {
       callback(messageType, message.data['content']);
    }
  });
}

/**
 * Posts a message of given type to the webview.
 * Message types are user defined strings.
 * @param {Window} contentWindow Content window of webview
 * @param {string} messageType message type to listen for
 * @param {Object=} opt_content The data to send
 * NOTE: the corresponding code in app.js is not implemented yet
 * so this function does nothing.
 */
colab.webview.postMessage = function(contentWindow, messageType, opt_content) {
  contentWindow.postMessage({
    'type': messageType,
    'content': opt_content
  }, colab.webview.extensionOrigin_);
}

/**
 * Sends initialization message, which allows the Chrome App to
 * send messages.
 */
colab.webview.sendInitializationMessaage = function(contentWindow) {
  contentWindow.postMessage('initialization_message',
    colab.webview.extensionOrigin_);
};

/**
 * Provides a service where a webview can request an OAuth token created
 * using the Identity API.  For security reasons, this webview must
 * have the same origin as this app.  This is only possible for
 * webviews created using the app resource URL.
 *
 * @param {Window} contentWindow the content window of the webview.
 * @param {boolean} onDemand Whether to make identity API requests
 *     and send tokens on demand, or make the request immediately.
 */
colab.webview.provideIdentitiyApiAuth = function(contentWindow, onDemand) {
  if (onDemand) {
    // Listen for a 'request_access_token' message.  If such
    // a message is recieved, perform authorization using the
    // Idenity API, and send the OAuth token back to the webview.
    colab.webview.addMessageListener(contentWindow, 'access_token', function(msgType, content) {
      var interactive = !content['immediate'];
      chrome.identity.getAuthToken({interactive: interactive}, function(token) {
        var reply = token ? {'token': token} : null;
        colab.webview.postMessage(contentWindow, 'access_token', reply);
      });
    });
  } else {
    // Obtain OAuth tokens from the Identity and send to the webview.
    chrome.identity.getAuthToken({interactive: true}, function(token) {
      console.log('recieved token ' + token);
      webview.contentWindow.postMessage({token: token}, extensionOrigin);
    });

    // Periodically obtain fresh token and post to webview
    setInterval(function() {
      chrome.identity.getAuthToken({interactive: true}, function(token) {
        console.log('recieved token ' + token);
        webview.contentWindow.postMessage({token: token}, extensionOrigin);
      });
    }, tokenRefreshInterval);
  }    
};