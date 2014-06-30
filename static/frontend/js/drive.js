/**
 *
 * @fileoverview Functions for dealing with Google Drive.
 *
 */

goog.provide('colab.drive');
goog.provide('colab.drive.Permissions');

goog.require('colab.app');
goog.require('goog.Promise');
goog.require('goog.format.JsonPrettyPrinter');

/**
 * Specifies edit and interaction permissions for the notebook.
 *
 * @param {boolean} editable Document is editable.
 * @param {boolean} opt_commentable Document allows commenting
 * @constructor
 */
colab.drive.Permissions = function(editable, opt_commentable) {
  this.editable_ = editable;
  this.commentable_ = opt_commentable;
};

/**
 * @return {boolean} true if notebook can be edited
 */
colab.drive.Permissions.prototype.isEditable = function() {
  return this.editable_;
};

/**
 * @return {boolean} true if notebook can be commented on
 */
colab.drive.Permissions.prototype.isCommentable = function() {
  return !!(this.editable_ || this.commentable_);
};

/**
 * Name of newly created notebook files.
 * @type {string}
 */
colab.drive.NEW_NOTEBOOK_TITLE = 'Untitled.ipynb';


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
colab.drive.NEW_CLIENT_ID = '911569945122-hpps2slo3mri3uk7lpc032vfudausme9'
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


/** @private {goog.format.JsonPrettyPrinter} */
colab.drive.JSON_FORMATTER_ = new goog.format.JsonPrettyPrinter(
     null /* use default to make js compiler happy */);


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
 * @type {goog.Promise}
 */
colab.drive.userInfoLoaded = new goog.Promise(function(resolve, reject) {
  colab.drive.clientLoaded.then(function() {
    gapi.client.load('plus', 'v1', resolve);
  });
});

/**
 * @type {gapi.client.plus.PeopleGetResponse}
 */
colab.drive.myInfo = null;

/**
 * @type {goog.Promise}
 */
colab.drive.userInfoPromise = new goog.Promise(function(resolve, reject) {
  colab.drive.userInfoLoaded.then(function() {
    colab.drive.authorized.then(function() {
    var request = gapi.client.plus.people.get({
       'userId' : 'me'
      });
    request.execute(function(json) {
      var resp = /** @type {gapi.client.plus.PeopleGetResponse} */(json);
      if (resp.error) {
       reject(resp.error);
       return;
      }
      resolve(resp);
      colab.drive.myInfo = resp;
    });
   });
  }, reject);
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
      if (response && !response['error']) {
        onSuccess();
      } else {
        if (opt_withPopup) {
          console.error(response);
          onFailure(response['error'] || '');
        } else {
          colab.drive.authorize(onSuccess, onFailure, true);
        }
      }
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
 * Resolver whose promise is fullfilled when the realtime doc's file ID
 * is known.
 *
 * @type {goog.promise.Resolver}
 */
colab.drive.fileId = goog.Promise.withResolver();

/**
 * contains fileID if available. Use only when it is guaranteed
 * that file has been resolved.
 */
colab.drive.fileIdIfAvailable = undefined;

/**
 * Contains url of the file on drive
 * @type {goog.promise.Resolver}
 */
colab.drive.fileDriveUrl = goog.Promise.withResolver();



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
 * Opens a new window with drive viwer for the current document
 *
 */
colab.drive.openDriveViewer = function() {
  colab.drive.fileDriveUrl.promise.then(function(url) {
    window.open(url);
  });
};

/**
 * Clones current document, and calls onSuccess or opt_onError
 * upon completion.
 * @param {function(Object)} onSuccess takes response object
 * @param {function(Object)=} opt_onError takes response object, if
 *    not provided, just logs the error on the console
 */
colab.drive.cloneDocument = function(onSuccess, opt_onError) {
  colab.drive.fileId.promise.then(function(fileId) {
    var body = {
      'title': 'Copy of ' + goog.dom.getElement('doc-name').value,
      'parents': [{'id': colab.drive.rootFolderId }]
    };
    var request = gapi.client.drive.files.copy({
      'fileId': fileId,
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
  });
};

/**
 * Uploads a notebook to Drive, either creating a new one or saving an
 * existing one.
 *
 * @param {string} data The file contents as a string
 * @param {Object} metadata File metadata
 * @param {function(Object)} onSuccess callback for success
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
      if (response && !response.error) {
        var res = /** @type {gapi.client.drive.files.Resource} */ (response);
        var oldTitle = colab.drive.offlineTitle;
        colab.drive.updateDocumentMetadata(res);
        if (colab.drive.offlineTitle != oldTitle) {
          console.log('Updating title due external change: new title ',
              colab.drive.offlineTitle, 'old title: ', oldTitle);
          if (!colab.drive.offlineTitleChangePending &&
              colab.globalRealtimeDoc) {
            // Only update if it is not our change.
            // Since if it our change, user might be typing right now...
            colab.drive.setTitle(colab.drive.offlineTitle);
          }
        }
        onSuccess(/** @type {Object} */ (response));
      } else {
        onError(/** @type {Object} */ (response || null));
      }
    });
  }, onError);
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
  var name = colab.drive.NEW_NOTEBOOK_TITLE;
  var parents = [];
  if (opt_folderId) {
    parents.push({id: opt_folderId});
  }

  // String containing file contents for a new notebook.
  var data = colab.drive.convertRealtimeToNotebook();

  var metadata = {
    'parents': parents,
    'title': name,
    'description': 'IP[y] file',
    'mimeType': colab.drive.NEW_NOTEBOOK_MIMETYPE
  };
  colab.drive.uploadToDrive(data, metadata, onSuccess, onError);
};


