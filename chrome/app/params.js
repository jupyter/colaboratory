/**
 *
 * @fileoverview Parsing URL hash parameters.
 *
 */

var colab = colab || {};

colab.params = {};

/**
 * Decodes a set of key-value pairs encoded in a hash or search string
 * @param {string} paramString The encoded parameter string
 * @return {Object} An object representation of the key-value pairs
 */
colab.params.decodeParamString = function(paramString) {
  var pairStrings = paramString.split('&');
  var params = {};
  for (var i = 0; i < pairStrings.length; i++) {
    var pair = pairStrings[i].split('=');
    if (pair.length == 2) {
      params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
    }
  }
  return params;
};

/**
 * Encodes a set of key-value pairs as a hash or search string
 * @param {Object} params An object representation of the key-value pairs
 * @return {string} The string encoding the key-value pairs
 */
colab.params.encodeParamString = function(params) {
  var pairs = [];
  for (var key in params) {
    var value = params[key];
    var pair = encodeURIComponent(key) + '=' + encodeURIComponent(value);
    pairs.push(pair);
  }
  return pairs.join('&');
};
