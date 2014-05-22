/**
 *
 * @fileoverview Contains functions for starting and reading notebooks.
 */

goog.provide('colab');

goog.require('colab.Header');
goog.require('colab.Notebook');
goog.require('colab.Presence');
goog.require('colab.cell.Cell');
goog.require('colab.dialog');
goog.require('colab.drive');
goog.require('colab.drive.Permissions');
goog.require('colab.notification');
goog.require('colab.params');
goog.require('colab.sharing.SharingState');
goog.require('goog.Promise');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.KeyCodes');
goog.require('goog.events.KeyHandler');
goog.require('goog.json');
goog.require('goog.net.XhrIo');
goog.require('goog.net.cookies');
goog.require('goog.style');
goog.require('goog.ui.Dialog');
goog.require('goog.ui.Dialog.ButtonSet');
goog.require('goog.ui.Dialog.ButtonSet.DefaultButtons');
goog.require('goog.ui.ScrollFloater');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.ToolbarButton');
goog.require('goog.ui.ToolbarSeparator');

/**
 * Placeholder URLs for in-browser kernel (for app mode) and legacy
 * in-page kernel.
 * TODO(kestert): remove in-page kernel as a kernel without working
 * urllib2 will just confuse the user.
 * @type {string}
 */
colab.IN_BROWSER_KERNEL_URL = 'app://';
/**
 * Url placeholder for in-page kernel
 * @type {string}
 */
colab.NACL_KERNEL_URL = 'nacl://';

/**
 * A promse that is fullfilled with details needed to communicate with in-app
 * kernel.
 * @type {goog.Promise}
 */
colab.appKernelDetails = new goog.Promise(function(resolve, reject) {
  colab.app.addChromeAppListener(function(data, metadata) {
    if (data === 'initialization_message') {
      resolve(metadata);
    }
  });
});

/**
 * Main notebook object.
 *
 * @type {Object}
 */
colab.globalNotebook = null;

/**
 * Global Kernel.
 *
 * @type {IPython.Kernel}
 */
colab.globalKernel = null;

/**
 * Global Sharing state.
 * TODO(kayur): move global to notebook, since it is the sharing state for the
 *    notebook. Can't do it, because it's needed before notebook is
 *    fully created
 * @type {colab.sharing.SharingState}
 */
colab.globalSharingState = null;

/**
 * Global Realtime Document.
 *
 * @type {Object}
 */
colab.globalRealtimeDoc = null;

/**
 * Global Realtime Document.
 *
 * @type {gapi.drive.realtime.Collaborator}
 */
colab.globalMe = null;

/**
 * @type {HashParams}
 */
colab.hashParams = colab.params.getHashParams();

/**
 * Close the connection to drive on unload
 */
window.addEventListener('unload', function() {
  colab.close();
});

/**
 * Close the connection to drive on unload
 */
window.addEventListener('beforeunload', function(ev) {
  if (colab.saveState && (
      colab.saveState.isSaving || colab.saveState.isPending)) {
    ev.returnValue = 'This page has pending changes, are you' +
         ' sure you want to navigate away from this page.';
  }
});



/**
 * Closes everything
 * @param {function()=} cb
 */
colab.close = function(cb) {
  // close the notebook
  // NOTE: Don't put any asynchronous code here, unless
  // it is of fire-and-forget variety.
  // BE careful if it might interefere with document closing.
  if (colab.globalNotebook) {
    colab.globalNotebook = null;
  }
  colab.drive.close(cb);
};

/** @type {colab.Preferences} */
colab.preferences = null;
/** gapi.drive.realtime.Document
 * Callback for window load.  Loads UI.
 */
