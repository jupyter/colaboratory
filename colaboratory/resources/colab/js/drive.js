/**
 *
 * @fileoverview Functions for dealing with Google Drive.
 *
 * TODO(colab-team): Move NotebookModel out of drive into notebookModel.js.
 *     Deal with circular dependencies.
 */

goog.provide('colab.drive');
goog.provide('colab.drive.NotebookModel');

goog.require('colab.Error');
goog.require('colab.app');
goog.require('colab.error');
goog.require('colab.filepicker');
goog.require('colab.nbformat');
goog.require('goog.Promise');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.ui.Dialog');


/**
 * A wrapper for a Notebook model object.
 * TODO(kestert): This is part of a larger refactoring process.  Right
 * now the object is just a wrapper, but refactoring will move most of
 * the logic related to Google Drive interaction inside this class.
 *
 * @param {string} fileId Google Drive File Id of file
 * @constructor
 */
colab.drive.NotebookModel = function(fileId) {
  /** @private {string} */
  this.fileId_ = fileId;

  /** @private {gapi.drive.realtime.Document} */
  this.document_ = null;

  /** @private {boolean} */
  this.isDirty_ = false;

  /** @private {boolean} */
  this.isClosing_ = false;

  /** @private {boolean} */
  this.isClosed_ = false;

  /** @private {number} */
  this.numFailedSaveAttempts_ = 0;

  /** @private {string} */
  this.offlineTitle_ = '';

  /** @private {boolean} */
  this.offlineTitleChangePending_ = false;

  /** @private {colab.drive.Permissions} */
  this.permissions_ = null;

  /** @private {string} */
  this.fileDriveUrl_ = '';

  /**
   * @private {boolean} Whether the realtime doc is shared with anyone.
   * For security reasons, this is assumed true by default.
   */
  this.isShared_ = true;
};

/**
 * @return {string} The Google Drive File Id of this notebook
 */
colab.drive.NotebookModel.prototype.getFileId = function() {
  return this.fileId_;
};

/**
 * @return {gapi.drive.realtime.Document} The Realtime document.
 */
colab.drive.NotebookModel.prototype.getDocument = function() {
  return this.document_;
};

/**
 * @return {colab.drive.Permissions} Permissions of the notebook
 */
colab.drive.NotebookModel.prototype.getPermissions = function() {
  return this.permissions_;
};

/**
 * @return {boolean} Whether the document is shared by other users.
 */
colab.drive.NotebookModel.prototype.isShared = function() {
  return this.isShared_;
};

/**
 * @return {string} The URL to open the file in the Google Drive web interface.
 */
colab.drive.NotebookModel.prototype.fileDriveUrl = function() {
  return this.fileDriveUrl_;
};

/**
 * @return {Object} A realtime object that acts as a sentinel for comments
 *    changes.
 */
colab.drive.NotebookModel.prototype.getCommentSentinel = function() {
  var model = this.document_.getModel();
  if (!model.getRoot().get('sentinel')) {
    model.getRoot().set('sentinel',
                        model.createList([new Date().toISOString()]));
  }

  return model.getRoot().get('sentinel');
};

/**
 * Starts listening for model changes to mark document as dirty, for the
 * purpose of autosave.
 */
colab.drive.NotebookModel.prototype.setModelChangeListener = function() {
  var that = this;
  this.document_.getModel().getRoot().addEventListener(
      gapi.drive.realtime.EventType.OBJECT_CHANGED,
      function(event) {
        var root = that.document_.getModel().getRoot();
        if (event.target == root.get('metadata')) {
          // Changes to metadata don't constitute changes to a document
          return;
        }
        if (!event.isLocal) {
          // Not local changes are handled by others. Don't mark outselves
          // dirty.
          return;
        }
        that.isDirty_ = true;
      });
};

/**
 * Gets the title of the document
 * @return {string} title of the document.
 */
colab.drive.NotebookModel.prototype.getTitle = function() {
  if (!this.document_) {
    return this.offlineTitle_;
  }
  var model = this.document_.getModel();
  var title = model.getRoot().get('title');
  if (title && title.getText) {
    var title_text = title.getText();
  }
  title_text = title_text || this.offlineTitle_;
  title_text = title_text || colab.drive.NEW_NOTEBOOK_TITLE;
  return title_text;
};

