var welcomeUrl = '/colab/welcome.html';

var tokenRefreshInterval = 10 * 60 * 1000;  // 10 minutes

var webview = document.getElementById('webview');

webview.setAttribute('partition', 'frontend');
webview.setAttribute('src', welcomeUrl + '#' + colab.webview.hashParams);

var loadedOnce = false;

webview.addEventListener('loadstop', function() {
  // Only add listeners after the webview loads for the first time.
  if (loadedOnce) {
    return;
  }
  loadedOnce = true;
  
  var contentWindow = webview.contentWindow;
  colab.webview.sendInitializationMessaage(contentWindow);
  colab.webview.provideIdentitiyApiAuth(contentWindow, true);
  colab.webview.addMessageListener(contentWindow,
    'launch',
    function(messageType, params) {
      launchNotebookWindow(params);
  	});
});