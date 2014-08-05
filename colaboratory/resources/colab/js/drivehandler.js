/**
 *
 * @fileoverview Redirect logic for redirects from Google Drive.
 */

goog.require('colab.params');


/**
 * Attempts to redirect based on query string.
 * @return {boolean} True on success
 */
var redirect = function() {
  var params = colab.params.getSearchParams();
  var state;
  try {
    state = JSON.parse(params.state);
  } catch (error) {
    console.error(error);
  }
  if (!state) {
    return false;
  }

  var redirectParams;
  if (state['action'] === 'open') {
    redirectParams = {fileId: state.ids[0]};
  } else if (state['action'] === 'create') {
    redirectParams = /** @type {HashParams} */ {
      folderId: state['folderId'],
      create: true
    };
  } else {
    console.log('invalid value of action field');
    return false;
  }
  colab.params.redirectToNotebook(redirectParams);
  return true;
};

if (!redirect()) {
  alert('Invalid query');
}
