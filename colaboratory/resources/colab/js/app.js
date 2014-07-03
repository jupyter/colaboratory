/**
 *
 * @fileoverview Interface with parent app when in app mode.
 *
 * This provides utilities for communication between a webview,
 * and the Chrome App that created it.  It should not be used
 * when running as a webapp (except for colab.app.appMode to verify
 * that we are running as a webapp).  The Chrome App has a
 * corresponding file located at app/webview.js.
 *
 */

goog.provide('colab.app');

goog.require('colab.params');

/**
 * Whether this webpage is being run inside a webview in a Chrome App.
 * @type {boolean}
 */
colab.app.appMode = colab.params.getHashParams().mode === 'app';

/**
 * Origin of messages from the Chrome App
 * @type {string}
 * @private
 */
colab.app.extensionOrigin_ = colab.params.getHashParams().extensionOrigin;

/**
 * Registers a callback to be called whenever a message from the Chrome App
 * is recieved.  That function recieves the content of the message
 * (message.data) along with the metadata (source and origin).
 * @param {Function} callback
 */
colab.app.addChromeAppListener = function(callback) {
  window.addEventListener('message', function(message) {
    if (message.origin != colab.app.extensionOrigin_) {
      return;
    }
    callback(message.data, {source: message.source, origin: message.origin});
  });
};

/**
 * Promise that is fullfilled when the initialization message is sent
 * from the Chrome App.  The source of this message is the Chrome App
 * parent window, and this is needed to send messages to that window,
 * since there is no other way to get the parent window of the webview.
 * 
 * @type {goog.Promise}
 * @private
 */
colab.app.parentWindow_ = new goog.Promise(function(resolve, reject) {
  window.addEventListener('message', function(message) {
  	if (message.origin != colab.app.extensionOrigin_) {
  	  return;
  	}
  	resolve({'window': message.source});
  });
});

/**
 * Posts a message to the Chrome App window.  This message will be
 * cached until 
 * @param {Object} data Data to send
 * @param {function()=} opt_callback Callback when message is sent
 */
colab.app.postChromeAppMessage = function(data, opt_callback) {
  colab.app.parentWindow_.then(function(app_window) {
  	app_window['window'].postMessage(data, colab.app.extensionOrigin_);
  	if (opt_callback) {
  	  opt_callback();
  	}
  });
};

/**
 * Substitute for gapi.auth.authorize, that uses the Chrome Identity
 * API to do authorization, by passing a message to the parent window.
 * Note that the scope of the token provided will be determined by
 * the Chrome App, and cannot be specified as a parameter.  There is
 * currently no way in the Chrome Identity API to request a set of
 * scopes other than the full set of scopes granted to the App.
 *
 * @param {boolean} immediate  Whether to return immediately or show prompt
 * @param {function()=} opt_callback Callback when authorization is complete
 */
colab.app.authorize = function(immediate, opt_callback) {
  colab.app.postChromeAppMessage({
    'request_access_token': {'immediate': immediate}
  });
  colab.app.addChromeAppListener(function(data) {
  	if (data['token']) {
      gapi.auth.setToken({'access_token': data.token});
  	  if (opt_callback) {
        // TODO(kestert): figure out what callback should return.
  	  	opt_callback('success');
  	  }
    } else if (data['request_access_token_failed']) {
      if (opt_callback) {
        opt_callback();
      }
    }
  });
};