/**
 * Sets the title of the document
 * @param {string} newTitle new file name.
 */
colab.drive.NotebookModel.prototype.setTitle = function(newTitle) {
  var model = this.document_.getModel();
  if (model.isReadOnly) { return; }
  var title = colab.drive.createTitle(model);
  if (!title) return;
  title.setText(newTitle);
};

/**
 * registers a listener to receive updates when title changes.
 * Does nothing if there is no realtime doc attached.
 * @param {function(string)} handler listener that receives title.
 */
colab.drive.NotebookModel.prototype.onTitleChange = function(handler) {
  if (!this.document_) return;
  var title = colab.drive.createTitle(this.document_.getModel());
  if (title && title.addEventListener) {
    title.addEventListener(
       gapi.drive.realtime.EventType.OBJECT_CHANGED,
       function(event) {
         handler(event.target.getText());
       });
  }
};

/**
 * @param {gapi.client.drive.files.Resource} resource
 * @private
 */
colab.drive.NotebookModel.prototype.updateDocumentMetadata_ =
    function(resource) {
  this.fileDriveUrl_ = resource.alternateLink;
  this.offlineTitle_ = colab.drive.getTitleFromMetadataResponse_(resource);
  // if shared is absent or not false, assume shared.
  this.isShared_ = !(resource.shared == false);
};

/**
 * @param {gapi.client.drive.files.Resource} response
 * @param {gapi.drive.realtime.Error} error
 * @param {function(gapi.drive.realtime.Error)} closure
 * @private
 */
colab.drive.NotebookModel.prototype.handleReadOnlyDocument_ =
    function(response, error, closure) {
  // TODO(kestert): refactor to use colab.Error class.
  var new_error = /** @type {gapi.drive.realtime.Error} */ ({
    'message': 'This file was not created via coLab. Its' +
      ' metadata needs to be modified for realtime support. <br> <br>' +
      ' Please ask the owner to open this file in ' +
      ' colab so it can be set up properly.' +
      ' It will remain compatible with ipynb and it will be compatible ' +
      ' with readonly viewers. <br/>' +
      ' Alternatively you can clone this file through menu.',
    'original_error': error });
  this.offlineTitle_ = colab.drive.getTitleFromMetadataResponse_(response);
  this.fileDriveUrl_ = response.alternateLink;
  closure(new_error);
};

/**
 * Handle realtime error after document has loaded
 * @param {gapi.drive.realtime.Error} error The realtime error that occured.
 * @private
 */
colab.drive.NotebookModel.prototype.handleRealtimeError_ = function(error) {
  console.error(error);

  // Don't display anything if the document is already closing
  if (this.isClosing_) return;

  if (error.isFatal) {
    var reason = 'The realtime API gave the following error: ' + error.message +
        '.  You must reload this document.';
    colab.onDocumentInvalidation('Fatal Realtime API Error', reason);
    return;
  }

  if (error.type === gapi.drive.realtime.ErrorType.TOKEN_REFRESH_REQUIRED) {
    // In app mode, token should be refreshed by the parent window,
    // so something has gone wrong if we get to here
    if (colab.app.appMode) {
      // TODO(kestert): inform user that token need to be refreshed.
      return;
    }

    // Attempt to refresh token
    colab.drive.authorize(function() {}, function(reason) {
      colab.onDocumentInvalidation('Failed to get an OAuth token',
          'See console for details.');
      console.log(reason);
    });
  }
};

/**
 * Checks if the document is readonly, and if so returns appropriate
 * message into callback. Otherwise passes error into calblack
 *
 * @private
 * @param {gapi.drive.realtime.Error} error
 * @param {function(gapi.drive.realtime.Error)} closure
 */
colab.drive.NotebookModel.prototype.checkIfReadOnly_ =
    function(error, closure) {
  var that = this;
  gapi.client.drive.files.get({ 'fileId': this.fileId_ })
      .execute(function(response) {
    if (response && !response.error && !response.editable) {
      that.handleReadOnlyDocument_(response, error, closure);
    } else {
     closure(error);
    }
  });
};

