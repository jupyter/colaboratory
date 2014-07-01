/**
 *
 * @fileoverview Functions for dealing with sharing with Google Drive.
 *
 */

goog.provide('colab.share');

goog.require('colab.drive');
/**
 * @type {gapi.drive.share.ShareClient}
 */
colab.share.shareClient_;

/**
 * Open share dialog for the document.
 * @param {colab.drive.NotebookModel} notebook
 */
colab.share.shareDocument = function(notebook) {
  if (!colab.drive.shareClient_) {
    colab.drive.shareClient_ = new gapi.drive.share.ShareClient(colab.APP_ID);
  }
  var shareClient = colab.drive.shareClient_;
  shareClient.setItemIds([notebook.getFileId()]);
  shareClient.showSettingsDialog();
  colab.share.validateSharingDialog_(notebook);
};

/**
 * Keeps interval task for validation dialog
 * @type {number}
 * @private
 */
colab.share.validationDialogTask_ = 0;

/**
 * Validates that sharing dialog present itself.
 * @param {colab.drive.NotebookModel} notebook
 * @private
 */
colab.share.validateSharingDialog_ = function(notebook) {
  var SHARING_FAILED_CSS_PATH = 'body > ' +
     'div > div:contains("Sorry, sharing is unavailable")';

  var count = 0;
  if (colab.share.validationDialogTask_) {
    clearInterval(colab.share.validationDialogTask_);
    colab.share.validationDialogTask = 0;
  }
  var fileViewerUrl = notebook.fileDriveUrl();
  var failedHtml = (
      'Sorry, sharing from the app is unavailable at this time.<br/> <br/>' +
      'If you are signed in under multiple accounts (eg personal and work), ' +
      'it is likely that you are bitten by a Drive Api bug (' +
      '<a href="https://b.corp.google.com/issue?id=13139246">b/13139246</a>).' +
      '<br/><br/>As a workaround use Drive Viewer (' +
      '<b><a href="' + fileViewerUrl + '" target=_blank>Click To Open</a></b>)'
  );
  var check = function() {
    count += 1;
    var failed = jQuery(SHARING_FAILED_CSS_PATH);
    if (failed.size()) {
      failed.html(failedHtml);
      // Can't clear interval, because otherwise this
      // fails on sequential 'share' clicks (since element
      // already exists and is not cleanly removed. It is not that
      // terrible overhead and happens rarely.
      // TODO(sandler): fix as needed
      // clearInterval(colab.drive.validationDialogTask);
      // return;
    }
    if (count > 100) { // 300 * 100 = ~30 seconds
      console.log('Sharing validation finished');
      clearInterval(colab.share.validationDialogTask_);
      // Done here.
    }
  };
  colab.share.validationDialogTask_ = setInterval(check, 300);
};
