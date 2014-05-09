
goog.require('colab.filepicker');
goog.require('colab.install');
goog.require('colab.params');

goog.require('goog.dom');
goog.require('goog.dom.forms');
goog.require('goog.style');

/**
 * Displays the initial screen and attaches event handlers
 */
colab.displayInitialScreen = function() {
  console.log('Displaying initial screen.');

  var createButton = document.getElementById('create-button');
  createButton.onclick = function() {
    var newUrl = colab.params.getNewNotebookUrl();
    window.location.href = newUrl;
  };

  var showFilesButton = document.getElementById('show-files-button');
  showFilesButton.onclick = function() {
    colab.filepicker.selectFileAndReload();
  };

  var installButton = document.getElementById('install-button');
  installButton.onclick = function() {
    colab.install.install(false, function(response) {
      if (!response || response.error) {
        // TODO(kestert): convert to error popup.
        alert('Error installing Drive app.  See console for details. ' +
              ' Please e-mail colab-team@google.com for support');
        console.error(response);
      } else {
        goog.dom.classes.add(document.getElementById('step1'), 'done');
        goog.dom.forms.setDisabled(createButton, false);
        goog.dom.forms.setDisabled(showFilesButton, false);
      }
    });
  };
};

var onClientLoad = function() {
  colab.install.install(true, function(response) {
    if (response && !response.error) {

      var createButton = document.getElementById('create-button');
      var showButton = document.getElementById('show-files-button');

      goog.dom.classes.add(document.getElementById('step1'), 'done');
      goog.dom.forms.setDisabled(createButton, false);
      goog.dom.forms.setDisabled(showButton, false);
    }
    // Make this visible
    goog.style.setElementShown(document.getElementById('right'), true);
  });
};

window.onload = colab.displayInitialScreen;

