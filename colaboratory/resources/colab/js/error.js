/**
 *
 * @fileoverview Error objects used by Colaboratory
 *
 */

goog.provide('colab.Error');
goog.provide('colab.ErrorEvent');
goog.provide('colab.error.GapiError');
goog.provide('colab.error.GapiRealtimeError');

goog.require('goog.debug.Error');
goog.require('goog.events.Event');



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


/**
 * Utility method to generate a GapiError from an API response, if the response
 * is an error, and null if there is no error
 * @param {Object} response the JSON response from the Google API
 * @return {colab.error.GapiError} The error or null
 */
colab.error.GapiError.fromResponse = function(response) {
  if (!response || response['error']) {
    return new colab.error.GapiError(response ? response['error'] : null);
  }
  return null;
};



/**
 * Error in the Google Realtime API.  This is a wrapper for the gapi's own
 * error object.
 * @param {gapi.drive.realtime.Error} error The realtime error being wrapped.
 * @constructor
 * @extends {colab.Error}
 */
colab.error.GapiRealtimeError = function(error) {
  goog.base(this, error.message);

  /**
   * @type {gapi.drive.realtime.Error} error
   * @private
   */
  this.error_ = error;
};
goog.inherits(colab.error.GapiRealtimeError, colab.Error);


/** @override */
colab.error.GapiRealtimeError.prototype.name = 'GapiRealtimeError';



/**
 * Event to signal that an error has occured
 * @constructor
 * @param {string} type The event type
 * @param {colab.Error} error The error that caused this event
 * @extends {goog.events.Event}
 */
colab.ErrorEvent = function(type, error) {
  goog.base(this, type);

  /** @type {colab.Error} */
  this.error = error;
};
goog.inherits(colab.ErrorEvent, goog.events.Event);
