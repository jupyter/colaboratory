/**
 *
 * @fileoverview Parsing notebook parameters.
 *
 */

goog.provide('colab.params');


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


/**
 * Returns parsed search parameters
 * @return {Object} parsed search parameters
 */
colab.params.getSearchParams = function() {
  return colab.params.decodeParamString(window.location.search.slice(1));
};


/**
 * Returns parsed hash parameters
 * @return {HashParams} parsed hash parameters
 */
colab.params.getHashParams = function() {
  return /** @type {HashParams} */ (
      colab.params.decodeParamString(window.location.hash.slice(1)));
};


/**
 * Returns url for a given notebook.
 * @param {Object} params Hash parameters as a dictionary.
 * @return {string}
 */
colab.params.getNotebookUrl = function(params) {
  // TODO(kestert): make index.html a constant in this file.
  return '/notebook#' + colab.params.encodeParamString(params);
};


/**
 * Utility function to redirect to notebook load page with given hash
 * parameters.
 * @param {Object} params Hash parameters as a dictionary.
 */
colab.params.redirectToNotebook = function(params) {
  window.location.href = colab.params.getNotebookUrl(params);
};


/**
 * Returns a url that creates a new notebook
 * @return {string}
 */
colab.params.getNewNotebookUrl = function() {
  return colab.params.getNotebookUrl({'create': true});
};


/**
 * @return {string} hash to create a new notebook
 */
colab.params.newNotebookHash = function() {
  return '#create=true';
};


/**
 * @return {string} hash to create a new notebook
 * @param {string} fileId fileid of the notebook.
 */
colab.params.existingNotebookHash = function(fileId) {
  return '#fileId=' + fileId;
};
