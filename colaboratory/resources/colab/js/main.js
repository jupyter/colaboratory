/**
 *
 * @fileoverview Contains functions for starting and reading notebooks.
 */

goog.provide('colab');

goog.require('colab.Global');
goog.require('colab.Notebook');
goog.require('colab.PNaClKernel');
goog.require('colab.Preferences');
goog.require('colab.app');
goog.require('colab.dialog');
goog.require('colab.drive');
goog.require('colab.drive.ApiWrapper');
goog.require('colab.model.Notebook');
goog.require('colab.notification');
goog.require('colab.params');
goog.require('colab.presence');
goog.require('colab.services');
goog.require('colab.sharing.SharingState');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.net.cookies');
goog.require('goog.style');
goog.require('goog.ui.Dialog');
goog.require('goog.ui.ScrollFloater');


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
 * Records custom analytics about this request
 * @param {colab.model.Notebook} notebook
 * @param {Error|Object=} opt_error an exception object, if available.
 */
colab.recordAnalytics = function(notebook, opt_error) {
  if (colab.params.getHashParams().mode == 'app') { return; }
  var finishedLoading = new Date();
  window.setTimeout(function() {
    var document = notebook ? notebook.getDocument() : null;
    var user = document ? document.getCollaborators().filter(
        function(d) { return d.isMe }) : '';
    var email = 'unknown';
    var myInfo = colab.drive.ApiWrapper.getInstance().myInfo;
    if (myInfo && myInfo.emails && myInfo.emails.length) {
      email = myInfo.emails[0].value;
    }
    if (user) user = user[0];
    var params = { 'loadingTime': finishedLoading - window['pageLoadStart'],
                   'user': user ? user.displayName : 'unknown',
                   'userId': user ? user.userId : 'unknown',
                   'email': email,
                   'title': notebook ? notebook.getTitle() : ''
                 };
    if (opt_error) {
      params['errormessage'] = 'Error' +
          (opt_error.message || JSON.stringify(opt_error));
    }
    var analyticsQuery = colab.params.encodeParamString(params);
    var xhrRequest = new XMLHttpRequest();
    xhrRequest.open('GET', '/analytics?' + analyticsQuery, true);
    xhrRequest.send();
  }, 1000);
};


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
 * Closes everything.
 * @param {function()=} opt_cb Callback for notebook close function.
 */
colab.close = function(opt_cb) {
  // close the notebook
  // NOTE: Don't put any asynchronous code here, unless
  // it is of fire-and-forget variety.
  // BE careful if it might interefere with document closing.
  if (colab.Global.getInstance().notebook) {
    colab.Global.getInstance().notebook = null;
  }
  if (colab.Global.getInstance().notebookModel) {
    colab.Global.getInstance().notebookModel.close(opt_cb);
  } else {
    if (opt_cb) opt_cb();
  }
};


/**
 * Generate default kernel url
 * @return {string} The kernel url
 */
colab.getDefaultKernelUrl = function() {
  var port = location.port || '8888';
  return location.protocol + '//127.0.0.1:' + port;
};


/**
 * Callback for window load.  Loads UI.
 */
window.addEventListener('load', function() {
  var loading = colab.notification.showNotification('Loading....', 'startup',
      -1 /* no timeout */);

  // Handles error in loading process
  var onLoadNotebookError = function(error) {
    colab.dialog.displayError('Error creating/loading document.', error);
    colab.setupHeader(null);
    loading.clear();
    colab.recordAnalytics(null, /** @type {Object} */ (error));
  };

  // Loads a notebook from Google Drive
  var loadNotebook = function(fileId) {
    var notebook = new colab.model.Notebook(fileId);
    notebook.load(function() {
      loading.clear();
      colab.onLoadNotebookSuccess_(notebook);
    }, onLoadNotebookError);
  };


  // Select action based on window hash parameters.
  var params = colab.params.getHashParams();

  if (params.fileId) {
    console.log('Loading notebook from Google Drive.');
    loadNotebook(params.fileId);
  } else if (params.create) {
    console.log('Creating new notebook in Google Drive.');
    // Create a new notebook, then call colab.loadNotebook_ with that notebook,
    // or call colab.onCreateNotebookError_ if creation fails. (Note
    colab.drive.ApiWrapper.getInstance().driveApiReady.then(function() {
      colab.drive.createNewNotebook(function(response) {
        var fileId = response.id;
        // Change hash param to correspond to newly created notebook, preserving
        // all hash params except those used to create the file.
        // NOTE: this doesn't cause reload because we stay on same page
        delete params.create;
        delete params.folderId;
        params.fileId = fileId;
        window.location.hash = '#' + colab.params.encodeParamString(params);
        loadNotebook(fileId);
      }, onLoadNotebookError, params.folderId);
    }, onLoadNotebookError);
  } else if (params.fileIds) {
    // NOTE: this code path should never be taken, code is only included in
    // case people have bookmarked links from old code.
    var fileId = params.fileIds.split(',')[0];
    colab.params.redirectToNotebook({fileId: fileId});
    window.location.reload();
  } else if (colab.params.getSearchParams()['state']) {
    // NOTE: this code path should never be taken, code is only included in
    // case people have bookmarked links from old code.
    window.location.pathname = '/v2/drive' + window.location.search;
  } else {
    colab.drive.ApiWrapper.getInstance().authorized.then(function() {
      colab.filepicker.selectFileAndReload();
    });
  }
});