/**
 * Convert Notebook json from file format to in memory format. Mutates the input
 * argument.
 *
 * @param {JsonObject} json_nb The json object read from the notebook file.
 *   Changed by the function.
 */
colab.drive.convertFromIpynbFormat = function(json_nb) {
  var multiline_outputs = {
    'text': 0,
    'html': 0,
    'svg': 0,
    'latex': 0,
    'javascript': 0,
    'json': 0
  };

  // Implements functionality of IPython.nbformat.v3.rwbase.rejoin_lines
  var nb = /** @type {NotebookFormat.Notebook} */ (json_nb);
  for (var i = 0; i < nb.worksheets.length; i++) {
    var ws = nb.worksheets[i];
    for (var j = 0; j < ws['cells'].length; j++) {
      var cell = ws.cells[j];
      if (cell.cell_type === 'code') {
        if ('input' in cell && Array.isArray(cell.input)) {
          cell.input = cell.input.join('');
        }
        for (var k = 0; k < cell.outputs.length; k++) {
          var output = cell.outputs[k];
          for (var key in multiline_outputs) {
            if (key in output && Array.isArray(output[key])) {
              output[key] = output[key].join('');
            }
          }
        }
      } else {
        for (var key in {'source': 0, 'rendered': 0}) {
          if (key in cell && Array.isArray(cell[key])) {
            cell[key] = cell[key].join('');
          }
        }
      }
    }
  }
};


/**
 * Takes in notebook file content and saves it in the realtime model.
 *
 * @param {string} fileContents A string containing the notebook file contents.
 * @param {gapi.drive.realtime.Model} model The Realtime root model object.
 */
colab.drive.convertNotebookToRealtime = function(fileContents, model) {
  /** @type {NotebookFormat.Notebook} */
  var json = /** @type {NotebookFormat.Notebook} */ (goog.json.parse(
      fileContents));
  var worksheets = json.worksheets;
  var metadata = json.metadata; //
  colab.drive.convertFromIpynbFormat(json);
  // This is initialized from filename.
  // colab.drive.setTitle(metadata['name'], model);

  var cellFromJson = function(json) {
    var cell = model.createMap();
    if (json['cell_type'] == 'code') {
      cell.set('type', 'code');
      cell.set('text', model.createString(json['input']));
      cell.set('outputs', model.createList(json['outputs']));
    } else {
      cell.set('type', 'text');
      cell.set('text', model.createString(json['source']));
    }
    return cell;
  };

  var cells = model.createList();
  for (var i = 0; i < worksheets.length; i++) {
    cells.pushAll(
        goog.array.map(worksheets[i]['cells'], cellFromJson));
  }
  metadata = model.createMap();
  model.getRoot().set('cells', cells);
  model.getRoot().set('metadata', metadata);
};


/**
 * Takes a realtime model and returns a corresponding notebook file.
 * If no realtime model is provided, return an empty notebook file.
 *
 * @param {gapi.drive.realtime.Model} opt_model The Realtime root model object.
 * @return {string} Notebook file as string
 */
