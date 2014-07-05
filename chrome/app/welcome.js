var el = document.getElementById('webview');

var webview = new colab.Webview(document.getElementById('webview'),
                                '/colab/welcome.html')

webview.provideIdentityApiAuth(true);

webview.addMessageListener('launch', function(messageType, params) {
  launchNotebookWindow(params);
});