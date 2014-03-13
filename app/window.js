var authToken;

window.onload = function() {
    var refresh = document.getElementById('refresh');
    refresh.addEventListener('click', function() {
      webview.clearData({}, {'fileSystems': true, 'localStorage': true}, function() {
	webview.reload();
      });
    });

    // Gets OAuth 2.0 token using the Identity API.
    chrome.identity.getAuthToken({interactive: true}, function(token) {
	    authToken = token;
	});

    /**
     * Callback function that adds authorization headers using the OAuth token.
     *
     * @param {object} details Details of the request header.
     * @returns {object} modifications to the details.
     */
    var setAuthHeaders = function(details) {
        if (!details.requestHeaders) {
	    return;
        }

        var headers = details.requestHeaders;
        var correctOrigin = false;
        for (var i = 0; i < headers.length; i++) {
	    if (headers[i].name === 'Origin') {
	        if (headers[i].value === serverAddress) {
	            correctOrigin = true;
	        } else {
	            // Don't sign if we encouter the wrong origin
	            return;
	        }
	    }
	}
        if (!correctOrigin) {
	    return;
        }

	headers.push({
		'name': 'Authorization',
		'value': 'Bearer ' + authToken
	    });
	return /** @type {!BlockingResponse} */ ({'requestHeaders': headers});
    };

    // Creates webview container for frontend UI.
    var fileId = window.location.search.substr(1);
    webview = document.createElement('webview');
    webview.setAttribute('src', serverAddress + serverPath + '#fileIds=' + fileId + '&mode=app');

    webview.setAttribute('style', 'width:100%; height:100%;');
    webview.setAttribute('autosize', 'on');
    document.body.appendChild(webview);

    webview.addEventListener('loadstop', function(m) {
    	// Adds callback function to modify headers for calls from webview.
	    var urls = ['https://*.googleapis.com/*',
			'https://*.google.com/*',
			'https://*.googleusercontent.com/*'];
	    webview.request.onBeforeSendHeaders
		.addListener(setAuthHeaders,
			     {'urls': urls}, ['blocking', 'requestHeaders']);

		// Sends message to webview so the webview knows where to send its
		// messages to.
		webview.contentWindow.postMessage('initialization_message', serverAddress);
	});

  document.body.addEventListener('onresize', function(e){console.log(e);});
};