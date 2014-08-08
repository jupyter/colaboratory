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

goog.require('colab.notification');
goog.require('colab.params');
goog.require('goog.Promise');


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
 * NOTE: this function is deprecated, use addMessageListener for
 * new messages.
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
 * Registers a callback to be called whenever a message with the specified
 * type is recieved.  Message types are user defined strings.
 * @param {string} msgType message type to listen for
 * @param {function(string, Object)} callback
 */
colab.app.addMessageListener = function(msgType, callback) {
  window.addEventListener('message', function(message) {
    if (message.origin != colab.app.extensionOrigin_) {
      return;
    }

    if (message.data['type'] == msgType) {
      callback(msgType, message.data['content']);
    }
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
 * sent once the parent window is known.
 * @param {string} msgType message type.
 * @param {Object=} opt_content Data to send
 * @param {function()=} opt_callback Callback when message is sent
 */
colab.app.postMessage = function(msgType, opt_content, opt_callback) {
  colab.app.parentWindow_.then(function(app_window) {
    var message = {
      'type': msgType,
      'content': opt_content
    };
    app_window['window'].postMessage(message, colab.app.extensionOrigin_);
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
 * @param {Function=} opt_callback Callback when authorization is complete
 */
colab.app.authorize = function(immediate, opt_callback) {
  colab.app.postMessage('access_token', {'immediate': immediate});
  colab.app.addMessageListener('access_token', function(msgType, content) {
    // content == null is used to signal an error in authorization
    if (!content) {
      if (opt_callback) {
        opt_callback();
      }
      return;
    } else {
      gapi.auth.setToken(content);
      if (opt_callback) {
        // TODO(kestert): figure out which args to pass to callback.
        opt_callback('success');
      }
    }
  });
};


/**
 * Minimum version of Chrome that allows for mounting local directories in
 * PNaCl.
 * @type {string}
 */
colab.app.MOUNT_LOCAL_DIRECTORY_MIN_CHROME_VERSION = '38.0.2091.2';


/**
 * Check the Chrome browser version is greater than or equal to the specified
 * version, and display a warning if it is.
 *
 * @param {string} minVersion The minimum browser version required.
 * @return {boolean} True if the browser version was greater than or equal to
 *     the minimum required version.
 */
colab.app.checkVersionAndWarnUser = function(minVersion) {
  if (window.navigator.appVersion.match('Chrome\/(.*?) ')[1] < minVersion) {
    var message = ('This feature requires Chrome version ' + minVersion +
        ' or higher.');
    colab.notification.showPrimary(message);
    return false;
  }
  return true;
};
