chrome.app.runtime.onLaunched.addListener(function(intentData) {
	chrome.app.window.create('window.html', {
		'bounds': {
			'width': 800,
			'height': 600
		}
	});
});