colab.drive.convertRealtimeToNotebook = function(opt_model) {
  var cellToJson = function(cell) {
    var json = {};
    var type = cell.get('type');
    if (type === 'code') {
      json['cell_type'] = 'code';
      json['input'] = cell.get('text').getText();
      json['outputs'] = cell.get('outputs').asArray();
      json['language'] = 'python';
    } else {
      json['cell_type'] = 'markdown'; // backwards compatibility with IPython
      json['source'] = cell.get('text').getText();
    }
    return json;
  };

  var cells = [];
  var name = colab.drive.NEW_NOTEBOOK_TITLE;
  if (opt_model) {
    cells = goog.array.map(opt_model.getRoot().get('cells').asArray(),
                           cellToJson);
    name = colab.drive.getTitle(opt_model);
  } else {
    cells.push({
      'cell_type': 'code',
      'input': '',
      'outputs': [],
      'language': 'python'
    });
  }

  var data = {
    'worksheets': [{'cells' : cells}],
    'metadata': {'name': name},
    'nbformat': 3,
    'nbformat_minor': 0
  };

  return colab.drive.JSON_FORMATTER_.format(data);
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
      if (!response || response.error) {
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
    if (!response || response.error) {
      onError(response);
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
 */
colab.drive.handleReadOnlyDocument = function(fileId, response, error,
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
  colab.drive.fileDriveUrlIfPresent = response.alternateLink;
  colab.drive.fileDriveUrl.resolve(response.alternateLink);
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
      colab.drive.handleReadOnlyDocument(fileId,
         response, error, closure);
    } else {
     closure(error);
    }
  });
};

/**
 * Whether the realtime doc is shared with anyone
 * Assume default state is shared
 */

colab.drive.documentShared = true;
/**
 * @param {gapi.client.drive.files.Resource} resource
 */
colab.drive.updateDocumentMetadata = function(resource) {
  colab.drive.fileDriveUrlIfPresent = resource.alternateLink;
  colab.drive.offlineTitle = colab.drive.getTitleFromMetadataResponse_(
      resource);
  // if shared is absent or not false, assume shared.
  colab.drive.documentShared = !(resource.shared == false);
};



/**
 * Loads a realtime document from Google Drive.
 *
 * @param {string} fileId The file ID to load.
 * @param {function(gapi.drive.realtime.Document)} onLoad callback for
 *    successful load.  This function is
 *     passed a single argument, which is the realtime document that has been
 *     loaded.
 * @param {function(Object)} onError callback for an error loading the document.
 * @param {function(gapi.drive.realtime.Error)} onRealtimeError
 * callback for a realtime error after the document has loaded.
 */
