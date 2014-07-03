var welcomeUrl = '/colab/welcome.html';

var tokenRefreshInterval = 10 * 60 * 1000;  // 10 minutes

var webview = document.getElementById('webview');

webview.setAttribute('partition', 'frontend');
webview.setAttribute('src', welcomeUrl + '#' + colab.webview.hashParams);

webview.addEventListener('loadstop', function() {
  colab.webview.sendInitializationMessaage(webview.contentWindow);
  colab.webview.provideIdentitiyApiAuth(webview.contentWindow, true);
});