/**
 * Opens a new window with drive viwer for the current document
 *
 */
colab.drive.NotebookModel.prototype.openDriveViewer = function() {
  window.open(this.fileDriveUrl_);
};


/**
 * Forces saving of a document to offline format into fileId
 *
 * @param {function(Object)} onSave success handler. response is null
 *   if save was not needed
 * @param {function(?)} onError error handler
 * @param {Object=} opt_params extra parameters.
 * @private
 */
colab.drive.NotebookModel.prototype.saveInternal_ = function(onSave, onError,
    opt_params) {
  var that = this;
  // If parameters are provided, force saving.
  if (!this.isDirty_ && !opt_params) {
    onSave(null);
    return;
  }

  var model = this.document_.getModel();
  var data = colab.nbformat.convertRealtimeToJsonNotebook(this.getTitle(),
      model);
  var newTitle = this.getTitle();
  this.offlineTitleChangePending_ = this.offlineTitle_ != newTitle;
  var metadata = {
    'title': this.offlineTitleChangePending_ ? newTitle : undefined,
    'description': 'IP[y] file',
    'mimeType': colab.drive.NEW_NOTEBOOK_MIMETYPE
  };

  colab.drive.uploadToDrive(data, metadata, function(response) {
    that.isDirty_ = false;
    that.numFailedSaveAttempts_ = 0;

    var oldTitle = colab.drive.offlineTitle;
    that.updateDocumentMetadata_(response);
    if (colab.drive.offlineTitle != oldTitle) {
      console.log('Updating title due external change: new title ',
                  colab.drive.offlineTitle, 'old title: ', oldTitle);
      if (!that.offlineTitleChangePending_) {
        // Only update if it is not our change.
        // Since if it our change, user might be typing right now...
        that.setTitle(that.offlineTitle_);
      }
    }

    onSave(response);
  }, onError, this.fileId_, opt_params);
};


/**
 * Loads a realtime document from Google Drive.
 *
 * @param {function()} onLoad callback for
 *    successful load.  This function is
 *     passed a single argument, which is the realtime document that has been
 *     loaded.
 * @param {function(Object)} onError callback for an error loading the document.
 * callback for a realtime error after the document has loaded.
 */
colab.drive.NotebookModel.prototype.load = function(onLoad, onError) {
  var that = this;

  var onLoadCallback = function(document) {
    that.document_ = document;
    var model = document.getModel();
    // We have a newly created notebook, so initialize by loading the Drive
    // file.
    var request = gapi.client.drive.files.get({ 'fileId': that.fileId_ });

    var isReadOnly = model.isReadOnly;
    that.permissions_ = new colab.drive.Permissions(!isReadOnly, !isReadOnly);

    request.execute(function(response) {
      if (!response || response['error']) {
        onError(new colab.error.GapiError(response ? response['error'] : null));
        return;
      }

      var resource = /** @type {gapi.client.drive.files.Resource} */ (response);

      that.updateDocumentMetadata_(resource);
      // The offline title takes priority, since it might have changed.
      that.setTitle(that.offlineTitle_);
      // If notebook has cells, this indicates that the realtime doc hasn't
      // been newly created or created as a result of invalidation.  Therefore
      // there is no need to load from the underlying file.
      if (model.getRoot().get('cells') != null) {
        colab.drive.createModelUUID(model, that.fileId_);
        onLoad();
        return;
      }

      // Sends request to load file to drive.
      var token = gapi.auth.getToken()['access_token'];
      var xhrRequest = new XMLHttpRequest();
      xhrRequest.open('GET', response['downloadUrl'], true);
      xhrRequest.setRequestHeader('Authorization', 'Bearer ' + token);
      xhrRequest.onreadystatechange = function(e) {
        if (xhrRequest.readyState == 4) {
          if (xhrRequest.status == 200) {
            colab.nbformat.convertJsonNotebookToRealtime(
                xhrRequest.responseText, model);
            // Create a UUID for this notebook, and store it in both the
            // realtime doc and the file's metadata.
            colab.drive.createModelUUID(model, that.fileId_);
            onLoad();
          } else {
            console.error(xhrRequest);
            onError(xhrRequest);
          }
        }
      };
      xhrRequest.send();
    });
  };

  // This is needed in the error handler passed to gapi.drive.realtime.load,
  // in order to determine whether the error occurs during the load or not.
  var isLoaded = false;

  colab.drive.driveApiReady.then(function() {
    gapi.drive.realtime.load(that.fileId_, function(document) {
      isLoaded = true;
      onLoadCallback(document);
    }, function() {}, function(error) {
      if (!isLoaded) {
        colab.drive.checkIfReadOnly_(that.fileId_, error, onError);
      } else {
        that.handleRealtimeError_(error);
      }
    });
  }, function(reason) {
    onError(/** @type {Object} */(reason));
  });
};


