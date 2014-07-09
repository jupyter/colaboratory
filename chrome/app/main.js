var driveRedirectAddress = 'http://colaboratory.jupyter.org/drive';

chrome.app.runtime.onLaunched.addListener(function(intentData) {
  console.log(intentData);
  if (intentData.id === 'handle_drive_action') {
    var url = intentData.url;
    var prefix = driveRedirectAddress + '?state=';
    if (url.indexOf(prefix) != 0) return;

    var state = JSON.parse(decodeURIComponent(url.substr(prefix.length)));
    if (state.action === 'open') {
      launchNotebookWindow({'fileId': state.ids[0]});
    } else if (state.action === 'create') {
      launchNotebookWindow({'create': true, 'folderId': state.folderId});
    } else {
      return;
    }
  } else if (!intentData.id) {
    // Standard 'launch' command.  Launch welcome window
    chrome.app.window.create('app/welcome.html', {
      'bounds': {
        'width': 880,
        'height': 635
      },
      'id': 'welcome'
    });
  }
});