/**
 * Global tasks to perform after succesfully creating a notebook model object.
 *
 * This function performs global tasks associated with loading a
 * colab.model.Notebook instance.
 *
 * @param {colab.model.Notebook} notebook The notebook model object.
 * @private
 */
colab.onLoadNotebookSuccess_ = function(notebook) {
  var error = null;
  var global = colab.Global.getInstance();
  colab.Global.getInstance().notebookModel = notebook;

  notebook.listen(colab.model.Notebook.EventType.FATAL_REALTIME_ERROR,
      function(e) {
        var event = /** @type {colab.ErrorEvent} */ (e);
        var reason = 'Fatal realtime API error.  See console for details.' +
            ' You must reload this document.';
        colab.onDocumentInvalidation('Fatal Realtime API Error', reason);
        console.log(event.error.message);
      });
  notebook.listen(colab.model.Notebook.EventType.OAUTH_ERROR,
      function(e) {
        var event = /** @type {colab.ErrorEvent} */ (e);
        colab.onDocumentInvalidation('Failed to get an OAuth token',
            'See console for details.');
        console.log(event.error.message);
      });
  try {
    var document = notebook.getDocument();
    colab.startPeriodicSaving(notebook);
    document.addEventListener(
        gapi.drive.realtime.EventType.COLLABORATOR_JOINED,
        colab.presence.updateCollaborators);
    document.addEventListener(gapi.drive.realtime.EventType.COLLABORATOR_LEFT,
                              colab.presence.collaboratorLeft);


    document.addEventListener(
        gapi.drive.realtime.EventType.DOCUMENT_SAVE_STATE_CHANGED,
        colab.monitorSaveState);

    //get the collaborator that corresponds to me
    var collaboratorsList = document.getCollaborators();
    global.me = goog.array.find(collaboratorsList,
        function(c) { return c.isMe; });

    // update
    colab.presence.updateCollaborators();

    var model = document.getModel();

    global.preferences = new colab.Preferences();

    // get sharing state
    global.sharingState = new colab.sharing.SharingState(
        notebook.getFileId());

    // create notebook
    var realtimeCells = model.getRoot().get('cells');
    global.notebook = new colab.Notebook(notebook);
    global.notebook.render();

    // select the first cell
    // TODO(kayur): move this to notebook when we clean up notebook code.
    if (realtimeCells.length > 0) {
      global.notebook.selectCell(realtimeCells.get(0).id);
    }

    // load kernel (default to localhost, and store in cookie 'kernelUrl')
    if (!goog.net.cookies.containsKey('kernelUrl')) {
      var kernelUrl = colab.getDefaultKernelUrl();
      if (colab.app.appMode) {
        // If in app mode, connect to in-browser kernel by default
        kernelUrl = colab.IN_BROWSER_KERNEL_URL;
      }
      goog.net.cookies.set('kernelUrl', kernelUrl, 10000);
    }
    if (colab.app.appMode) {
      colab.loadPNaClKernel();
    } else {
      colab.loadKernelFromUrl(goog.net.cookies.get('kernelUrl') || '', false);
    }

    // set up the header: docname input, menubar, toolbar, share button
    colab.setupHeader(notebook);
    // set up top toolbar to remain fixed as the page scrolls
    var floater = new goog.ui.ScrollFloater();
    floater.decorate(goog.dom.getElement('top-floater'));
    IPython.mathjaxutils.init();
  } catch (err) {
    error = err;
    colab.dialog.displayError('Unable to load the framework.', err);
    colab.setupHeader(null);
    console.log(err);
  }
  colab.recordAnalytics(notebook, error);
};


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
  if (colab.invalidationDialogDisplayed) return;
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


/** @type {colab.Notification} */
colab.uuid_failed_note = null;


/**
 * Starts periodic saving
 * @param {colab.model.Notebook} notebook
 */