/**
 * Saves the realtime Document to a Google Drive file in ipynb format.
 *
 * This will save to drive, even if the file on Drive has been overwritten
 * by another app.  However, all versions will be available on Drive through
 * the revisions manager.
 *
 * @param {function(Object)} onSave callback for successful save.
 *     null if save is not needed.
 * @param {function(Object)} onError callback for an error loading the document.
 * @param {Object} opt_params parameters for upload (currently
 *   supported 'pinned')
 */
colab.drive.NotebookModel.prototype.save =
    function(onSave, onError, opt_params) {
  if (this.isClosed_) {
    onSave(null);
  }
  var userOnError = onError;
  onError = function(reason) {
    this.numFailedSaveAttempts_++;
    userOnError(reason);
  };

  this.saveInternal_(onSave, onError, opt_params);
};


/**
 * Clones the document, and calls onSuccess or opt_onError
 * upon completion.
 * @param {function(Object)} onSuccess takes response object
 * @param {function(colab.Error)=} opt_onError takes response object, if
 *    not provided, just logs the error on the console
 */
colab.drive.NotebookModel.prototype.clone = function(onSuccess, opt_onError) {
  var body = {
    'title': 'Copy of ' + goog.dom.getElement('doc-name').value,
    'parents': [{'id': colab.drive.rootFolderId }]
  };
  var request = gapi.client.drive.files.copy({
    'fileId': this.fileId_,
    'resource': body
  });
  request.execute(function(response) {
    if (!response || response['error']) {
      if (opt_onError) {
        opt_onError(
            new colab.error.GapiError(response ? response['error'] : null));
      } else {
        console.error(response);
      }
      return;
    }
    onSuccess(response);
  });
};


/**
 * Closes the document
 * @param {function(Object=)=} callback takes opt_response object or undefined
 */
colab.drive.NotebookModel.prototype.close = function(callback) {
  // TODO(sandler): should we chain callback?
  if (this.isClosing_) return;
  colab.notification.showPrimary('Closing \'' +
      colab.drive.offlineTitle + '\'', -1);
  this.isClosing_ = true;
  var handler = function(response) {
    if (response && response.error) {
      console.log(response);
      // Fall through, since we still need to close
    }

    if (this.document_) {
      this.document_.close();
    }
    colab.notification.clearPrimary();
    this.isClosed_ = true;
    this.isClosing_ = false;
    if (callback) {
      callback();
    }
  };
  if (!this.document_ || this.isClosed_) {
    handler(null);
    return;
  }
  this.save(handler, handler);
};



/**
 * Name of newly created notebook files.
 * @type {string}
 */
colab.drive.NEW_NOTEBOOK_TITLE = 'Untitled';

/**
 * Extension for notebook files.
 * @type {string}
 */
colab.drive.NOTEBOOK_EXTENSION = 'ipynb';


/**
 * Mimetype of newly created notebook files.
 * @type {string}
 */
colab.drive.NEW_NOTEBOOK_MIMETYPE = 'application/colab';

/**
 * todo(kestert): Should we keep those separate?
 * @type {string}
 */
colab.drive.NOTEBOOK_MIMETYPE = 'application/colab';

/**
 * OAuth 2.0 scope for opening and creating files.
 * @const
 */
colab.drive.FILE_SCOPE = 'https://www.googleapis.com/auth/drive';

/**
 * This client is from the same project that is used by chromeapp
 * https://console.developers.google.com/project/apps~windy-ellipse-510/apiui/credential
 */
