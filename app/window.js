var authToken;
window.onload = function() {
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
	var headers;
	if (details.requestHeaders) {
	    headers = details.requestHeaders;
	} else {
	    headers = [];
	}
	headers.push({
		'name': 'Authorization',
		'value': 'Bearer ' + authToken
	    });
	return /** @type {!BlockingResponse} */ ({'requestHeaders': headers});
    };
    
    // Creates webview container for frontend UI.
    var fileId = window.location.search.substr(1);
    var webview = document.createElement('webview');
    webview.setAttribute('src', 'http://127.0.0.1:8000/static/notebook.html?' + fileId);
    webview.setAttribute('style', 'width:100%; height:100%;');
    webview.setAttribute('autosize', 'on');
    document.body.appendChild(webview);

    // Adds callback function to modify headers for calls from webview.
    webview.addEventListener('loadstop', function(m) {
	    var urls = ['https://*.googleapis.com/*',
			'https://*.google.com/*',
			'https://*.googleusercontent.com/*'];
	    webview.request.onBeforeSendHeaders
		.addListener(setAuthHeaders,
			     {'urls': urls}, ['blocking', 'requestHeaders']);
	});
};