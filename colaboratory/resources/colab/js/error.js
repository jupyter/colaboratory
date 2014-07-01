/**
 *
 * @fileoverview Error objects used by Colaboratory
 *
 */

goog.provide('colab.Error');
goog.provide('colab.error');

goog.require('goog.debug.Error');

/**
 * Base class for custom error objects.
 * @param {*=} opt_msg The message associated with the error.
 * @param {colab.Error=} opt_parent The error that caused this error.
 * @constructor
 * @extends {goog.debug.Error}
 */
colab.Error = function(opt_msg, opt_parent) {
  goog.base(this, opt_msg);

  /**
   * @type {colab.Error}
   * @private
   */
  this.parent_ = opt_parent || null;
};
goog.inherits(colab.Error, goog.debug.Error);

/**
 * Generic Google API error.  Used for unknown errors that occur while making
 * calls the Google APIs.
 * @param {?gapi.client.Error} error The API error.
 * @constructor
 * @extends {colab.Error}
 */
colab.error.GapiError = function(error) {
  if (error) {
    goog.base(this);
  } else {
    goog.base(this, error.msg);
  }

  /**
   * @type {?gapi.client.Error} error
   * @private
   */
  this.error_ = error || undefined;
};
goog.inherits(colab.error.GapiError, colab.Error);

/** @override */
colab.error.GapiError.prototype.name = 'GapiError';
