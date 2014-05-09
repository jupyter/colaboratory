/**
 *
 * @fileoverview Interface with parent app when in app mode.
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
