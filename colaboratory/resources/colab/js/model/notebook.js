/**
 *
 * @fileoverview Model object encapsulating the realtime document.
 *
 */


goog.provide('colab.model.Notebook');

goog.require('colab.ErrorEvent');
goog.require('colab.app');
goog.require('colab.drive');
goog.require('colab.drive.ApiWrapper');
goog.require('colab.drive.Permissions');
goog.require('colab.error.GapiError');
goog.require('colab.error.GapiRealtimeError');
goog.require('colab.nbformat');
goog.require('colab.notification');
goog.require('goog.dom');
goog.require('goog.events.Event');
goog.require('goog.events.EventTarget');



/**
 * A wrapper for a Notebook model object.
 *
 * @param {string} fileId Google Drive File Id of file
 * @constructor
 * @extends {goog.events.EventTarget}
 */
colab.model.Notebook = function(fileId) {
  goog.base(this);

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

  /** @private {!colab.drive.Permissions} */
  this.permissions_;

  /** @private {string} */
  this.fileDriveUrl_ = '';

  /** @private {string} */
  this.title_ = '';

  /**
   * @private {boolean} Whether the realtime doc is shared with anyone.
   * For security reasons, this is assumed true by default.
   */
  this.isShared_ = true;
};
goog.inherits(colab.model.Notebook, goog.events.EventTarget);


/**
 * @return {string} The Google Drive File Id of this notebook
 */
colab.model.Notebook.prototype.getFileId = function() {
  return this.fileId_;
};


/**
 * @return {gapi.drive.realtime.Document} The Realtime document.
 */
colab.model.Notebook.prototype.getDocument = function() {
  return this.document_;
};


/**
 * @return {!colab.drive.Permissions} Permissions of the notebook
 */
colab.model.Notebook.prototype.getPermissions = function() {
  return this.permissions_;
};


/**
 * @return {boolean} Whether the document is shared by other users.
 */
colab.model.Notebook.prototype.isShared = function() {
  return this.isShared_;
};


/**
 * @return {string} The URL to open the file in the Google Drive web interface.
 */
colab.model.Notebook.prototype.fileDriveUrl = function() {
  return this.fileDriveUrl_;
};


/**
 * @return {Object} A realtime object that acts as a sentinel for comments
 *    changes.
 */
