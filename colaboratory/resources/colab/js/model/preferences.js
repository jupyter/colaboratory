goog.provide('colab.Preferences');

goog.require('goog.net.cookies');



/**
 * Provides basic preference class. Default implementation maintains
 * persistence by saving into cookie. This can be overriden to save the
 * preferences elsewhere
 *
 * @constructor
 */
colab.Preferences = function() {

  /***/
  this.properties = {
    'showLineNumbers': true,
    'editorFontSize': 14
  };

  /***/
  this.showLineNumbers = true;

  /***/
  this.editorFontSize = 14;

  var getter = function(key) {
    return this[key + '_'];
  };

  var setter = function(key, value) {
    this[key + '_'] = value;
    this.save();
  };
  for (var i in this.properties) {
    this.__defineGetter__(i, goog.bind(getter, this, i));
    this.__defineSetter__(i, goog.bind(setter, this, i));
  }
  this.load();
};


/**
 * Saves preference into persistent strorage (cookies in this implementation)
 */
colab.Preferences.prototype.save = function() {
  var res = {};
  for (var i in this.properties) {
    res[i] = this[i];
  }
  goog.net.cookies.set('colab_prefs', JSON.stringify(res));
};


/**
 * Loads prefernces from persistent storage
 */
colab.Preferences.prototype.load = function() {
  var cookies = goog.net.cookies.get('colab_prefs');
  if (!cookies) return;
  var json = JSON.parse(cookies);

  for (var i in this.properties) {
    if (json[i] != undefined) {
      this[i] = json[i];
    } else {
      this[i] = this.properties[i];
    }
  }
};
