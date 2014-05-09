/**
 * @fileoverview Description of this file.
 *
 * Various utility functions pertaining to drive
 */

// A reasonably unique function name for gapi client on load callback.
var driveutil_handleClientLoad;

var IPython = (function(IPython) {
  'use strict';

  var APP_ID = '888136551179';
  var CLIENT_ID = '888136551179-7fp58evuok2rgipc48ddsup5vm97i730.apps.googleusercontent.com';
  var API_KEY = 'AIzaSyCGaMa-QkqMisXOcutKpxhdgnlKugoE8to';
  var SCOPES = ['https://www.googleapis.com/auth/drive',
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.install'].join(' ');
  var DriveUtil = {};

  DriveUtil.APP_ID = APP_ID;

  DriveUtil.getShareClient = function() {
    if (!DriveUtil.share_client) {
      DriveUtil.share_client = new gapi.drive.share.ShareClient(APP_ID);
    }
    return DriveUtil.share_client;
  };

  DriveUtil.validationDialogTask = 0;

/**
 * Validates that sharing dialog present itself.
 */
  DriveUtil.validateSharingDialog = function(fileViewerUrl) {

  var SHARING_FAILED_CSS_PATH = 'body > ' +
     'div > div:contains("Sorry, sharing is unavailable")';

  var count = 0;
  if (DriveUtil.validationDialogTask) {
    clearInterval(DriveUtil.validationDialogTask);
    DriveUtil.validationDialogTask = 0;
  }
  var failedHtml = (
      'Sorry sharing from the app is unavailable at this time.<br/> <br/>' +
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
      // clearInterval(DriveUtil.validationDialogTask);
      // return;
    }
    if (count > 100) { // 300 * 100 = ~30 seconds
      console.log('Sharing validation timed out');
      clearInterval(DriveUtil.validationDialogTask);
      // Done here.
    }
  };
  DriveUtil.validationDialogTask = setInterval(check, 300);
};


  DriveUtil.copyNotebook = function(onSuccess, onError) {
    var body = {'title': 'Copy of ' + IPython.notebook.notebook_name};
    var request = gapi.client.drive.files.copy({
    'fileId': IPython.notebook.get_notebook_id(),
    'resource': body
    });
    request.execute(function(resp) {
      if (resp.error) {
        if (opt_onError) {
          opt_onError(resp);
        } else {
          console.error(resp);
        }
        return;
      }
      onSuccess(resp);
    });
  };

  DriveUtil.showInstallAppDialog = function(resp) {
     console.error('Error response ', resp);
     var onAuth = function() {window.location.reload(); };
     var body = $('<div/>').css('text-align', 'center')
         .append([
             '<div>',
             'Click on the button below to authorize colaboratory to access ',
             ' your google drive data. You will be taken to a confirmation ',
             'screen with ',
             ' details about the permissions required. </div> <br/><br/>',
              getInstallDriveAppButton(onAuth).addClass('btn-primary'),
              '<br/><br/>If you already have installed the app, there ',
              'might be a configuration error.',
              ' Please contact colab-team@google.com for assistance.']);
     var dlg = IPython.dialog.modal({
        body: body, title: 'Install Colaboratory app for Google Drive. ',
        closeOnEscape: true });
     dlg.on('hidden', function() {window.location.reload(); });
  };

  DriveUtil.authUser = 0;
  /**
   * Authenticate user with google drive, if user is not registered
   * offers to authenticate. Calls opt_Callback if and when successful.
   */
  DriveUtil.authenticateWithDrive = function(opt_Callback) {
   var that = this;
   var accountIndex = 0;
   var params = { client_id: CLIENT_ID,
     scope: SCOPES,
     authuser: DriveUtil.authUser,
     immediate: true
   };
   var authorize = function(token) {
       var request = gapi.client.request({
         'path': '/drive/v2/about'
       });
       request.execute(function(resp) {
         if (resp.error) {
           console.log('User#', params.authuser, resp);
           if (params.authuser <= 3) {
             // Try to authenticate a next user and see if it is
             // any different.
             // TODO(sandler): is there a better way?
             params.authuser++;
             gapi.auth.authorize(params, authorize);
           } else {
             that.showInstallAppDialog(resp);
           }
           return;
         }
         DriveUtil.authUser = params.authuser;
         if (opt_Callback) {
           console.log('Authenticated!');
           gapi.client.load('drive', 'v2', function() {
             opt_Callback(resp);
           });
         }
       });
    };

    console.log('Trying to authenticate!');
    gapi.auth.authorize(params, authorize);
  };

  DriveUtil.getAvailableNotebooksInDriveButton = function() {
    var button = $('<button/>').html('View Notebooks');
    button.click(function() {
      window.location = 'https://drive.google.com/a/google.com/#search/ipynb';
    });
    return button;
  }

  DriveUtil.getNewNotebookButton = function() {
    var button = $('<button/>').html('Create New Notebook')
        .addClass('btn-primary');
    button.click(function() {
      // We explicitly redirect to colab, since we don't want
      // to encourage local-kernel acting as a frontend, since
      // it might interfere with its ability to access drive.
      // One could still go local url, by manually replacing url.
      window.location = 'https://colab.corp.google.com/new';
    });
    return button;
  };

  DriveUtil.loadDriveApi = function(action) {

   driveutil_handleClientLoad = function() {
    gapi.client.setApiKey(API_KEY);
    window.setTimeout(action, 1);
    driveutil_handleClientLoad = undefined;
   };
   $.ajax({
     url: 'https://apis.google.com/js/client.js?onload=driveutil_handleClientLoad',
     dataType: 'script'
   });
  };
  IPython.DriveUtil = DriveUtil;
  return IPython;
}(IPython));
