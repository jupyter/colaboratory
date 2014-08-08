/**
 *
 * @fileoverview Singleton object to handle global Google API operations.
 *
 * This class handles authorization, and loading client libraries.  It provides
 * a global singleton object.
 *
 */

goog.provide('colab.drive.ApiWrapper');

goog.require('colab.app');
goog.require('colab.client_id');
goog.require('colab.error.GapiError');
goog.require('colab.params');
goog.require('colab.scope');
goog.require('goog.Promise');
goog.require('goog.events');
goog.require('goog.ui.Dialog');



/**
 * Handles Google API initialization and authorization.
 * @final @constructor
 */
colab.drive.ApiWrapper = function() {
  var that = this;

  /**
   * Use this until we implement saving into binary format, or else, we will
   * lose all existing content. After saving is implemented, switch to use
   * NEW_CLIENT_ID.
   *
   * @type {string}
   * @const
   */
  this.CLIENT_ID = colab.params.getHashParams().legacyClient ?
      colab.client_id.INSTALL_CLIENT_ID : colab.client_id.DRIVE_CLIENT_ID;



  /** @type {goog.promise.Resolver} */
  this.gapiLoad1 = goog.Promise.withResolver();

  /** @type {goog.Promise} */
  this.clientLoaded = new goog.Promise(function(resolve, reject) {
    that.gapiLoad1.promise.then(function() {
      gapi.load('auth:client,drive-realtime,drive-share', function() {
        if (!gapi.client || !gapi.auth) {
          // Assume that an error at this point is due to cookies being
          // disabled.  In this case , we dont fullfill promise (or reject), 
          // and instead show an error dialog.
          // TODO: change to rejecting the promise, once error handling
          // down the chain is set up properly.
          var dialog = new goog.ui.Dialog();
          dialog.setTitle('Error loading Google APIs');
          dialog.setContent('The Google APIs required by coLaboratory'
            + 'failed to load.  You must have cookies enabled to use'
            + 'coLaboratory.');
          dialog.setVisible(true);
          return;
        }
        resolve();
      });
    }, reject);
  });

  /**
   * Promise that is fullfilled when the google Drive API is loaded
   * @const {!goog.Promise}
   */
  this.apiLoaded = new goog.Promise(function(resolve, reject) {
    that.clientLoaded.then(function() {
      gapi.client.load('drive', 'v2', resolve);
    }, reject);
  });


  /**
   * A promise that is resolved when the Google Drive auth is done
   * @type {goog.Promise}
   */
  this.authorized = new goog.Promise(function(resolve, reject) {
    if (colab.app.appMode) {
      // In app mode, set auth token that is passed in by postMessage
      var receivedToken = false;
      colab.app.addMessageListener('access_token', function(msgType, content) {
        if (content) {
          gapi.auth.setToken(content);
          if (!receivedToken) {
            // TODO(kestert): Should this be reject?
            resolve(null);
            receivedToken = true;
          }
        }
      });
    } else {
      that.clientLoaded.then(function() {
        // In web mode, use standard OAuth flow.
        that.authorize(/**@type {function()} */ (resolve), reject);
        // Refresh OAuth token every 40 minutes.
        window.setInterval(function() {
          that.authorize(function() {}, function(reason) {
            console.log('failed to refresh OAuth token');
          });
        }, 40 * 60 * 1000);
      });
    }
  });

  /**
   * A promise that is resolved when both authorization and drive API loading
   * is complete.
   * @type {goog.Promise}
   */
  this.driveApiReady = goog.Promise.all([this.apiLoaded, this.authorized]);

  /**
   * @type {gapi.client.plus.PeopleGetResponse}
   */
  this.myInfo = null;

  this.clientLoaded.then(function() {
    gapi.client.load('plus', 'v1', function() {
      that.authorized.then(function() {
        var request = gapi.client.plus.people.get({
          'userId' : 'me'
        });
        request.execute(function(response) {
          that.myInfo =
              /** @type {gapi.client.plus.PeopleGetResponse} */ (response);
        });
      });
    });
  });
};
goog.addSingletonGetter(colab.drive.ApiWrapper);


/**
 * Callback for loading of the google client API script loaded as
 * a script tag in index.html.
 */
colab.drive.ApiWrapper.onClientLoad = function() {
  colab.drive.ApiWrapper.getInstance().gapiLoad1.resolve();
};


goog.exportSymbol('onClientLoad', colab.drive.ApiWrapper.onClientLoad);


/**
 * Authorize using Google OAuth API.
 *
 * @param {function()} onSuccess Callback for success
 * @param {function(colab.error.GapiError!)} onFailure Callback for success
 * @param {boolean=} opt_withPopup If true, display popup without first trying
 *     to authorize without a popup.
 */
colab.drive.ApiWrapper.prototype.authorize = function(onSuccess, onFailure,
    opt_withPopup) {
  var that = this;
  var doAuthorize = function() {
    gapi.auth.authorize({
      'client_id': that.CLIENT_ID,
      'scope': ['email', colab.scope.FILE_SCOPE],
      'immediate': !opt_withPopup
    }, function(response) {
      var error = colab.error.GapiError.fromResponse(response);
      if (error) {
        if (opt_withPopup) {
          onFailure(error);
        } else {
          that.authorize(onSuccess, onFailure, true);
        }
        return;
      }

      onSuccess();
    });
  };

  // if no popup, calls the authorization function immediately
  if (!opt_withPopup) {
    doAuthorize();
    return;
  }

  // Gets user to initiate the authorization with a dialog,
  // to prevent popup blockers.
  var dialog = new goog.ui.Dialog();
  dialog.setDisposeOnHide(true);
  dialog.setContent('coLaboratory needs access to Google Drive.' +
      ' Press the button below to continue.');
  dialog.setTitle('Drive Authorization Needed');
  dialog.setButtonSet(new goog.ui.Dialog.ButtonSet().addButton(
      {key: 'Continue', caption: 'Continue >>'},
      true, false));

  goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, function(e) {
    doAuthorize();
  });
  dialog.setVisible(true);
};
