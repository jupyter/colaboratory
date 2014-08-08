/**
 *
 * @fileoverview Interface for with webview
 *
 * This provides a class for communication with a webview.  The
 * file colab/js/app.js contains the corresponding code that is run
 * in the webview to recieve these messages.
 */

var colab = colab || {};

/**
 * A wrapper around a webview that contains colab code.  The webview
 * should run the script colab/js/app.js at load time.  This will
 * set up the webview to listen for messages from this class.
 * @constructor
 * @param {Element} el The HTML element of the webview.
 * @param {string} url The url to load the webview from.
 * @param {Object=} opt_hashParams key-value pairs for hash params to
 *   pass to webview.
 */
colab.Webview = function(el, url, opt_hashParams) {
  var that = this;

  /**
   * @type {Element} 
   * @private
   */
  this.element_ = el;

  /**
   * @type {string}
   * @private
   */
  this.extensionOrigin_ = chrome.runtime.getURL('/').replace(/\/$/, '');

  /**
   * @type {boolean}
   * @private
   */
  this.loaded_ = false;

  /**
   * @type {Array.<Function>}
   * @private
   */
  this.onFirstLoadCallbacks_ = [];

  this.element_.addEventListener('loadstop', function() {
    if (!that.loaded_) {
      for (var i = 0; i < that.onFirstLoadCallbacks_.length; i++) {
        that.onFirstLoadCallbacks_[i]();
      }
      that.loaded_ = true;
    }
  });

  // Post a message that is used by the webview to determine
  // this window of this app, so that it can send messages the
  // other way.
  this.addFirstLoadListener(function() {
    that.postMessage('initialization');
  });

  var hashParams = opt_hashParams || {};
  hashParams['mode'] = 'app';
  hashParams['extensionOrigin'] = this.extensionOrigin_;

  var fullUrl = url + '#' + colab.params.encodeParamString(hashParams);
  this.element_.setAttribute('partition', 'frontend');
  this.element_.setAttribute('src', fullUrl);

};

/**
 * Adds a callback for when the webview loads for the first time.
 * If the webview has already loaded, the callback is executed
 * immediately.
 *
 * @param {Function} callback called with message type and content.
 */
colab.Webview.prototype.addFirstLoadListener = function(callback) {
  if (this.loaded_) {
    callback();
  } else {
    this.onFirstLoadCallbacks_.push(callback);
  }
};

/**
 * Adds a listener for a given message type from the webview.
 * Message types are user defined strings.
 * @param {string} messageType message type to listen for
 * @param {function{string, Object}} callback called with message type and content.
 */
colab.Webview.prototype.addMessageListener = function(messageType, callback) {
  var that = this;
  window.addEventListener('message', function(message) {
    if (message.source != that.element_.contentWindow ||
      message.origin != that.extensionOrigin_) {
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
 *
 * @param {string} messageType message type to listen for
 * @param {Object=} opt_content The data to send
 * NOTE: the corresponding code in app.js is not implemented yet
 * so this function does nothing.
 */
colab.Webview.prototype.postMessage = function(messageType, opt_content) {
  console.log('sending message of type: ' + messageType);
  this.element_.contentWindow.postMessage({
    'type': messageType,
    'content': opt_content
  }, this.extensionOrigin_);
}


/**
 * The scopes specified in the manifest.  Later versions of Chrome will
 * allow requesting specific scopes, rather than all scopes listed in the
 * manifest
 * @type {Array.<string>}
 */
colab.Webview.SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.install"
];

/**
 * Provides a service where a webview can request an OAuth token created
 * using the Identity API.  For security reasons, this webview must
 * have the same origin as this app.  This is only possible for
 * webviews created using the app resource URL.
 *
 * @param {boolean} onDemand Whether to make identity API requests
 *     and send tokens on demand, or make the request immediately.
 */
colab.Webview.prototype.provideIdentityApiAuth = function(onDemand) {
  var that = this;
  var obtainAndSendToken = function(interactive) {
    chrome.identity.getAuthToken(
      {interactive: interactive}, function(tokenString) {
      var token = null;
      if (tokenString) {
        token = {
          'access_token': tokenString,
          'scope': colab.Webview.SCOPES.join(' ')
        };
      }
      that.postMessage('access_token', token);
    });
  }

  if (onDemand) {
    // Listen for a 'access_token' message.  If such
    // a message is recieved, perform authorization using the
    // Idenity API, and send the OAuth token back to the webview.
    this.addMessageListener('access_token', function(msgType, content) {
      var interactive = !content['immediate'];
      obtainAndSendToken(interactive)
    });
  } else {
    // Obtain OAuth tokens from the Identity and send to the webview.
    this.addFirstLoadListener(function() {
      obtainAndSendToken(true);
    })
    
    // Periodically obtain fresh token and post to webview
    var tokenRefreshInterval = 10 * 60 * 1000;  // 10 minutes
    setInterval(function() {
      obtainAndSendToken(true);
    }, tokenRefreshInterval);
  }    
};