window.addEventListener('load', function() {
  var loading = colab.notification.showNotification('Loading....', 'startup',
      -1 /* no timeout */);
  colab.drive.document.then(function(document) {
    var error = null;
    try {
      colab.globalRealtimeDoc = document;
      colab.startPeriodicSaving();
      document.addEventListener(
          gapi.drive.realtime.EventType.COLLABORATOR_JOINED,
          colab.updateCollaborators);
      document.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_LEFT,
                                colab.collaboratorLeft);


      document.addEventListener(
          gapi.drive.realtime.EventType.DOCUMENT_SAVE_STATE_CHANGED,
          colab.monitorSaveState);

      //get the collaborator that corresponds to me
      var collaboratorsList = colab.globalRealtimeDoc.getCollaborators();
      colab.globalMe =
          goog.array.find(collaboratorsList, function(c) { return c.isMe; });

      // update
      colab.updateCollaborators();

      var model = document.getModel();

      // set permissions
      var permissions = new colab.drive.Permissions(!model.isReadOnly);

      colab.preferences = new colab.Preferences();

      // get sharing state
      colab.globalSharingState = new colab.sharing.SharingState(
          colab.drive.fileIdIfAvailable);

      // create notebook
      var realtimeCells = model.getRoot().get('cells');
      colab.globalNotebook = new colab.Notebook(model, permissions);

      // select the first cell
      // TODO(kayur): move this to notebook when we clean up notebook code.
      if (realtimeCells.length > 0) {
        colab.globalNotebook.selectCell(realtimeCells.get(0).id);
      }

      // load kernel (default to localhost, and store in cookie 'kernelUrl')
      if (!goog.net.cookies.containsKey('kernelUrl')) {
        var kernelUrl = 'https://127.0.0.1:8888/kernels';
        if (colab.app.appMode) {
          // If in app mode, connect to in-browser kernel by default
          kernelUrl = colab.IN_BROWSER_KERNEL_URL;
        }
        goog.net.cookies.set('kernelUrl', kernelUrl, 10000);
      }
      colab.loadKernelFromUrl(goog.net.cookies.get('kernelUrl') || '');

      // set up the header: docname input, menubar, toolbar, share button
      colab.setupHeader(document, permissions);

      // set up top toolbar to remain fixed as the page scrolls
      var floater = new goog.ui.ScrollFloater();
      floater.decorate(goog.dom.getElement('top-floater'));
      IPython.mathjaxutils.init();
      loading.clear();
    } catch (err) {
      loading.change('Error has occurred', 3000);
      error = err;
      colab.dialog.displayError('Unable to load the framework.', err);
      colab.setupHeader(null, null);
      console.log(err);
    }

  }, function(reason) {
    // Displays error to user on failure
    colab.dialog.displayError('Error creating/loading document.', reason);
    colab.setupHeader(null, null);
    loading.clear();
  });
});

/**
 * Interval in milliseconds for periodic saving of document
 * @type {number}
 * TODO(kestert): revise this interval based on performance, after
 *     experimentation
 */
colab.SAVE_INTERVAL = 1 * 30 * 1000;  // 30 seconds

/**
 * Interval in milliseconds for testing document invalidation
 * @type {number}
 */
colab.INVALIDATION_CHECK_INTERVAL = 10 * 1000;  // 10 seconds


/**
 * Keeps track of whether an invalidation dialog is being displayed
 * @type {boolean}
 */
colab.invalidationDialogDisplayed = false;


/**
 * Informs the user that the document must be reloaded, and requires this
 * action.
 *
 * @param {string=} opt_title - if provided customizes the dialog title
 * @param {string=} opt_reason - detailed message to the user.
 * @param {string=} opt_button
 */
colab.onDocumentInvalidation = function(opt_title, opt_reason, opt_button) {
  if (colab.invalidationDialogDisplayed || colab.drive.isClosing) return;
  colab.invalidationDialogDisplayed = true;

  var title = opt_title || 'File change detected';

  var reason = opt_reason ||
      'The file on disk has been overwritten by another' +
      ' application.  Please click the button below to save the current' +
      ' version and reload.  All versions by you and other users are' +
      ' available in the file\'s revision history, which can be accessed' +
      ' from Google Drive.';
  var dialog = new goog.ui.Dialog();
  dialog.setContent(reason);
  dialog.setTitle(title);

  var buttonSet = new goog.ui.Dialog.ButtonSet();
  var RELOAD_KEY = 'reload';
  buttonSet.addButton({
    key: RELOAD_KEY,
    caption: opt_button || 'Reload From File'
  }, false, false);

  dialog.setButtonSet(buttonSet);

  goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, function(e) {
    colab.reload();
  });
  dialog.setVisible(true);
  // Remove all periodic savers, since we no longer need them as the
  // document will be invalidated.
  clearInterval(colab.uuid_checker);
  clearInterval(colab.autoSaver);
};


/**
 * reload document as if the page was just loaded in the browser.
 * Currently implemented  as window.location.reload()
 */
