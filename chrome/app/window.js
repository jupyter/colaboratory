var params = colab.params.decodeParamString(window.location.hash.substr(1));

var webview = new colab.Webview(document.getElementById('webview'),
                                '/colab/notebook.html',
                                params);

var kernel = new colab.Kernel(webview);

webview.provideIdentityApiAuth(false);

webview.addMessageListener('launch', function(messageType, params) {
  launchNotebookWindow(params);
});

webview.addMessageListener('launch_browser_tab', function(messageType, params) {
  var a =  document.createElement('a')
  a.href = params['url'];
  a.target = "_blank";
  a.click();
});

webview.addMessageListener('download_ipynb', function(messageType, params) {
  var data = params['data'];
  var suggestedName = params['suggestedName'];

  var options = {
    type: 'saveFile',
    suggestedName: suggestedName
    };
  var errorHandler = function(e) {console.log(e);};
  chrome.fileSystem.chooseEntry(options, function(writableFileEntry) {
    writableFileEntry.createWriter(function(writer) {
      writer.onerror = errorHandler;
      writer.onwriteend = function(e) {
        console.log('write complete');
      };
      writer.write(new Blob([data], {type: 'text/plain'}));
    }, errorHandler);
  });
});
