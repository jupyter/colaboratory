/**
 * @fileoverview
 * gapi.drive externs
 */


/***/
var gapi = {};


/***/
gapi.drive = {};


/***/
gapi.drive.realtime = {};


/**
 * @param {string} fileId
 * @param {Function?} onLoad
 * @param {Function?} initModel
 *  @param {Function?} onError
 **/
gapi.drive.realtime.load = function(fileId, onLoad, initModel, onError) {};



/**
 * @constructor
 */
gapi.drive.realtime.Document = function() {};


/**
 * @return {Array.<gapi.drive.realtime.Collaborator>}
 */
gapi.drive.realtime.Document.prototype.getCollaborators = function() {
  return null;
};


/**
 * @return {gapi.drive.realtime.Model}
 */
gapi.drive.realtime.Document.prototype.getModel = function() { return null; };


/**
 * @param {string} event
 * @param {function(gapi.drive.realtime.BaseModelEvent): undefined} callback
 * @param {boolean=} opt_capture
 */
gapi.drive.realtime.Document.prototype.addEventListener =
    function(event, callback, opt_capture) { };



/**
 * @constructor
 * @struct
 */
gapi.drive.realtime.Error = function() {
  /** @type {string } */
  this.type = '';
  /** @type {string} */
  this.message = '';
  /** @type {boolean} */
  this.isFatal = false;
};



/**
 * @constructor
 * @struct
 */
gapi.drive.realtime.BaseModelEvent = function() {
  /** @type {boolean} */
  this.bubbles = false;

  /** @type {boolean} */
  this.isLocal = false;

  /** @type {string} */
  this.sessionId = '';

  /** @type {string} */
  this.userId = '';

  /** @type {string} */
  this.type = '';
};



/**
 * @constructor
 * @struct
 * @extends {gapi.drive.realtime.BaseModelEvent}
 */
gapi.drive.realtime.ValuesSetEvent = function() {};


/**
 * @type {Array.<*>}
 */
gapi.drive.realtime.ValuesSetEvent.prototype.newValues = null;


/**
 * @type {Array.<*>}
 */
gapi.drive.realtime.ValuesSetEvent.prototype.oldValues = null;


/**
 * @type {number}
 */
gapi.drive.realtime.ValuesSetEvent.prototype.index = 0;



/**
 * @constructor
 * @struct
 * @extends {gapi.drive.realtime.BaseModelEvent}
 */
gapi.drive.realtime.ValuesAddedEvent = function() {};


/**
 * @type {Array.<*>}
 */
gapi.drive.realtime.ValuesAddedEvent.prototype.values = null;


/**
 * @type {number}
 */
gapi.drive.realtime.ValuesAddedEvent.prototype.index = 0;



/**
 * @constructor
 * @struct
 * @extends {gapi.drive.realtime.BaseModelEvent}
 */
gapi.drive.realtime.ValuesRemovedEvent = function() {};


/**
 * @type {number}
 */
gapi.drive.realtime.ValuesRemovedEvent.prototype.index = 0;


/**
 * @type {Array.<*>}
 */
gapi.drive.realtime.ValuesRemovedEvent.prototype.values = null;



/**
 * @constructor
 * @struct
 * @extends {gapi.drive.realtime.BaseModelEvent}
 */
gapi.drive.realtime.ValueChangedEvent = function() {
  /** @type {string} */
  this.property = '';
  /** @type {string|Object} */
  this.newValue = '';
  /** @type {boolean} */
  this.isLocal = false;
};



/**
 * @constructor
 * @struct
 * @extends {gapi.drive.realtime.BaseModelEvent}
 */
gapi.drive.realtime.CollaboratorLeftEvent = function() {
  /** @type {gapi.drive.realtime.Collaborator} */
  this.collaborator = null;
  /** @type {gapi.drive.realtime.Document} */
  this.document = null;
};



/**
 * @constructor
 * @struct
 * @extends {gapi.drive.realtime.BaseModelEvent}
 */
gapi.drive.realtime.DocumentSaveStateChangedEvent = function() {
  /** @type {boolean} */
  this.isPending = false;

  /** @type {boolean} */
  this.isSaving = false;
};


/***/
gapi.drive.realtime.EventType = {};


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.COLLABORATOR_JOINED = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.COLLABORATOR_LEFT = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.UNDO_REDO_STATE_CHANGED = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.VALUE_CHANGED = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.OBJECT_CHANGED = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.VALUES_ADDED = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.VALUES_REMOVED = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.VALUES_SET = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.TEXT_INSERTED = '';


/**
 * @type {string}
 */
gapi.drive.realtime.EventType.TEXT_DELETED = '';


/*** @type {string} */
gapi.drive.realtime.EventType.DOCUMENT_SAVE_STATE_CHANGED = '';


/***/
gapi.drive.realtime.ErrorType = {};


/**
 * @type {string}
 */