colab.reload = function() {
  colab.close(function() { window.location.reload(); });
};

/**
 * @type {colab.Notification}
 */
colab.uuid_failed_note = null;

/**
 * Starts periodic saving
 */
colab.startPeriodicSaving = function() {
  // don't save if the document is readonly
  if (colab.globalRealtimeDoc.getModel().isReadOnly) {
    return;
  }

  // periodcally checks for document invalidation
  colab.drive.fileId.promise.then(function(fileId) {
    /**
     * @type {number}
     */
    colab.uuid_checker = window.setInterval(function() {
      /** @type {gapi.drive.realtime.Model} */
      var model = null;
      try {
        model = colab.globalRealtimeDoc.getModel();
      } catch (e) {
        // TODO(sandler): it would be nice if we actually
        // automatically reloaded this document when it is safe to do so.
        // RIght now it takes 20-30 seconds to detect the loss...
        colab.onDocumentInvalidation('Connection to the document lost',
            'We no longer have live connection to google drive servers. ' +
            'This might be caused by the change of network.' +
            'Any further changes will not be saved. Please reload this page. ',
            'Reload');
        clearInterval(colab.uuid_checker);
        return;
      }
      colab.drive.checkModelUUID(model, fileId,
          function(isMatch) {
            if (!isMatch) colab.onDocumentInvalidation();
          },
          function(response) {
            if (response === 'Error getting document UUID') {
              // Known non-error, caused by legacy docs.
              return;
            }
            if (colab.uuid_failed_note) {
              colab.uuid_failed_note.clear();
            }
            // This notification is now redundant and on the margin w.r.t
            // saveStateEvents only produces false positives.
//            colab.uuid_failed_note = colab.notification.showNotification(
//               'Whops. There is an issue with realtime API. If this ' +
//                'message re-occurs please email colab-team and ' +
//                'reload the document. Include copy of console log ' +
//               '(ctrl-shift-J) ', '', 10000);

            console.log('Error obtaining UUID', response);
          });
    }, colab.INVALIDATION_CHECK_INTERVAL);
  });

  colab.autoSaver = window.setInterval(function() {
    // console.log('autosaving...');
    colab.drive.saveDocument(colab.globalRealtimeDoc, function() {
      // Saved successfully
    }, function(reason) {
      console.log(reason);
    });
  }, colab.SAVE_INTERVAL);
};

/**
 * Authorizes the kernel living at given url
 * and calls callback upon successful completion
 * @param {string} url
 * @param {Function} callback
 */
colab.authorizeKernel = function(url, callback) {
  url = new window['URL'](url);

  var childWindow = window.open(
      url.protocol + '//' + url.hostname + ':' + url.port + '/oauthlogin',
      '_blank',
      'width=600, height=500');
  var checkWindow = function() {
    if (childWindow && childWindow.closed) {
        window.clearInterval(intervalID);
        callback();
    }
  };
  var intervalID = window.setInterval(checkWindow, 100);
};

/**
 * Launch a new IPython kernel.
 *
 * @param {string} url The location of the kernel.
 * @param {boolean} opt_forceAuthorization if true, initates
 *  authorization flow and starts kernel only upon successful
 *  authorization. If false loading might fail because
 *  of not being authorized.
 */
