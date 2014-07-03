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
  	window.addEventListener('message', function(message) {
  	  if (message.source != contentWindow ||
  	  	message.origin != colab.webview.extensionOrigin_) {
  	  	return;
  	  }
  	  var request = message.data['request_access_token'];
  	  if (request) {
  	  	var interactive = !request['immediate'];
  	  	chrome.identity.getAuthToken({interactive: interactive}, function(token) {
  	  	  var reply = token ? {'token': token} : {'request_access_token_failed': true};
  	 	  contentWindow.postMessage(reply, colab.webview.extensionOrigin_);
  	  	});
  	  }
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