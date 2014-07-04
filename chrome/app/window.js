var params = colab.params.decodeParamString(window.location.hash.substr(1));

var webview = new colab.webview(document.getElementById('webview'),
                                '/colab/notebook.html',
                                params)

var kernel = new Kernel(function(message) {
  webview.postMessage('kernel_message', message);
});

webview.provideIdentityApiAuth(false);

webview.addMessageListener('start_kernel', function(msgType, content) {
  kernel.start();
})

webview.addMessageListener('restart_kernel', function(msgType, content) {
  kernel.restart();
})

webview.addMessageListener('kernel_message', function(msgType, content) {
  kernel.handleMessage({json: content});
})

webview.addMessageListener('pick_file', function(msgType, content) {
  chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function(theEntry) {
    if (!theEntry) {
      return;
    }
    kernel.handleMessage({'filesystem_name': theEntry.fullPath,
                          'filesystem_resource': theEntry.filesystem});
  });
});