colab.startPeriodicSaving = function(notebook) {
  var document = notebook.getDocument();
  var fileId = notebook.getFileId();

  // don't save if the document is readonly
  if (document.getModel().isReadOnly) {
    return;
  }

  // periodcally checks for document invalidation
  /** @type {number} */
  colab.uuid_checker = window.setInterval(function() {
    /** @type {gapi.drive.realtime.Model} */
    var model = null;
    try {
      model = document.getModel();
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
          //     colab.uuid_failed_note = colab.notification.showNotification(
          //        'Whops. There is an issue with realtime API. If this ' +
          //         'message re-occurs please email colab-team and ' +
          //         'reload the document. Include copy of console log ' +
          //        '(ctrl-shift-J) ', '', 10000);

          console.log('Error obtaining UUID', response);
        });
  }, colab.INVALIDATION_CHECK_INTERVAL);

  colab.autoSaver = window.setInterval(function() {
    // console.log('autosaving...');
    notebook.save(function() {
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
 * Takes a kernel location inputted by the user and formats it appropriately.
 *
 * @param {string} url Kernel locaton.
 * @return {string} Formatted Kernel location.
 * @throws {colab.Error}
 * @private
 */
colab.formatKernelLocation_ = function(url) {
  var formattedUrl = url;

  if (location.protocol == 'https:') {
    formattedUrl = formattedUrl.replace(/^http:\/\//, 'https://');
  }

  // removes trailing slash
  formattedUrl = formattedUrl.replace(/\/$/, '');

  // removes IPython 1.0 url
  formattedUrl = formattedUrl.replace(/\/kernels.*$/, '');
  return formattedUrl;
};


/**
 * Launch a new IPython kernel.
 *
 * @param {string} url The location of the kernel.
 * @param {boolean=} opt_forceAuthorization if true, initates
 *  authorization flow and starts kernel only upon successful
 *  authorization. If false loading might fail because
 *  of not being authorized.
 */
colab.loadKernelFromUrl = function(url, opt_forceAuthorization) {
  var formattedUrl = colab.formatKernelLocation_(url);
  var global = colab.Global.getInstance();

  if (opt_forceAuthorization) {
    var authorizeCallback = goog.partial(
        colab.loadKernelFromUrl, formattedUrl, false);
    colab.authorizeKernel(formattedUrl, authorizeCallback);
    jQuery([IPython.events]).trigger('authorizing.Session');
    return;
  }

  goog.net.cookies.set('kernelUrl', formattedUrl, 10000);
  var notebook_id = global.notebook && global.notebook.getId();
  if (!notebook_id) {
    console.error('Can not connect to kernel. No unique id for notebook.');
    return;
  }

  global.kernel = null;
  global.session = new IPython.Session({
    notebook_name: notebook_id || '',
    notebook_path: 'n/a',
    base_url: '/'
  }, {
    kernel_host: formattedUrl
  });

  jQuery([IPython.events]).on('start_failed.Session start_failed.Kernel',
      function() {
        colab.notification.showPrimary('Unable to connect to kernel', 1000);
        global.session = null;
      });
  // For whatever reason kernel no longer triggers starting.Kernel event
  // So we do it here instead.
  jQuery([IPython.events]).trigger('starting.Session');
  global.session.start(function() { global.kernel = global.session.kernel; });


  jQuery([IPython.events]).on('websocket_closed.Kernel', function() {
    // If websocket connection fails, disassociate with kernel.
    colab.notification.showPrimary('Disconnected from kernel', 1000);
    global.kernel.disconnected = true;
  });
};


/**
 * Launch a new PNaCl IPython kernel.
 */
colab.loadPNaClKernel = function() {
  var global = colab.Global.getInstance();

  if (global.kernel) {
    global.kernel.kill();
    global.kernel.stop_channels();
  }

  // Waits for promise (of parent window details) before starting kernel
  // if in app mode, otherwise immediately starts kernel.
  global.kernel = new colab.PNaClKernel();
  global.kernel.start();
};


/**
 * Dialog box for connecting to a kernel backend.
 */
colab.openKernelDialogBox = function() {
  var global = colab.Global.getInstance();
  if (colab.app.appMode) {
    if (!global.kernel.running) {
      colab.loadPNaClKernel();
    }
    return;
  }
  var dialog = new goog.ui.Dialog();
  dialog.setDisposeOnHide(true);

  var contentDiv = dialog.getContentElement();
  goog.style.setWidth(contentDiv, 400);

  var textDiv = goog.dom.createDom('div');
  textDiv.innerHTML = 'To run code you need to connect to a Jupyter kernel. ' +
    'Enter the url for a running Jupyter kernel below. Keep in mind this ' +
    'will allow coLaboratory to execute code on the machine where the ' +
    'Juptyer kernel is located.';
  goog.dom.appendChild(contentDiv, textDiv);

  var urlInput = goog.dom.createDom('input', {'id': 'backend-url-input'});

  goog.style.setWidth(urlInput, 300);
  urlInput.value = global.session ? global.session.kernel_host :
      goog.net.cookies.get('kernelUrl', colab.getDefaultKernelUrl());
  goog.dom.appendChild(contentDiv, urlInput);

  dialog.setTitle('Connect to Kernel');

  goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, function(e) {
    // TODO(kayur): find right event type.
    if (e.key == 'ok') {
      var url = goog.dom.getElement('backend-url-input').value;
      colab.loadKernelFromUrl(url, false /* authorize */);
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
          ' Do you want to allow python code to access your Google Drive' +
          ' files?');
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
 * @param {gapi.drive.realtime.BaseModelEvent} ev
 */
colab.monitorSaveState = function(ev) {
  var event =
      /** @type {gapi.drive.realtime.DocumentSaveStateChangedEvent} */ (ev);
  if (!event.isSaving && !event.isPending) {
    colab.saveState = event;
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
  colab.saveState = event;
  if (Date() - colab.notSavedSince > 30000) {
    console.log('Save state is (in flight: ', event.isSaving, ' pending: ',
        event.isPending + ')');
  }
};
