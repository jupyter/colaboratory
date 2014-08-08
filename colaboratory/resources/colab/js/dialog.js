/**
 kernel* @fileoverview Provides utility functions to handle dialogs in colab
 */

goog.provide('colab.dialog');
goog.require('goog.ui.Dialog');


/**
 * Displays an error dialog
 * @param {string} text Text to display.
 * @param {*} reason The reason for the error (can be used to augment the
 *     display text, but right now is just logged to the console).
 */
colab.dialog.displayError = function(text, reason) {
  var dialog = new goog.ui.Dialog();
  var message = '';
  if (reason) {
    if (reason.message) {
      message = '<br/> <b> Error: </b> ' + (reason.message);
    } else if (reason.error) {
      message = '<br/> <b> Error: </b> ' + (reason.error.message);
    }

  }
  dialog.setContent(text + message + '<br/> See console for more details.');
  dialog.setTitle('Error');
  dialog.setButtonSet(goog.ui.Dialog.ButtonSet.createOk());
  console.log('Reason: ', reason);
  dialog.setDisposeOnHide(true);
  dialog.setVisible(true);
};


/**
 * Returns a simple error handler with given title
 * That would create a error dialog.
 *
 * @param {string} text to display
 * @return {function(Object)} function that takes one parameter ('reason')
 *    from displayError
 */
colab.dialog.displayErrorHandler = function(text) {
  return goog.partial(colab.dialog.displayError, text);
};