gapi.drive.realtime.ErrorType.TOKEN_REFRESH_REQUIRED = '';


/***/
gapi.drive.realtime.ErrorType.CLIENT_ERROR = '';


/***/
gapi.drive.realtime.ErrorType.NOT_FOUND = '';



/**
 * @constructor
 */
gapi.drive.realtime.Model = function() {};


/**
 * @type {boolean}
 */
gapi.drive.realtime.Model.prototype.isReadOnly = false;


/**
 * @return {gapi.drive.realtime.CollaborativeMap}
 */
gapi.drive.realtime.Model.prototype.getRoot = function() { return null;};


/***/
gapi.drive.realtime.Model.prototype.beginCompoundOperation = function() {};


/***/
gapi.drive.realtime.Model.prototype.endCompoundOperation = function() {};


/**
 * @return {gapi.drive.realtime.CollaborativeMap}
 */
gapi.drive.realtime.Model.prototype.createMap = function() { return null; };


/**
 * @param {Array=} a
 * @return {gapi.drive.realtime.CollaborativeList}
 */
gapi.drive.realtime.Model.prototype.createList = function(a) { return null; };


/**
 * @param {string=} opt_t
 * @return {gapi.drive.realtime.CollaborativeString}
 */
gapi.drive.realtime.Model.prototype.createString = function(opt_t) {
  return null;
};



/**
 * @constructor
 */
gapi.drive.realtime.CollaborativeObject = function() {};


/**
 * @param {string} type
 * @param {function(?)} handler
 * @param {boolean=} opt_capture
 */
gapi.drive.realtime.CollaborativeObject.prototype.addEventListener = function(
    type, handler, opt_capture) {};


/**
 * @param {string} type
 * @param {function(?)} handler
 */
gapi.drive.realtime.CollaborativeObject.prototype.removeEventListener =
    function(type, handler) {};



/**
 * @constructor
 * @extends {gapi.drive.realtime.CollaborativeObject}
 */
gapi.drive.realtime.CollaborativeList = function() {};


/**
 * @param {Object|string} o
 */
gapi.drive.realtime.CollaborativeList.prototype.push = function(o) {};


/**
 * @param {Array.<Object|string>} o
 */
gapi.drive.realtime.CollaborativeList.prototype.pushAll = function(o) {};


/**
 * @return {Array.<Object|string>} o
 */
gapi.drive.realtime.CollaborativeList.prototype.asArray = function() {
  return null;
};


/**
 * @param {number} i
 * @return {gapi.drive.realtime.CollaborativeObject|string}
 */
gapi.drive.realtime.CollaborativeList.prototype.get = function(i) {
  return null;
};


/**
 * @param {number} i
 * @param {Object|string} v
 */
gapi.drive.realtime.CollaborativeList.prototype.set = function(i, v) {};


/**
 * @param {Object|string} o
 */
gapi.drive.realtime.CollaborativeList.prototype.removeValue = function(o) {};


/**
 */
gapi.drive.realtime.CollaborativeList.prototype.clear = function() {};


/**
 * @param {Object|string} o
 */
gapi.drive.realtime.CollaborativeList.prototype.indexOf = function(o) {};


/**
 * @param {number} positionToInsert
 * @param {Object|string} o
 */
gapi.drive.realtime.CollaborativeList.prototype.insert = function(
    positionToInsert, o) {};


/**
 * @type {number}
 */
gapi.drive.realtime.CollaborativeList.prototype.length = 0;



/**
 * @constructor
 * @extends {gapi.drive.realtime.CollaborativeObject}
 */
gapi.drive.realtime.CollaborativeString = function() {};


/**
 * @param {string} s
 */
gapi.drive.realtime.CollaborativeString.prototype.setText = function(s) {};


/**
 * @return {string} s
 */
gapi.drive.realtime.CollaborativeString.prototype.getText = function() {
  return '';
};



/**
 * @constructor
 * @extends {gapi.drive.realtime.CollaborativeObject}
 */
gapi.drive.realtime.CollaborativeMap = function() {};


/**
 * @param {string} k
 * @param {gapi.drive.realtime.CollaborativeObject|string} v
 */
gapi.drive.realtime.CollaborativeMap.prototype.set = function(k, v) {};


/**
 * @param {string} k
 * @return {boolean}
 */
gapi.drive.realtime.CollaborativeMap.prototype.has = function(k) {
  return false;
};


/***/
gapi.drive.share = {};



/**
 *  @param {string} clientId
 *
 *  @constructor
 */
gapi.drive.share.ShareClient = function(clientId) {};


/**
 * @param {Array.<string>} fileIds
 */
gapi.drive.share.ShareClient.prototype.setItemIds = function(fileIds) {};


/**
 */
gapi.drive.share.ShareClient.prototype.showSettingsDialog = function() {};



/**
 * @constructor
 */
gapi.drive.realtime.Collaborator = function() {};


/**
 * @type {string}
 */
