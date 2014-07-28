/**
 *
 * @fileoverview Functions and classes for creating and manipulating the top
 *     header for coLaboratory.
 *
 */

goog.provide('colab.Header');

goog.require('colab.app');
goog.require('colab.dialog');
goog.require('colab.filepicker');
goog.require('colab.nbformat');
goog.require('colab.notification');
goog.require('colab.share');

goog.require('goog.Promise');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.ui.Menu');
goog.require('goog.ui.MenuBarRenderer');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Option');
goog.require('goog.ui.SelectionModel');
goog.require('goog.ui.Separator');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.ToolbarButton');
goog.require('goog.ui.ToolbarMenuButton');
goog.require('goog.ui.ToolbarRenderer');
goog.require('goog.ui.ToolbarSelect');
goog.require('goog.ui.ToolbarSeparator');
goog.require('goog.ui.ToolbarToggleButton');
goog.require('goog.ui.menuBar');
goog.require('goog.ui.menuBarDecorator');


/**
 * Setup coLaboratory header.
 * @param {colab.drive.NotebookModel} notebook the current realtime document.
 */
colab.setupHeader = function(notebook) {
  var permissions = notebook.getPermissions();
  // add the divs to change document name and authorize to share
  colab.initDocumentNameInput(notebook);

  // create a menubar
  colab.createMenubar(notebook);

  if (permissions) {
    // create a toolbar
    colab.createToolbar(permissions);
  }

  // Sharing does not work on app mode, so do not show button.
  if (document && !colab.app.appMode) {
    // activate share button
    var shareButton = goog.dom.getElement('share');
    goog.style.setElementShown(shareButton, true);
    shareButton.onclick = function() {
      colab.share.shareDocument(notebook);
    };

    // activate comments button
    // var commentsButton = goog.dom.getElement('comments');
    // goog.style.setElementShown(commentsButton, true);
  }
};

/**
 * Create the main menu menubar.
 * @param {colab.drive.NotebookModel} notebook the current realtime document.
 */
colab.createMenubar = function(notebook) {
  var permissions = notebook.getPermissions();

  var menubarElement = goog.dom.getElement('top-menubar');
  goog.style.setElementShown(menubarElement, true);
  var menubar = goog.ui.decorate(menubarElement);
  var fileMenu = menubar.getChild('file-button').getMenu();
  if (!permissions.isEditable()) {
    menubar.getChild('edit-menu-button').setEnabled(false);
    menubar.getChild('run-menu-button').setEnabled(false);
    menubar.getChild('backend-menu-button').setEnabled(false);
    fileMenu.getChild('download-ipynb-menuitem').setEnabled(!!document);
    fileMenu.getChild('save-menuitem').setEnabled(false);
  }

  if (colab.app.appMode) {
    // Disable sharing in Chrome App mode, as this feature is not working yet.
    fileMenu.getChild('share-menuitem').setVisible(false);

  } else {
    // Remove "Open local directory" in web app mode as this feature
    // only applies to Chrome App.
    fileMenu.getChild('openlocalfs-separator').setVisible(false);
    fileMenu.getChild('openlocalfs-menuitem').setVisible(false);
  }

  // TODO(kayur): And handlers for other actions.
  goog.events.listen(menubar, goog.ui.Component.EventType.ACTION, function(e) {
    switch (e.target.getId()) {
      case 'save-menuitem':
        // TODO(kestert): either we should call a method of
        // colab.drive.NotebookModel, or we should be passing
        // in a colab.Notebook object.
        colab.globalNotebook.saveNotebook();
        return;

      case 'share-menuitem':
        colab.share.shareDocument(notebook);
        break;
      case 'clone-menuitem':
        colab.close(function() {
          colab.notification.showPrimary(
            'Creating a copy...', -1);
          notebook.clone(function(response) {
            colab.notification.showPrimary('Done');
            if (colab.app.appMode) {
              colab.app.postMessage('launch', {'fileId': response.id});
            } else {
              window.location.hash = colab.params.existingNotebookHash(
                  response.id);
              // Would be nice if we could reload in-place.
              window.location.reload();
            }
          }, function(response) {
            colab.notification.clearPrimary();
            colab.dialog.displayError('Unable to clone notebook', response);
          });
        });
        break;

      case 'new-menuitem':
        if (colab.app.appMode) {
          colab.app.postMessage('launch', {'create': 'true'});
        } else {
          var tab = window.open(colab.params.getNewNotebookUrl(), '_blank');
          tab.focus();
        }
        break;

      case 'open-menuitem':
        colab.filepicker.selectFileAndReload(true);
        break;

      case 'viewindrive-menuitem':
        notebook.openDriveViewer();
        break;

      case 'openlocalfs-menuitem':
        // Test if Chrome Versions is new enough for PNaCl to support
        // mounting local directories.
        if (colab.app.checkVersionAndWarnUser(
          colab.app.MOUNT_LOCAL_DIRECTORY_MIN_CHROME_VERSION)) {
          colab.app.postMessage('pick_file');
        }
        break;

      case 'clear-outputs-menuitem':
        colab.globalNotebook.clearOutputs();
        break;

      case 'clear-notebook-menuitem':
        colab.globalNotebook.clear();
        break;

      case 'undo-menuitem':
        colab.globalNotebook.undo();
        break;

      case 'redo-menuitem':
        colab.globalNotebook.redo();
        break;

      case 'runall-menuitem':
        colab.globalNotebook.runAll();
        break;

      case 'runbefore-menuitem':
        colab.globalNotebook.runBefore();
        break;

      case 'runafter-menuitem':
        colab.globalNotebook.runAfter();
        break;

      case 'download-ipynb-menuitem':
        var a = goog.dom.createElement('a');
        var name = goog.dom.getElement('doc-name').value;
        var data = colab.nbformat.convertRealtimeToJsonNotebook(
            colab.drive.globalNotebook.getTitle(),
            colab.drive.globalNotebook.getDocument().getModel());
        // get filename and remove extention(s)
        var filename = goog.dom.getElement('doc-name').value.split('.')[0];

        if (colab.app.appMode) {
          colab.app.postMessage('download_ipynb', {
            'data': data,
            'suggestedName': filename + '.ipynb'
          });
        } else {
          a.href = window.URL.createObjectURL(new Blob([data]));
          a.download = filename + '.ipynb';
          a.click();
        }
        break;

      case 'restart-menuitem':
        if (colab.app.appMode) {
          colab.globalKernel.restart();
        } else {
          colab.globalSession.restart_kernel();
        }
        break;
      case 'interrupt-menuitem':
        colab.globalSession.interrupt_kernel();
        break;

      case 'connect-menuitem':
        colab.openKernelDialogBox();
        break;

      case 'report-bug-menuitem':
        var url = 'https://github.com/ipython/colaboratory/issues';
        if (colab.app.appMode) {
          colab.app.postMessage('launch_browser_tab', {'url': url});
        } else {
          window.open(url);
        }
        break;

      case 'shortcuts-menuitem':
        colab.globalNotebook.displayShortcutHelp();
      default:
        console.error('Unknown menu item ' + e.target.getContent());
    }
  });
};