colab.loadKernelFromUrl = function(url, opt_forceAuthorization) {
  if (url != colab.IN_BROWSER_KERNEL_URL && url != colab.NACL_KERNEL_URL) {
    url = url.replace(/^http:\/\//, 'https://');
    // Adds /kernel suffix.
    url = url.replace(/\/kernels$/, '') + '/kernels';
    // Never authorize if in app mode (as all authorization is handled
    // by the parent window).
    opt_forceAuthorization = opt_forceAuthorization && !colab.app.appMode;
  }

  // Never authorize if using in-browser kernel
  opt_forceAuthorization = opt_forceAuthorization &&
      !(url === colab.IN_BROWSER_KERNEL_URL || url === colab.NACL_KERNEL_URL);
  /*
  if (opt_forceAuthorization) {
    colab.authorizeKernel(
        url, goog.partial(colab.loadKernelFromUrl, url, false));
    return;
  }
  */
  goog.net.cookies.set('kernelUrl', url, 10000);
  if (colab.globalKernel) {
    colab.globalKernel.kill();
    colab.globalKernel.stop_channels();
  }

  // Waits for promise (of parent window details) before starting kernel
  // if in app mode, otherwise immediately starts kernel.
  if (url === colab.IN_BROWSER_KERNEL_URL) {
    colab.appKernelDetails.then(function(details) {
      var options = /*** @type {IPython.KernelCreationOptions} */ ({
        in_browser_kernel: true,
        kernel_origin: details.origin,
        kernel_window: details.source
      });
      colab.globalKernel = new IPython.Kernel(url, options);
      colab.globalKernel.start(colab.globalNotebook.getId());
    });
  } else {
    colab.globalKernel = new IPython.Kernel(url);
    colab.globalKernel.start(colab.globalNotebook.getId());
  }
};

/**
 * Dialog box for connecting to a kernel backend.
 */
colab.openKernelDialogBox = function() {
  var dialog = new goog.ui.Dialog();
  dialog.setDisposeOnHide(true);

  var contentDiv = dialog.getContentElement();
  goog.style.setWidth(contentDiv, 400);

  var textDiv = goog.dom.createDom('div');
  textDiv.innerHTML = 'Enter the url for a python backend (kernel).' +
      'See <a href="http://goto.google.com/colab-external-kernel" ' +
      ' target="_blank"/> for how to setup your own python backend.';
  goog.dom.appendChild(contentDiv, textDiv);

  var urlInput = goog.dom.createDom('input', {'id': 'backend-url-input'});

  goog.style.setWidth(urlInput, 300);
  urlInput.value = colab.globalKernel.base_url;
  goog.dom.appendChild(contentDiv, urlInput);

  dialog.setTitle('Connect to Kernel');

  goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, function(e) {
    // TODO(kayur): find right event type.
    if (e.key == 'ok') {
      var url = goog.dom.getElement('backend-url-input').value;
      colab.loadKernelFromUrl(url, true /* authorize */);
    }
  });

  dialog.setVisible(true);
};

/**
 * Registes a listener to provide the access token to the kernel, if the
 * user allows it.
 */
colab.services.setKernelRequestListener('get_access_token',
    function(content, callback) {
  var dialog = new goog.ui.Dialog();
  dialog.setDisposeOnHide(true);
  dialog.setContent('The kernel is requesting access to Google Drive.' +
      ' Do you want to allow python code to access your Google Drive files?');
  dialog.setTitle('File change detected');

  dialog.setButtonSet(goog.ui.Dialog.ButtonSet.createYesNoCancel());

  goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, function(e) {
    var reply = {'error': {'type': 'USER_DENIED_ERROR',
                           'description': 'The user refused to provide the' +
                           ' OAuth token'}};
    if (e.key === goog.ui.Dialog.DefaultButtonKeys.YES) {
      reply = gapi.auth.getToken()['access_token'];
    }
    callback(reply);
  });

  dialog.setVisible(true);
});

/**
 * @type {number}
 */
colab.userAlarmTimer = 0;

/**
 * Contains the timestamp of the last 'not saved' event
 * @type {Date}
 */
colab.notSavedSince = null;

/**
 * @type {colab.Notification}
 */
colab.realtimeSaveFailureNote = colab.notification.createEmptyNotification();

/**
 * @param {gapi.drive.realtime.DocumentSaveStateChangedEvent} ev
 */
colab.monitorSaveState = function(ev) {
  if (!ev.isSaving && !ev.isPending) {
    colab.saveState = ev;
    colab.notSavedSince = null;
    colab.realtimeSaveFailureNote.clear();
    clearInterval(colab.userAlarmTimer);
    return;
  }
  if (!colab.notSavedSince) {
    colab.notSavedSince = new Date();
    colab.userAlarmTimer = setInterval(function() {
      var x = Math.round(
          (new Date() - colab.notSavedSince) / 1000 / 60.) + ' minutes';
      var msg = 'Realtime save failed for ' + x + '.' +
          'Data loss is possible. Reopen in a new tab to ensure validity.';
      colab.realtimeSaveFailureNote.change(msg, -1);
    }, 60 * 1000);
  }
  colab.saveState = ev;
  if (Date() - colab.notSavedSince > 30000) {
    console.log('Save state is (in flight: ', ev.isSaving, ' pending: ',
        ev.isPending + ')');
  }
};
