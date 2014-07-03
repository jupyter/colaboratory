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
  var url = '/app/window.html#' + hashStrings.join('&');
  chrome.app.window.create(url, {
    'bounds': {
      'width': 800,
      'height': 600
    }
  });
  window.requestFileSystem  = window.requestFileSystem ||
                              window.webkitRequestFileSystem;
  window.terms = [];
  window.fileSystems = {};
  function newHTML5Volume(persistent, sizeInMegabytes) {
      if (persistent == true) {
        fsType = PERSISTENT;
        name = 'persistent';
      } else {
        fsType = TEMPORARY;
        name = 'temporary';
      }
      function errorFn(e) {
        console.log("Binding " + name + " failed: " + e);
      }
      function registerFileSystem(fs) {
        console.log("Bound " + name);
        window.fileSystems[name] = fs;
      }
      function grantedFileSystem(grantedBytes) {
        window.requestFileSystem(fsType,
                                 grantedBytes,
                                 registerFileSystem,
                                 errorFn);
      }
      navigator.webkitPersistentStorage.requestQuota(
        sizeInMegabytes*1024*1024,
        grantedFileSystem,
        errorFn
      )
  }
  newHTML5Volume(true, 8192);

};
