/**
 * Draws the UI for the state.
 * @param {boolean} isInstalled Whether the app is installed or not.
 */
var drawUiForState = function(isInstalled) {
  var setDisplay = function(el, display) {
    el.style.display = display ? '' : 'none';
  };

  setDisplay(document.getElementById('pre-install-div'), !isInstalled);
  setDisplay(document.getElementById('post-install-div'), isInstalled);
};


var SAMPLE_NOTEBOOKS_FOLDER_ID = '0B4MN7VFMCkpkakw4Rl9pQVk3UDA';

var addNotebooks = function(access_token, element, query) {
  var path = 'https://www.googleapis.com/drive/v2/files?q=' +
      encodeURIComponent(query);
  authenticatedXhr(access_token, 'GET', path, function(response) {
    if (!response || response['kind'] != 'drive#fileList') {
      console.log('Error in Google Drive request');
      return;
    }
    var items = response['items'];
    for (var i = 0; i < items.length; i++) {
      (function(fileId) {
//      var fileId = items[i].id;
      var path = 'https://www.googleapis.com/drive/v2/files/' + fileId;
      authenticatedXhr(access_token, 'GET', path, function(response) {
        var link = document.createElement('a');
        link.href = '#';
        link.innerHTML = response.title;
        link.onclick = function() {
          launchNotebookWindow({'fileId': fileId});
        };
        element.appendChild(link);
        element.appendChild(document.createElement('br'));
      });
      })(items[i].id);
    }
  });
};

var authenticatedXhr = function(token, method, url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.setRequestHeader('Authorization',
                       'Bearer ' + token);

  xhr.onload = function() {
    if (this.status === 401 && retry) {
      console.log('error in xhr request to Google Drive');
      return;
    }

    callback(JSON.parse(this.responseText));
  };

  xhr.send();
};

var getSampleNotebooks = function(access_token) {
  var samplesQuery = '\'' + SAMPLE_NOTEBOOKS_FOLDER_ID + '\' in parents';
  var samplesDiv = document.getElementById('sample-notebooks-div');
  addNotebooks(access_token, samplesDiv, samplesQuery);
  var myQuery = 'mimeType = \'application/ipynb\' and ' +
      ' not \'' + SAMPLE_NOTEBOOKS_FOLDER_ID + '\' in parents';
  var myDiv = document.getElementById('my-notebooks-div');
  addNotebooks(access_token, myDiv, myQuery);
};


window.onload = function() {
  var authenticate = function() {
    chrome.identity.getAuthToken({'interactive': true }, function(token) {
      if (token) {
        drawUiForState(true);
      } else {
        // TODO(kestert): inform user of error
      }
    });
  };

  var createButton = document.getElementById('create-button');
  createButton.onclick = function() {
    launchNotebookWindow({'create': true});
  };

  var refreshTokenButton = document.getElementById('refresh-token-button');
  refreshTokenButton.onclick = function() {
    chrome.identity.getAuthToken({'interactive': true }, function(token) {
      if (token) {
        // Remove this cached token and re-authenticate
        chrome.identity.removeCachedAuthToken({'token': token}, authenticate);
      } else {
        // There is no cached token, so prompt for authentication
        authenticate();
      }
    });

    var webview = document.createElement('webview');
    webview.src = 'https://colab.corp.google.com/static/v2/notebook.html';
    var loadedOnce = false;
    webview.addEventListener('loadstop', function() {
      if (loadedOnce) {
        document.body.removeChild(webview);
        return;
      }
      if (webview.clearData) {
        webview.clearData({}, {'fileSystems': true, 'localStorage': true},
                          function() { webview.reload(); });
      } else {
        webview.reload();
      }
      loadedOnce = true;
    });
    document.body.appendChild(webview);
  };

  var installButton = document.getElementById('install-button');
  installButton.onclick = authenticate;

  // Try to get an OAuth token, the result of which indicated if this App
  // has been installed on Drive yet.
  chrome.identity.getAuthToken({'interactive': false }, function(token) {
    if (token) {
      drawUiForState(true);
      getSampleNotebooks(token);
    } else {
      drawUiForState(false);
    }
  });
};
