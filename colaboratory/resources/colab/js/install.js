
goog.provide('colab.install');

goog.require('colab.client_id');
goog.require('colab.scope');


/**
 * Installs the Colaboratory App on Google Drive.
 * @param {boolean} immediate Whether to return immediately or show prompt
 * @param {Function} callback Callback for success or failure
 */
colab.install.install = function(immediate, callback) {
  gapi.load('auth:client', function() {
    // Special procedure for when in Chrome App mode.
    if (colab.app.appMode) {
      colab.app.authorize(immediate, callback);
      return;
    }

    // Otherwise, using standard OAuth flow.
    gapi.auth.authorize({
      client_id: colab.client_id.INSTALL_CLIENT_ID,
      scope: [colab.scope.INSTALL_SCOPE,
              colab.scope.FILEPICKER_SCOPE],
      immediate: immediate
    }, callback);
  });
};
