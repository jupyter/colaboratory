var welcomeUrl = '/colab/welcome.html';

var tokenRefreshInterval = 10 * 60 * 1000;  // 10 minutes

var webview = document.getElementById('webview');

webview.setAttribute('partition', 'frontend');
webview.setAttribute('src', welcomeUrl + '#' + colab.webview.hashParams);

webview.addEventListener('loadstop', function() {
  var contentWindow = webview.contentWindow;
  colab.webview.sendInitializationMessaage(contentWindow);
  colab.webview.provideIdentitiyApiAuth(contentWindow, true);
  colab.webview.addMessageListener(contentWindow,
    'launch',
    function(messageType, params) {
      launchNotebookWindow(params);
  	});
});