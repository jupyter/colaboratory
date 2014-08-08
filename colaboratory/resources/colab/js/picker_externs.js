

/***/
gapi.client.drive.permissions = {};


/***/
gapi.client.drive.permissions.insert = {};


/**
 * @param {*} config
 */
gapi.client.drive.files.trash = function(config) {};


/***/
gapi.client.oauth2 = {};


/***/
gapi.client.oauth2.userinfo = {};


/***/
gapi.client.oauth2.userinfo.get = {};


/***/
google.picker = {};


/***/
google.picker.Action = {};


/***/
google.picker.Action.CANCEL = '';


/***/
google.picker.Action.PICKED = '';


/***/
google.picker.Document.EMBEDDABLE_URL = '';


/***/
google.picker.Document.ID = '';


/***/
google.picker.Document.LAST_EDITED_UTC = '';


/***/
google.picker.Document.MIME_TYPE = '';


/***/
google.picker.Document.NAME = '';


/***/
google.picker.Feature = {};


/***/
google.picker.Feature.NAV_HIDDEN = '';


/***/
google.picker.Feature.MULTISELECT_ENABLED = '';


/***/
google.picker.Response = {};


/***/
google.picker.Response.ACTION = '';


/***/
google.picker.Response.DOCUMENTS = '';


/***/
google.picker.ViewId = {};


/***/
google.picker.ViewId.DOCS = '';


/***/
google.picker.ViewId.DOCS_IMAGES = '';


/***/
google.picker.ViewId.DOCS_VIDEOS = '';


/***/
google.picker.ViewId.RECENTLY_PICKED = '';


/***/
google.picker.ViewId.VIDEO_SEARCH = '';



/** @constructor **/
google.picker.Picker = function() {};


/***/
google.picker.Picker.prototype.setVisible = function() {};



/**
 * @constructor
 */
google.picker.PickerEvent = function() {};


/**
 * @type {string}
 */
google.picker.PickerEvent.prototype.action = '';


/**
 * @type {Array.<?>}
 */
google.picker.PickerEvent.prototype.docs = null;



/**
 * @param {*} a
 * @constructor
 **/
google.picker.View = function(a) {};


/** @param {string} mimetypes */
google.picker.View.prototype.setMimeTypes = function(mimetypes) {};


/** @param {string} mimetypes */
google.picker.View.prototype.setMode = function(mimetypes) {};



/** @constructor */
google.picker.DocsUploadView = function() {};


/**
 * @param {*} b
 */
google.picker.DocsUploadView.prototype.setIncludeFolders = function(b) {};



/** @constructor */
google.picker.DocsView = function() {};


/**
 */
google.picker.DocsViewMode = {};


/**
 * @type {string}
 */
google.picker.DocsViewMode.LIST = '';


/**
 * @param {*} b
 */
google.picker.DocsView.prototype.setIncludeFolders = function(b) {};


/**
 * @param {boolean} b
 */
google.picker.DocsView.prototype.setSelectFolderEnabled = function(b) {};



/**
 * @param {*=} opt_a
 * @constructor
 */
google.picker.PickerBuilder = function(opt_a) {};


/**
 * @param {*} a
 */
google.picker.PickerBuilder.prototype.addView = function(a) {};


/***/
google.picker.PickerBuilder.prototype.enableFeature = function() {};


/**
 * @param {function(google.picker.PickerEvent)} a
 */
google.picker.PickerBuilder.prototype.setCallback = function(a) {};


/**
 * @param {*} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.PickerBuilder.prototype.setDeveloperKey = function(a) {
  return null;
};


/**
 * @param {string} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.PickerBuilder.prototype.setSelectableMimeTypes = function(a) {
  return null;
};


/**
 * @param {string} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.DocsView.prototype.setQuery = function(a) {
  return null;
};


/**
 * @param {string} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.DocsView.prototype.setMode = function(a) {
  return null;
};


/**
 * @param {string} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.DocsView.prototype.setLabel = function(a) {
  return null;
};


/**
 * @param {string} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.DocsView.prototype.setParent = function(a) {
  return null;
};


/**
 * @param {boolean} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.DocsView.prototype.setOwnedByMe = function(a) {
  return null;
};


/**
 * @param {*} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.PickerBuilder.prototype.setOAuthToken = function(a) {
  return null;
};


/**
 * @param {string} a
 * @return {google.picker.PickerBuilder}
 */
google.picker.PickerBuilder.prototype.setOrigin = function(a) {
  return null;
};


/**
 * @param {*} a
 */
google.picker.PickerBuilder.prototype.setAppId = function(a) {};


/**
 * @param {*} a
 */
google.picker.PickerBuilder.prototype.setAuthUser = function(a) {};


/***/
google.picker.PickerBuilder.prototype.build = function() {};


