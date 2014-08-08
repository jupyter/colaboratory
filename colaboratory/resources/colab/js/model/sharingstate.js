/**
 *
 * @fileoverview provides information about sharing state of the file.
 *
 */

goog.require('colab.drive');
goog.require('colab.drive.ApiWrapper');
goog.require('goog.array');
goog.require('goog.events.EventTarget');

goog.provide('colab.sharing');
goog.provide('colab.sharing.SharingState');

/**
 * Maintains sharing state about given file id
 * @param {string} fileId
 * @constructor
 * @extends {goog.events.EventTarget}
 */
colab.sharing.SharingState = function(fileId) {
  goog.base(this);

  /** @type {boolean} Set to true, until proven otherwise. */
  this.hasOtherWriters = true;
  this.fileId = fileId;
  var that = this;
  colab.drive.ApiWrapper.getInstance().clientLoaded.then(function() {
    that.update();
  });
};
goog.inherits(colab.sharing.SharingState, goog.events.EventTarget);


/**
 * Updates sharing state for the file.
 */
colab.sharing.SharingState.prototype.update = function() {
 var request = gapi.client.drive.permissions.list({
    'fileId': this.fileId
  });
  request.execute(goog.bind(this.receiveUpdate_, this));
};

/** @type {string} */
colab.sharing.STATE_UPDATED = 'state-updated';

/**
 * @param {gapi.client.drive.permissions.List} permissions
 * @private
 */
colab.sharing.SharingState.prototype.receiveUpdate_ = function(permissions) {
  // Schedule to update permissions in a minute.
  setTimeout(goog.bind(this.update, this), 60 * 1000);
  this.lastPermissions = permissions;
  if (permissions.error) {
    // Ignore errors, assume we haven't received any permissions
    return;
  }

  // set writers
  var prevHasOtherWriters = this.hasOtherWriters;
  this.hasOtherWriters = goog.array.reduce(permissions.items, function(p, v) {
    if (v.role != 'reader' && v.id !== colab.drive.userPermissionId) {
      return true;
    } else {
      return p;
    }
  }, false);

  // dispatch the event.
  if (prevHasOtherWriters != this.hasOtherWriters) {
    this.dispatchEvent(colab.sharing.STATE_UPDATED);
  }
};