gapi.drive.realtime.Collaborator.prototype.color = '';


/**
 * The display name of the collaborator.
 * @type {string}
 */
gapi.drive.realtime.Collaborator.prototype.displayName = '';


/**
 * True if the collaborator is anonymous, false otherwise.
 * @type {boolean}
 */
gapi.drive.realtime.Collaborator.prototype.isAnonymous = false;


/**
 * True if the collaborator is the local user, false otherwise.
 * @type {boolean}
 */
gapi.drive.realtime.Collaborator.prototype.isMe = false;


/**
 * A url that points to the profile photo of the user.
 * @type {string}
 */
gapi.drive.realtime.Collaborator.prototype.photoUrl = '';


/**
 * The sessionId of the collaborator.
 * @type {string}
 */
gapi.drive.realtime.Collaborator.prototype.sessionId = '';


/**
 * The userId of the collaborator.
 * @type {string}
 */
gapi.drive.realtime.Collaborator.prototype.userId = '';



// TODO(sandler): these should go into gapi.drive.js in
// javascript/externs/api/client


/**
 * @type {Object}
 */
gapi.client.drive.properties = {};


/**
 * @param {Object} o file/property specified (fileId, propertyKey, visibility)
 * @return {Object}
 */
gapi.client.drive.properties.get = function(o) { return null; };


/**
 * @param {Object} o contains fileId and resource fields
 */
gapi.client.drive.properties.insert = function(o) {};


/**
 */
gapi.client.drive.comments = {};


/**
 * @param {Object} o
 */
gapi.client.drive.comments.insert = function(o) {};


/**
 * @param {Object} o
 */
gapi.client.drive.comments.list = function(o) {};



/**
 * @constructor
 */
gapi.client.drive.about.AboutResponse = function() {};


/**
 * @type {gapi.client.drive.about.User}
 */
gapi.client.drive.about.AboutResponse.prototype.user;



/**
 * @constructor
 */
gapi.client.drive.about.User = function() {};


/**
 * @type {string}
 */
gapi.client.drive.about.User.prototype.kind;


/**
 * @type {string}
 */
gapi.client.drive.about.User.prototype.displayName;


/**
 * @type {gapi.client.drive.about.User.Picture}
 */
gapi.client.drive.about.User.prototype.picture = null;



/**
 * @constructor
 */
gapi.client.drive.about.User.Picture = function() {};


/**
 * @type {string}
 */
gapi.client.drive.about.User.Picture.prototype.url;



/**
 * @constructor
 */
gapi.client.drive.comments.Request = function() {};


/**
 * @type {string}
 */
gapi.client.drive.comments.Request.prototype.fileId = '';


/** namespace */
gapi.client.plus = {};


/** namespace */
gapi.client.plus.people = {};


/**
 * Returns an RPC object from which G+ profile information can be requested.
 *
 * @param {{userId: string}} parameters An object containing a G+ person ID.
 * @return {?{execute: function(function(Object))}} An RPC object containing an
 *     execute method that takes a callback as input.  Either the requested
 *     profile or an error will be passed to that callback.
 */
gapi.client.plus.people.get = function(parameters) {return null;};



/**
 * @constructor
 */
gapi.client.plus.PeopleGetResponse = function() {};


/**
 * @type {Array.<gapi.client.plus.PersonEmail>}
 */
gapi.client.plus.PeopleGetResponse.prototype.emails = null;


/**
 * @type {?}
 */
gapi.client.plus.PeopleGetResponse.prototype.error = null;



/**
 * @constructor
 */
gapi.client.plus.PersonEmail = function() {};


/**
 * @type {string}
 */
gapi.client.plus.PersonEmail.prototype.value = '';


/**
 * @type {string}
 */
gapi.client.plus.PersonEmail.prototype.type = '';



/**
 * @see https://developers.google.com/drive/v2/reference/files#resource
 * @constructor
 * @struct
 */
gapi.client.drive.files.Resource = function() {
  /** @type {string} */
  this.title = '';

  /** @type {string} */
  this.originalFilename = '';

  /** @type {string} */
  this.alternateLink = '';

  /** @type {boolean} */
  this.shared = false;
};



/**
 * @see https://developers.google.com/drive/v2/reference/permissions/list
 * @constructor
 * @struct
 */
gapi.client.drive.permissions.List = function() {
  /** @type {Array.<gapi.client.drive.permissions.Resource>} */
  this.items = null;
  /** @type {string} */
  this.error = '';
};



/**
 * @see https://developers.google.com/drive/v2/reference/permissions#resource
 * @constructor
 * @struct
 */
gapi.client.drive.permissions.Resource = function() {
  /** @type {string} */
  this.role = '';

  /** @type {string} */
  this.id = '';

  // Add more as needed
};



/**
 * @constructor
 * @struct
 */
gapi.client.Error = function() {
  /** @type {number} */
  this.code = 0;
  /** @type {string} */
  this.message = '';
};