colab.drive.NEW_CLIENT_ID = '911569945122-hpps2slo3mri3uk7lpc032vfudausme9' +
    '.apps.googleusercontent.com';

/**
 * Google cloud services client id. Found in the project console for CoLab
 * Sandbox.
 */
colab.drive.INSTALL_CLIENT_ID = '26410270374-q0d0ap400g3mescci580rj5449tg2iq9' +
    '.apps.googleusercontent.com';

/**
 * Use this until we implement saving into binary format, or else, we will lose
 * all existing content. After saving is implemented, switch to use
 * NEW_CLIENT_ID.
 *
 * TODO(sandler): this will still lose data that was not accessed in the
 * interval
 * between saving and client_id switch happened. Perhaps we should have &recover
 * option to be able to switch to old client_id for a session.
 */
colab.drive.CLIENT_ID = colab.params.getHashParams().legacyClient ?
    colab.drive.INSTALL_CLIENT_ID : colab.drive.NEW_CLIENT_ID;


/**
 * Google Drive SDK app id.
 *
 * @type {string}
 */
colab.APP_ID = '26410270374';


/**
 * Boundary for multipart uploads
 * @type {string}
 */
colab.drive.MULTIPART_BOUNDARY = '-------314159265358979323846';

/**
 * Callback for loading of the google client API script loaded as
 * a script tag in index.html.
 */
colab.drive.onClientLoad = function() {
    gapi.load('auth:client,drive-realtime,drive-share',
        colab.drive.clientLoadedResolve);
};

/**
 * @type {?function(?)} a resolve callback for clientLoaded promise
 */
colab.drive.clientLoadedResolve = null;

goog.exportSymbol('onClientLoad', colab.drive.onClientLoad);
/**
 * Promise that is fullfilled when google client APIs load
 * @type {goog.Promise}
 */
colab.drive.clientLoaded = new goog.Promise(function(resolve, reject) {
  colab.drive.clientLoadedResolve = resolve;
});


/**
 * A promise that is resolved when the Google Drive client API loads
 * @type {goog.Promise}
 */
colab.drive.apiLoaded = new goog.Promise(function(resolve, reject) {
  colab.drive.clientLoaded.then(function() {
    gapi.client.load('drive', 'v2', resolve);
  });
});

/**
 * @type {gapi.client.plus.PeopleGetResponse}
 */
colab.drive.myInfo = null;

colab.drive.clientLoaded.then(function() {
  gapi.client.load('plus', 'v1', function() {
    colab.drive.authorized.then(function() {
      var request = gapi.client.plus.people.get({
       'userId' : 'me'
      });
      request.execute(function(response) {
        colab.drive.myInfo =
            /** @type {gapi.client.plus.PeopleGetResponse} */ (response);
      });
    });
  });
});

/**
 * Authorize using Google OAuth API.
 *
 * @param {function()} onSuccess Callback for success
 * @param {function(string)} onFailure Callback for success
 * @param {boolean} opt_withPopup If true, display popup without first trying
 *     to authorize without a popup.
 */
