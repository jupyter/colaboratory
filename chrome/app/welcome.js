var el = document.getElementById('webview');

var webview = new colab.Webview(document.getElementById('webview'),
                                '/colab/welcome.html')

webview.provideIdentityApiAuth(true);

webview.addMessageListener('launch', function(messageType, params) {
  launchNotebookWindow(params);
});

webview.addMessageListener('launch_browser_tab', function(messageType, params) {
  var a =  document.createElement('a')
  a.href = params['url'];
  a.target = "_blank";
  a.click();
});