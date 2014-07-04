/**
 *
 * @fileoverview Utility to launch a notebook.
 *
 */

var launchNotebookWindow = function(params) {
  var url = '/app/window.html#' + colab.params.encodeParamString(params);
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