colab.model.Notebook.prototype.getCommentSentinel = function() {
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
 * @private
 */
colab.model.Notebook.prototype.setModelChangeListener_ = function() {
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
 * Initaliazes the part of the realtime document that keeps track of the
 * document title.  This is initially set to the offline title
 */
colab.model.Notebook.prototype.initializeTitle = function() {
  var model = this.document_.getModel();
  var title = /** @type {gapi.drive.realtime.CollaborativeString} */
      (model.getRoot().get('title'));
  if (!title || !title.getText) {
    // If no title exists, create one, using this.offlineTitle_ as the value
    title = model.createString(this.offlineTitle_);
    model.getRoot().set('title', title);
  } else if (!model.isReadOnly) {
    // Otherwise set the title to this.offlineTitle_
    title.setText(this.offlineTitle_);
  }
  this.title_ = this.offlineTitle_;

  // Add event listener
  title.addEventListener(
      gapi.drive.realtime.EventType.OBJECT_CHANGED, function() {
        this.title_ = title.getText();
        this.dispatchEvent(
            new colab.model.Notebook.TitleChangedEvent(this.title_));
      });
};


/**
 * Sets the title of the document
 * @param {string} newTitle new file name.
 */
colab.model.Notebook.prototype.setTitle = function(newTitle) {
  var model = this.document_.getModel();
  if (model.isReadOnly) { return; }
  var title = /** @type {gapi.drive.realtime.CollaborativeString} */
      (model.getRoot().get('title'));
  if (!title) return;
  title.setText(newTitle);
};


/**
 * Gets the title of the document
 * @return {string} title of the document.
 */
colab.model.Notebook.prototype.getTitle = function() {
  return this.title_;
};


/**
 * @param {gapi.client.drive.files.Resource} resource
 * @private
 */
colab.model.Notebook.prototype.updateDocumentMetadata_ =
    function(resource) {
  this.fileDriveUrl_ = resource.alternateLink;
  this.offlineTitle_ = resource.title || resource.originalFilename;
  // if shared is absent or not false, assume shared.
  this.isShared_ = !(resource.shared == false);
};


/**
 * @param {gapi.client.drive.files.Resource} response
 * @param {gapi.drive.realtime.Error} error
 * @param {function(gapi.drive.realtime.Error)} closure
 * @private
 */
colab.model.Notebook.prototype.handleReadOnlyDocument_ =
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
  this.updateDocumentMetadata_(response);
  closure(new_error);
};


/**
 * Handle realtime error after document has loaded
 * @param {gapi.drive.realtime.Error} error The realtime error that occured.
 * @private
 */
colab.model.Notebook.prototype.handleRealtimeError_ = function(error) {
  var that = this;
  console.error(error);

  // Don't display anything if the document is already closing
  if (this.isClosing_) return;

  if (error.isFatal) {
    this.dispatchEvent(new colab.ErrorEvent(
        colab.model.Notebook.EventType.FATAL_REALTIME_ERROR,
        new colab.error.GapiRealtimeError(error)));
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
    colab.drive.ApiWrapper.getInstance().authorize(function() {},
        function(error) {
          that.dispatchEvent(new colab.ErrorEvent(
              colab.model.Notebook.EventType.OAUTH_ERROR,
              error));
        });
  }
};


/**
 * Checks if the document is readonly, and if so returns appropriate
 * message into callback. Otherwise passes error into callback
 *
 * @private
 * @param {gapi.drive.realtime.Error} error
 * @param {function(gapi.drive.realtime.Error)} closure
 */
colab.model.Notebook.prototype.checkIfReadOnly_ =
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
colab.model.Notebook.prototype.openDriveViewer = function() {
  if (colab.app.appMode) {
    colab.app.postMessage('launch_browser_tab', {'url': this.fileDriveUrl_});
  } else {
    window.open(this.fileDriveUrl_);
  }
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
colab.model.Notebook.prototype.saveInternal_ = function(onSave, onError,
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
  var offlineTitleChangePending = this.offlineTitle_ != newTitle;
  var metadata = {
    'title': offlineTitleChangePending ? newTitle : undefined,
    'description': 'IP[y] file',
    'mimeType': colab.drive.NOTEBOOK_MIMETYPE
  };

  colab.drive.uploadToDrive(data, metadata, function(response) {
    that.isDirty_ = false;
    that.numFailedSaveAttempts_ = 0;

    var oldTitle = that.offlineTitle_;
    that.updateDocumentMetadata_(response);
    if (that.offlineTitle_ != oldTitle) {
      console.log('Updating title due external change: new title ',
                  that.offlineTitle_, 'old title: ', oldTitle);
      if (!offlineTitleChangePending) {
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
colab.model.Notebook.prototype.load = function(onLoad, onError) {
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
      // Set the title of the realtime document
      that.initializeTitle();
      // If notebook has cells, this indicates that the realtime doc hasn't
      // been newly created or created as a result of invalidation.  Therefore
      // there is no need to load from the underlying file.
      if (model.getRoot().get('cells')) {
        colab.drive.createModelUUID(model, that.fileId_);
        that.setModelChangeListener_();
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
            that.setModelChangeListener_();
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

  // TODO(kestert): check that we need to wait here.
  colab.drive.ApiWrapper.getInstance().driveApiReady.then(function() {
    gapi.drive.realtime.load(that.fileId_, function(document) {
      isLoaded = true;
      onLoadCallback(document);
    }, function() {}, function(error) {
      if (!isLoaded) {
        that.checkIfReadOnly_(error, onError);
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
 * @param {Object=} opt_params parameters for upload (currently
 *   supported 'pinned')
 */
colab.model.Notebook.prototype.save =
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
colab.model.Notebook.prototype.clone = function(onSuccess, opt_onError) {
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
 * @param {function(Object=)=} opt_callback takes opt_response object or
 *     undefined
 */
colab.model.Notebook.prototype.close = function(opt_callback) {
  // TODO(sandler): should we chain callback?
  if (this.isClosing_) return;
  colab.notification.showPrimary('Closing \'' +
      this.offlineTitle_ + '\'', -1);
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
    if (opt_callback) {
      opt_callback();
    }
  };
  if (!this.document_ || this.isClosed_) {
    handler(null);
    return;
  }
  this.save(handler, handler);
};



/**
 * Event for document title change.
 * @constructor
 * @param {string} title
 * @param {string=} opt_oldTitle
 * @extends {goog.events.Event}
 */
colab.model.Notebook.TitleChangedEvent = function(title, opt_oldTitle) {
  goog.base(this, colab.model.Notebook.EventType.TITLE_CHANGED);

  /** @type {string} */
  this.title = title;

  /** @type {string} */
  this.oldTitle = opt_oldTitle || '';
};
goog.inherits(colab.model.Notebook.TitleChangedEvent, goog.events.Event);


/**
 * Constants for event names.
 * @enum {string}
 */
colab.model.Notebook.EventType = {
  TITLE_CHANGED: 'title_changed',

  /**
   * Errors
   */
  FATAL_REALTIME_ERROR: 'fatal_realtime_error',
  OAUTH_ERROR: 'oauth_error'
};

