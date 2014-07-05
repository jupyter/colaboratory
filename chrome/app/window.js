var params = colab.params.decodeParamString(window.location.hash.substr(1));

var webview = new colab.Webview(document.getElementById('webview'),
                                '/colab/notebook.html',
                                params);

var kernel = new colab.Kernel(webview);

webview.provideIdentityApiAuth(false);

webview.addMessageListener('launch', function(messageType, params) {
  launchNotebookWindow(params);
});
