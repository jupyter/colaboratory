/**
 *
 * @fileoverview Utility to launch a notebook.
 *
 */

var launchNotebookWindow = function(params) {
  hashStrings = [];
  params['mode'] = 'app';
  var extensionOrigin = chrome.runtime.getURL('/');
  extensionOrigin = extensionOrigin.substr(0,
                                           extensionOrigin.length - '/'.length);
  params['extensionOrigin'] = extensionOrigin;
  for (var key in params) {
    var value = params[key];
    hashStrings.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
  }
  var url = 'window.html#' + hashStrings.join('&');
  chrome.app.window.create(url, {
    'bounds': {
      'width': 800,
      'height': 600
    }
  });
};