colab.drive.authorize = function(onSuccess, onFailure, opt_withPopup) {
  var doAuthorize = function() {
    gapi.auth.authorize({
      'client_id': colab.drive.CLIENT_ID,
      'scope': ['email', colab.drive.FILE_SCOPE],
      'immediate': !opt_withPopup
    }, function(response) {
      if (!response || response['error']) {
        if (opt_withPopup) {
          onFailure(response ? response['error'] : null);
        } else {
          colab.drive.authorize(onSuccess, onFailure, true);
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
  dialog.setContent('Click OK to launch the authorization popup window.');
  dialog.setTitle('Authorization Needed');
  dialog.setButtonSet(goog.ui.Dialog.ButtonSet.createOk());

  goog.events.listen(dialog, goog.ui.Dialog.EventType.SELECT, function(e) {
    doAuthorize();
  });
  dialog.setVisible(true);
};


/**
 * A promise that is resolved when the Google Drive auth is done
 * @type {goog.Promise}
 */
colab.drive.authorized = new goog.Promise(function(resolve, reject) {
  if (colab.app.appMode) {
    // In app mode, set auth token that is passed in by postMessage
    var receivedToken = false;
    colab.app.addChromeAppListener(function(data, metadata) {
      if (data.token) {
        gapi.auth.setToken({'access_token': data.token});
        if (!receivedToken) {
          // TODO(kestert): Should this be reject?
          resolve(null);
          receivedToken = true;
        }
      }
    });
  } else {
    colab.drive.clientLoaded.then(function() {
      // In web mode, use standard OAuth flow.
      colab.drive.authorize(/**@type {function()} */ (resolve), reject);
      // Refresh OAuth token every 40 minutes.
      window.setInterval(function() {
        colab.drive.authorize(function() {}, function(reason) {
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
colab.drive.driveApiReady = goog.Promise.all(
    [colab.drive.apiLoaded, colab.drive.authorized]);

/**
 * @type {?string}
 */
colab.drive.rootFolderId = null;

/**
 * Contains id of this user permission
 * @type {?string}
 */
colab.drive.userPermissionId = '';

colab.drive.driveApiReady.then(function() {
  var request = gapi.client.drive.about.get();
  request.execute(function(resp) {
    colab.drive.rootFolderId = resp['rootFolderId'];
    colab.drive.userPermissionId = resp['user']['permissionId'];
  });
});

/**
 * Uploads a notebook to Drive, either creating a new one or saving an
 * existing one.
 *
 * @param {string} data The file contents as a string
 * @param {Object} metadata File metadata
 * @param {function(gapi.client.drive.files.Resource)} onSuccess callback for
 *     success
 * @param {function(?):?} onError callback for error, takes response object
 * @param {string=} opt_fileId file Id.  If false, a new file is created.
 * @param {Object?} opt_params
 */
colab.drive.uploadToDrive = function(data, metadata, onSuccess, onError,
                                     opt_fileId, opt_params) {
  var params = opt_params || {};
  var delimiter = '\r\n--' + colab.drive.MULTIPART_BOUNDARY + '\r\n';
  var close_delim = '\r\n--' + colab.drive.MULTIPART_BOUNDARY + '--';
  var body = delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + colab.drive.NOTEBOOK_MIMETYPE + '\r\n' +
      '\r\n' +
      data +
      close_delim;

  var path = '/upload/drive/v2/files';
  var method = 'POST';
  if (opt_fileId) {
    path += '/' + opt_fileId;
    method = 'PUT';
  }

  colab.drive.driveApiReady.then(function() {
    var request = gapi.client.request({
      'path': path,
      'method': method,
      'params': {'uploadType': 'multipart', 'pinned' : params['pinned']},
      'headers': {
        'Content-Type': 'multipart/mixed; boundary="' +
            colab.drive.MULTIPART_BOUNDARY + '"'
      },
      'body': body
    });
    request.execute(function(response) {
      if (!response || response['error']) {
        onError(new colab.error.GapiError(response ? response['error'] : null));
        return;
      }

      onSuccess(/** @type {gapi.client.drive.files.Resource} */ (response));
    });
  }, onError);
};

/**
 * Obtains the filename that should be used for a new file in a given folder.
 * This is the next file in the series Untitled0, Untitled1, ... in the given
 * drive folder.  As a fallback, returns Untitled.
 *
 * @param {function(string)} callback Called with the name for the new file.
 * @param {string=} opt_folderId optinal Drive folder Id to search for
 *     filenames.  Uses root, if none is specified.
 */
colab.drive.getNewFilename = function(callback, opt_folderId) {
  /** @type {string} */
  var folderId = opt_folderId || 'root';
  var query = 'title contains \'' + colab.drive.NEW_NOTEBOOK_TITLE + '\'' +
      ' and \'' + folderId + '\' in parents' +
      ' and trashed = false';
  var request = gapi.client.drive.files.list({
    'maxResults': 1000,
    'folderId' : folderId,
    'q': query
  });

  request.execute(function(response) {
    // Use 'Untitled.ipynb' as a fallback in case of error
    var fallbackFilename = colab.drive.NEW_NOTEBOOK_TITLE + '.' +
        colab.drive.NOTEBOOK_EXTENSION;
    if (!response || response['error']) {
      callback(fallbackFilename);
      return;
    }

    var files = response['items'] || [];
    var existingFilenames = goog.array.map(files, function(filesResource) {
      return filesResource['title'];
    });

    // Loop over file names Untitled0, ... , UntitledN where N is the number of
    // elements in existingFilenames.  Select the first file name that does not
    // belong to existingFilenames.  This is guaranteed to find a file name
    // that does not belong to existingFilenames, since there are N + 1 file
    // names tried, and existingFilenames contains N elements.
    for (var i = 0; i <= existingFilenames.length; i++) {
      /** @type {string} */
      var filename = colab.drive.NEW_NOTEBOOK_TITLE + i + '.' +
          colab.drive.NOTEBOOK_EXTENSION;
      if (existingFilenames.indexOf(filename) == -1) {
        callback(filename);
        return;
      }
    }

    // Control should not reach this point, so an error has occured
    callback(fallbackFilename);
  });
};

/**
 * Creates a new Notebook file in Drive, and calls either onSuccess, with
 * the fileId, or onError with an error.
 *
 * This function creates a file on Drive, but not a realtime document.
 * TODO(kestert): make this a valid notebook file, not an empty file.
 *
 * @param {function(Object)} onSuccess callback for success
 * @param {function(Object)} onError callback for error
 * @param {string=} opt_folderId optional Drive folder ID to create file in.
 */
colab.drive.createNewNotebook = function(onSuccess, onError, opt_folderId) {
  colab.drive.getNewFilename(function(newFilename) {
    var parents = [];
    if (opt_folderId) {
      parents.push({id: opt_folderId});
    }

    // String containing file contents for a new notebook.
    var data = colab.nbformat.createEmptyJsonNotebook(newFilename);

    var metadata = {
      'parents': parents,
      'title': newFilename,
      'description': 'IP[y] file',
      'mimeType': colab.drive.NEW_NOTEBOOK_MIMETYPE,
      'colabVersion': colab.nbformat.COLAB_VERSION
    };
    colab.drive.uploadToDrive(data, metadata, onSuccess, onError);
  }, opt_folderId);
};


/**
 * Creates a UUID (if the realtime doc doesn't have one already)
 * and saves this in the model and also the file.
 *
 * @param {gapi.drive.realtime.Model} model realtime model
 * @param {string} fileId the file Id for the drive file
 */
colab.drive.createModelUUID = function(model, fileId)  {
  if (!model.isReadOnly) {
    if (model.getRoot().get('metadata') == null) {
      model.getRoot().set('metadata', model.createMap());
    }
    var metadata = model.getRoot().get('metadata');
    if (metadata.get('UUID') == null) {
      metadata.set('UUID', (new Date()) + '');
    }
    var uuid = metadata.get('UUID');
    var request = gapi.client.drive.properties.insert({
        'fileId': fileId,
        'resource': {'key': 'UUID', 'value': uuid, 'visibility': 'PUBLIC'}
    });
    request.execute(function(response) {
      if (!response || response['error']) {
        console.log('Error saving UUID to file');
      }
    });
  }
};

/**
 * Checks that the UUID stored in the model is the same as the one on drive
 * @param {gapi.drive.realtime.Model} model realtime model
 * @param {string} fileId file Id of file on drive
 * @param {function(boolean)} onFoundUUIDs if both UUIDs are found, calls with
 *     boolean argument indicating whether they match or not.
 * @param {function((Object|string))} onError callback for no match
 */
colab.drive.checkModelUUID = function(model, fileId, onFoundUUIDs, onError) {
  var metadata = model.getRoot().get('metadata');
  var uuid = metadata && metadata.get('UUID');
  if (!uuid) {
    onError('Error getting document UUID');
    return;
  }

  var request = gapi.client.drive.properties.get({
    'fileId': fileId,
    'propertyKey': 'UUID',
    'visibility': 'PUBLIC'
  });
  request.execute(function(response) {
    if (!response || response['error']) {
      onError(new colab.error.GapiError(response ? response['error'] : null));
      return;
    }

    onFoundUUIDs(response.value == uuid);
  });
};

/**
 * @param {gapi.client.drive.files.Resource} response
 * @return {string}
 * @private
 */
colab.drive.getTitleFromMetadataResponse_ = function(response) {
  return response.title || response.originalFilename;
};

/**
 * @param {string} fileId
 * @param {gapi.client.drive.files.Resource} response
 * @param {gapi.drive.realtime.Error} error
 * @param {function(gapi.drive.realtime.Error)} closure
 * @private
 */
colab.drive.handleReadOnlyDocument_ = function(fileId, response, error,
    closure) {
  var new_error = /** @type {gapi.drive.realtime.Error} */ ({
    'message': 'This file was not created via coLab. Its' +
      ' metadata needs to be modified for realtime support. <br> <br>' +
      ' Please ask the owner to open this file in ' +
      ' colab so it can be set up properly.' +
      ' It will remain compatible with ipynb and it will be compatible ' +
      ' with readonly viewers. <br/>' +
      ' Alternatively you can clone this file through menu.',
    'original_error': error });
  colab.drive.offlineTitle = colab.drive.getTitleFromMetadataResponse_(
      response);
  colab.drive.fileDriveUrl_ = response.alternateLink;
  closure(new_error);
};

/**
 * Checks if the document is readonly, and if so returns appropriate
 * message into callback. Otherwise passes error into calblack
 *
 * @private
 * @param {string} fileId
 * @param {gapi.drive.realtime.Error} error
 * @param {function(gapi.drive.realtime.Error)} closure
 */
colab.drive.checkIfReadOnly_ = function(fileId, error, closure) {
  gapi.client.drive.files.get({ 'fileId': fileId }).execute(function(response) {
    if (response && !response.error && !response.editable) {
      colab.drive.handleReadOnlyDocument_(fileId,
         response, error, closure);
    } else {
     closure(error);
    }
  });
};


/**
 * Creates title element
 * @param {gapi.drive.realtime.Model} model
 * @return {gapi.drive.realtime.CollaborativeString} returns null if fails
 */
colab.drive.createTitle = function(model) {
  var title = /** @type {gapi.drive.realtime.CollaborativeString} */
      (model.getRoot().get('title'));
  if (!title || !title.setText) {
    if (model.isReadOnly) return null;
    title = model.createString();
    model.getRoot().set('title', title);
  }
  return title;
};

/**
 * This is the notebook created in the promise below.  It should be avoided
 * and eventually removed, but it is useful to have the notebook object
 * in case the load process failed so the promise below is not fullfilled.
 */
colab.drive.globalNotebook = null;

/**
 * Promise fullfilled with Notebook object when it is loaded.
 * The constructor attempts to load or create the realtime document based on
 * the hash parameters of this window.
 *
 * @type {goog.Promise.<colab.drive.NotebookModel>}
 */
colab.drive.notebook = new goog.Promise(function(resolve, reject) {
  var params = colab.params.getHashParams();

  var load = function(fileId) {
    var notebook = new colab.drive.NotebookModel(fileId);
    colab.drive.globalNotebook = notebook;
    notebook.load(function() {
      notebook.setModelChangeListener();
      resolve(notebook);
    }, reject);
  };

  if (params.fileId) {
    // Load the notebook realtime document, and resolve
    // colab.globalRealtimeDoc with this document.
    console.log('Loading notebook from Google Drive.');
    load(params.fileId);
  } else if (params.create) {
    console.log('Creating new notebook in Google Drive.');
    colab.drive.driveApiReady.then(function() {
      colab.drive.createNewNotebook(function(response) {
        var fileId = response.id;
        // Change hash param to correspond to newly created notebook, preserving
        // all hash params except those used to create the file.
        // NOTE: this doesn't cause reload because we stay on same page
	delete params['create'];
	delete params['folderId'];
	params['fileId'] = fileId;
	window.location.hash = '#' + colab.params.encodeParamString(params);
        load(fileId);
      }, reject, params.folderId);
    });
  } else if (params.fileIds) { // redirect to drive
    colab.params.redirectToNotebook({fileId: params.fileIds});
    load(params.fileIds);
  } else if (window.location.search.indexOf('state=') >= 0) {
    window.location.pathname = '/v2/drive';
  } else { // redirect to main page.
    colab.drive.authorized.then(function() {
      colab.filepicker.selectFileAndReload();
    });
    //window.location.href = '/v2/';
  }
});