colab.drive.loadDocument = function(fileId, onLoad, onError, onRealtimeError) {

  var onLoadCallback = function(document) {
    var model = document.getModel();
    // We have a newly created notebook, so initialize by loading the Drive
    // file.
    var request = gapi.client.drive.files.get({ 'fileId': fileId });

    request.execute(function(response) {
      if (response.error) {
        console.error(response.error);
        onError(response.error);
        return;
      }
      var resource = /** @type {gapi.client.drive.files.Resource} */ (response);

      colab.drive.updateDocumentMetadata(resource);
      // The offline title takes priority, since it might have changed.
      colab.drive.setTitle(colab.drive.offlineTitle, model);
      colab.drive.fileDriveUrl.resolve(response['alternateLink']);
      // If notebook has cells, this indicates that the realtime doc hasn't
      // been newly created or created as a result of invalidation.  Therefore
      // there is no need to load from the underlying file.
      if (model.getRoot().get('cells') != null) {
        colab.drive.createModelUUID(model, fileId);
        onLoad(document);
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
            colab.drive.convertNotebookToRealtime(xhrRequest.responseText,
                model);
            // Create a UUID for this notebook, and store it in both the
            // realtime doc and the file's metadata.
            colab.drive.createModelUUID(model, fileId);
            onLoad(document);
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
    gapi.drive.realtime.load(fileId, function(document) {
      isLoaded = true;
      onLoadCallback(document);
    }, function() {}, function(error) {
      if (!isLoaded) {
        colab.drive.checkIfReadOnly_(fileId, error, onError);
      } else {
        onRealtimeError(error);
      }
    });
  }, function(reason) {
    onError(/** @type {Object} */(reason));
  });
};

/**
 * Contains whether realtime doc has diverged from underlying doc
 * @type {boolean}
 */
colab.drive.isDirty = false;

/**
 * If true, the document is closed and can't be accessed anymore
 * basically the only way to recover from this is to reload the page
 * @type {boolean}
 */
colab.drive.isClosed = false;

/**
 * Forces saving of a document to offline format into fileId
 *
 * @param {string} fileId drive file id
 * @param {Object} document realtimeDoc
 * @param {function(Object)} onSave success handler. response is null
 *   if save was not needed
 * @param {function(?)} onError error handler
 * @param {Object=} opt_params extra parameters.
 */
colab.drive.saveDocumentInternal = function(fileId,
    document, onSave, onError, opt_params) {
  // If parameters are provided, force saving.
  if (!colab.drive.isDirty && !opt_params) {
    onSave(null);
    return;
  }

  var data = colab.drive.convertRealtimeToNotebook(document.getModel());
  var newTitle = colab.drive.getTitle(document.getModel());
  /** @type {boolean} */
  colab.drive.offlineTitleChangePending = colab.drive.offlineTitle != newTitle;
  var metadata = {
    'title': colab.drive.offlineTitleChangePending ? newTitle : undefined,
    'description': 'IP[y] file',
    'mimeType': colab.drive.NEW_NOTEBOOK_MIMETYPE
  };

  colab.drive.uploadToDrive(data, metadata, function(response) {
    colab.drive.isDirty = false;
    colab.drive.numFailedSaveAttempts = 0;
    onSave(response);
  }, onError, fileId, opt_params);
};

/**
 * Contains number of failed save attempts since last succesful saveDocument
 */
colab.drive.numFailedSaveAttempts = 0;

/**
 * Saves a realtime Document to a Google Drive file in ipynb format.
 *
 * This will save to drive, even if the file on Drive has been overwritten
 * by another app.  However, all versions will be available on Drive through
 * the revisions manager.
 *
 * @param {Object} document The realtime docuemnt.
 * @param {function(Object)} onSave callback for successful save.
 *    null if save is not needed.
 * @param {function(Object)} onError callback for an error loading the document.
 * @param {Object} opt_params parameters for upload (currently
 *   supported 'pinned')
 */
colab.drive.saveDocument = function(document, onSave, onError, opt_params) {
  if (colab.drive.isClosed) {
    onSave(null);
  }
  var userOnError = onError;
  onError = function(reason) {
    colab.drive.numFailedSaveAttempts++;
    userOnError(reason);
  };

  colab.drive.fileId.promise.then(function(fileId) {
    colab.drive.saveDocumentInternal(fileId, document, onSave,
        onError, opt_params);
  });
};


/**
 * @type {string}
 */
colab.drive.offlineTitle = '';

/**
 * Get name of current file
 * @param {gapi.drive.realtime.Model} opt_model model to use to get the data.
 * If not provided uses globalRealTimeDoc.
 * @return {string} title of the document.
 */
colab.drive.getTitle = function(opt_model) {
  var doc = colab.globalRealtimeDoc;
  if (!doc && !opt_model) {
    return colab.drive.offlineTitle;
  }
  var model = opt_model || doc.getModel();
  var title = model.getRoot().get('title');
  if (title && title.getText) {
    var title_text = title.getText();
  }
  title_text = title_text || colab.drive.offlineTitle;
  title_text = title_text || colab.drive.NEW_NOTEBOOK_TITLE;
  return title_text;
};

/**
 * registers a listener to receive updates when title changes.
 * Does nothing if there is no realtime doc attached.
 * @param {function(string)} handler listener that receives title.
 */
colab.drive.onTitleChange = function(handler) {
  if (!colab.globalRealtimeDoc) return;
  var title = colab.drive.createTitle(colab.globalRealtimeDoc.getModel());
  if (title && title.addEventListener) {
    title.addEventListener(
       gapi.drive.realtime.EventType.OBJECT_CHANGED,
       function(event) {
         handler(event.target.getText());
       });
  }
};

/**
 * Sets the  name of current file.
 *
 * @param {string} newTitle new file name.
 * @param {gapi.drive.realtime.Model?} opt_model model to use to get the data.
 * If not provided uses realtimeDoc.getModel()
 */
colab.drive.setTitle = function(newTitle, opt_model) {
  var model = opt_model || colab.globalRealtimeDoc.getModel();
  if (model.isReadOnly) { return; }
  var title = colab.drive.createTitle(model);
  if (!title) return;
  title.setText(newTitle);
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
 * @type {gapi.drive.share.ShareClient}
 */
colab.drive.shareClient_;

/**
 * Open share dialog for the document.
 */
colab.drive.shareDocument = function() {
  colab.drive.fileId.promise.then(function(fileId) {
    if (!colab.drive.shareClient_) {
      colab.drive.shareClient_ = new gapi.drive.share.ShareClient(colab.APP_ID);
    }
    var shareClient = colab.drive.shareClient_;
    shareClient.setItemIds([fileId]);
    shareClient.showSettingsDialog();
    colab.drive.validateSharingDialog();
  });
};

/**
 * Keeps interval task for validation dialog
 * @type {number}
 */
colab.drive.validationDialogTask = 0;

/**
 * Validates that sharing dialog present itself.
 */
colab.drive.validateSharingDialog = function() {
  var SHARING_FAILED_CSS_PATH = 'body > ' +
     'div > div:contains("Sorry, sharing is unavailable")';

  var count = 0;
  if (colab.drive.validationDialogTask) {
    clearInterval(colab.drive.validationDialogTask);
    colab.drive.validationDialogTask = 0;
  }
  var fileViewerUrl = colab.drive.fileDriveUrlIfPresent;
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
      clearInterval(colab.drive.validationDialogTask);
      // Done here.
    }
  };
  colab.drive.validationDialogTask = setInterval(check, 300);
};


/**
 * Handle realtime error after document has loaded
 * @param {gapi.drive.realtime.Error} error The realtime error that occured.
 */
colab.drive.handleRealtimeError = function(error) {
  console.error(error);
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
 * Promise fullfilled with realtime Doc when it is loaded.
 * The constructor attempts to load or create the realtime document based on
 * the hash parameters of this window.
 *
 * @type {goog.Promise}
 */
colab.drive.document = new goog.Promise(function(resolve, reject) {
  var params = colab.params.getHashParams();

  var load = function(fileId) {
    colab.drive.fileId.resolve(fileId);
    colab.drive.fileIdIfAvailable = fileId;

    colab.drive.loadDocument(fileId, function(document) {
      colab.globalRealtimeDoc = document;
      colab.globalRealtimeDoc.getModel().getRoot().addEventListener(
         gapi.drive.realtime.EventType.OBJECT_CHANGED,
         function(event) {
           var root = colab.globalRealtimeDoc.getModel().getRoot();
           if (event.target == root.get('metadata')) {
             // Changes to metadata don't constitute changes to a document
             return;
           }
           if (!event.isLocal) {
             // Not local changes are handled by others. Don't mark outselves
             // dirty.
             return;
           }
           colab.drive.isDirty = true;
        });
      resolve(document);
    }, reject, colab.drive.handleRealtimeError);
  };

  if (params.fileId) {
    // Load the notebook realtime document, and resolve
    // colab.globalRealtimeDoc with this document.
    console.log('Loading notebook from Google Drive.');
    load(params.fileId);
  } else if (params.create) {
    console.log('Creating new notebook in Google Drive.');
    colab.drive.createNewNotebook(function(response) {
      var fileId = response.id;
      // Change hash param to correspond to newly created notebook, preserving
      // all hash params except those used to create the file.
      // NOTE: this doesn't cause reload because we stay on same page
      delete params['create'];
      delete params['folderId'];
      params['fileId'] = params.fileIds;
      window.location.hash = '#' + colab.params.encodeParamString(params);
      load(fileId);
    }, reject, params.folderId);
  } else if (params.fileIds) { // redirect to drive
    colab.params.redirectToNotebook({fileId: params.fileIds});
    load(params.fileIds);
  } else if (window.location.search.indexOf('state=') >= 0) {
    window.location.pathname = '/v2/drive';
  } else { // redirect to main page.
    window.location.href = '/v2/';
  }
});

/**
 * Closes the current document
 * @param {function(Object=)=} callback takes opt_response object or undefined
 */
colab.drive.close = function(callback) {
  // TODO(sandler): should we chain callback?
  if (colab.drive.isClosing) return;
  colab.notification.showPrimary('Closing \'' +
      colab.drive.offlineTitle + '\'', -1);
  colab.drive.isClosing = true;
  var handler = function(response) {
    if (response && response.error) {
      console.log(response);
      // Fall through, since we still need to close
    }
    if (colab.globalRealtimeDoc) {
      colab.globalRealtimeDoc.close();
    }
    colab.notification.clearPrimary();
    colab.drive.isClosed = true;
    colab.drive.isClosing = false;
    if (callback) {
      callback();
    }
  };
  if (!colab.globalRealtimeDoc || colab.drive.isClosed) {
    handler(null);
    return;
  }
  colab.drive.saveDocument(colab.globalRealtimeDoc, handler, handler);
};
