chrome.app.runtime.onLaunched.addListener(function(intentData) {
	var driveRedirectUrlPrefix = 'http://127.0.0.1:8000/drive?state=';
	console.log(intentData);
	if (intentData.id === 'handle_drive_action') {
		var url = intentData.url;
		if (url.indexOf(driveRedirectUrlPrefix) == 0) {
			var state = JSON.parse(decodeURIComponent(url.substr(driveRedirectUrlPrefix.length)));
			console.log(state);
			if (state.action === 'open') {
				chrome.app.window.create('window.html?' + state.ids[0], {
            		'bounds': {
                		'width': 800,
                		'height': 600
            		}
        		});
			}
		}
	}
});

// Get token in order to get user authorization.  This is needed because
// we use the special scope drive.install, which installs the app on
// Google Drive.  Without first obtaining this authorization, it is not
// possible to load files from drive, and so we need to do this first.
chrome.runtime.onStartup.addListener(function() {
	chrome.identity.getAuthToken({'interactive': true }, function(){});
});chrome.runtime.onInstalled.addListener(function() {
	chrome.identity.getAuthToken({'interactive': true }, function(){});
});