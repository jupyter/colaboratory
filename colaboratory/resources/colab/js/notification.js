/**
 *
 * @fileoverview Description of this file.
 *
 */
goog.provide('colab.Notification');
goog.provide('colab.notification');

goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.style');


/**
 * @private
 * @type {number}
 */
colab.notification.count_ = 0;


/**
 * @param {string || Object} msg
 * @param {string=} opt_class
 * @param {number=} opt_timeout if timeout is not provided, uses default
 * (3000ms), if it is -1, then there will be no timeout.
 * @return {colab.Notification}
 */
colab.notification.showNotification = function(msg, opt_class, opt_timeout) {
  return new colab.Notification(msg, opt_class, opt_timeout);
};


/**
 * Clears primary notification;
 */
colab.notification.clearPrimary = function() {
  if (colab.notification.primary_) {
    colab.notification.primary_.clear();
  }
};


/**
 * @param {string} msg
 * @param {number=} opt_timeout
 */
colab.notification.showPrimary = function(msg, opt_timeout) {
  console.log(msg);
  colab.notification.primary_.change(msg, opt_timeout);
};



// TODO(sandler): maybe make goog.ui.component out of it.
/**
 * @param {string|Object} msg
 * @param {?string=} opt_class
 * @param {number=} opt_timeout
 * @param {boolean=} opt_hide
 * @constructor
 */
colab.Notification = function(msg, opt_class, opt_timeout, opt_hide) {
  /** @type {number} */
  this.timer = 0;
  /**  @private */
  this.class_ = opt_class;
  if (!opt_hide) {
    this.change(msg, opt_timeout);
  }
};


/**
 * Changes the text for notification
 * @param {string|Object} msg
 * @param {number=} opt_timeout
 */
colab.Notification.prototype.change = function(msg, opt_timeout) {
  if (!this.el_) {
    var root = goog.dom.getElement('message-area');
    this.el_ = goog.dom.createDom('span', 'notification');
    if (this.class_) {
      goog.dom.classes.add(this.el_, this.class_);
    }
    goog.style.setElementShown(this.el_, false);
    root.appendChild(this.el_);
  }
  jQuery(this.el_).stop().fadeIn();
  if (this.timer) {
    clearTimeout(this.timer);
  }
  var timeout = opt_timeout || 3000;
  this.el_.innerHTML = msg;
  var that = this;
  if (timeout >= 0) {
    this.timer = setTimeout(function() { that.clear(); }, timeout);
  }
};


/**
 * Clears notification
 */
colab.Notification.prototype.clear = function() {
  if (this.el_) {
    var n = this;
    jQuery(this.el_).stop().fadeOut(400, function() {
      goog.dom.getElement('message-area').removeChild(n.el_);
      n.el_ = null;
    });
  }
};


/**
 * Creates empty notification without showing it.
 * @param {?string=} opt_class
 * @return {colab.Notification}
 */
colab.notification.createEmptyNotification = function(opt_class) {
  return new colab.Notification('', opt_class, undefined, true);
};


/**
 * @private {colab.Notification}
 */
colab.notification.primary_ = colab.notification.createEmptyNotification();