/**
 * Loads a notebook from a static location.
 * @param {colab.drive.Permissions} permissions Drive permissions
 */
colab.createToolbar = function(permissions) {
  if (!permissions.isEditable()) {
    return;
  }

  // add toolbar
  var toolbarElement = goog.dom.getElement('top-toolbar');
  goog.style.setElementShown(toolbarElement, true);

  var toolbar = new goog.ui.Toolbar();
  toolbar.decorate(toolbarElement);

  goog.events.listen(toolbar, goog.ui.Component.EventType.ACTION, function(e) {
    switch (e.target.getId()) {
      case 'add-code-toolbar-button':
        colab.globalNotebook.addNewCell(colab.cell.CellType.CODE);
        break;
      case 'add-text-toolbar-button':
        colab.globalNotebook.addNewCell(colab.cell.CellType.TEXT);
        break;
      case 'cell-up-toolbar-button':
        colab.globalNotebook.moveCellUp();
        break;
      case 'cell-down-toolbar-button':
        colab.globalNotebook.moveCellDown();
        break;
      case 'backend-connect-toolbar-button':
        colab.openKernelDialogBox();
        break;
      default:
        console.log(e.target.getContent());
    }
  });

  var buttonElement = jQuery('#backend-connect-toolbar-button')
      .children().children();

  var all_classes = ['connecting', 'disconnected', 'connected'];
  var updateButton = function(text, cls) {
    buttonElement.text(text);
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        all_classes, cls);
  };

  // TODO(kayur): The code below is horrible. Make it less horrible.
  // jQuery command for listening to kernel messages
  jQuery([IPython.events]).on('status_started.Kernel', function() {
    updateButton('Connected', 'connected');
  });

  jQuery([IPython.events]).on('status_restarting.Kernel', function() {
    updateButton('Restarting', 'connecting');
  });

  jQuery([IPython.events]).on('authorizing.Session',
      function(ev, data) {
    updateButton('Authorizing', 'connecting');
 });

 jQuery([IPython.events]).on('status_dead.Kernel websocket_closed.Kernel',
     function() {
    updateButton('Connect to Python', 'disconnected');
  });

  // TODO(kayur): add distinct behavior for start failed
  jQuery([IPython.events]).on('start_failed.Kernel start_failed.Session',
      function(ev, data) {
    updateButton('Connect to Python', 'disconnected');
  });

  jQuery([IPython.events]).on('starting.Kernel starting.Session',
      function(ev, data) {
    updateButton('Connecting', 'connecting');
  });

  jQuery([IPython.events]).on('pnacl_loading.Kernel', function(ev, data) {
    updateButton('PNaCl Loading ' + data['progress'] + '\%', 'connecting');
  });

  jQuery([IPython.events]).on('pnacl_loadend.Kernel', function(ev, data) {
    updateButton('PNaCl Initializing', 'connecting');
  });

};

/**
 * Set up document input for setting and getting document name in drive.
 * @param {colab.drive.NotebookModel} notebook The notebook
 */
colab.initDocumentNameInput = function(notebook) {
  var permissions = notebook.getPermissions();

  var element = goog.dom.getElement('doc-name');
  if (permissions && permissions.isEditable()) {
    element.disabled = false;
    // Sets up change listener to change title
    var setRemote = function() {
      notebook.setTitle(element.value);
    };
    element.onkeyup = setRemote;
    element.onchange = setRemote;
  } else {
    element.disabled = true;
  }
  var title = notebook.getTitle();
  var setLocal = function(title) {
    document.title = title;
    if (element.value != title) {
      element.value = title;
    }
  };
  setLocal(title);
  notebook.onTitleChange(setLocal);
};
