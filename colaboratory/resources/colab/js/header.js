/**
 *
 * @fileoverview Functions and classes for creating and manipulating the top
 *     header for coLaboratory.
 *
 */

goog.provide('colab.Header');

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

  if (document) {
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
  if (!permissions.isEditable()) {
    menubar.getChild('edit-menu-button').setEnabled(false);
    menubar.getChild('run-menu-button').setEnabled(false);
    menubar.getChild('backend-menu-button').setEnabled(false);
    var fileMenu = menubar.getChild('file-button').getMenu();
    fileMenu.getChild('download-ipynb-menuitem').setEnabled(!!document);
    fileMenu.getChild('save-menuitem').setEnabled(false);
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
            window.location.hash = colab.params.existingNotebookHash(
              response.id);
            // Would be nice if we could reload in-place.
            window.location.reload();
          }, function(response) {
            colab.notification.clearPrimary();
            colab.dialog.displayError('Unable to clone notebook', response);
          });
        });
        break;

      case 'new-menuitem':
        var tab = window.open(colab.params.getNewNotebookUrl(), '_blank');
        tab.focus();
        break;

      case 'open-menuitem':
        colab.filepicker.selectFileAndReload();
        break;

      case 'viewindrive-menuitem':
        notebook.openDriveViewer();
        break;

      case 'openlocalfs-menuitem':
        colab.app.postMessage('pick_file');
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
        a.href = window.URL.createObjectURL(new Blob([data]));

        // get filename and remove extention(s)
        var filename = goog.dom.getElement('doc-name').value.split('.')[0];
        a.download = filename + '.ipynb';
        a.click();
        break;

      case 'restart-menuitem':
        colab.globalSession.restart_kernel();
        break;
      case 'kill-menuitem':
        // TODO(colab-team): websocket_closed.Kernel is not fired anymore. May
        // not be a new kernel closed event in IPython 2.0.
        jQuery('#backend-connect-toolbar-button').children().children().text(
          'Connect to Python');
        goog.dom.classes.addRemove(
            goog.dom.getElement('backend-connect-toolbar-button'),
            ['connected', 'connecting'], 'disconnected');
        break;
      case 'interrupt-menuitem':
        colab.globalSession.interrupt_kernel();
        break;

      case 'connect-menuitem':
        colab.openKernelDialogBox();
        break;

      case 'report-bug-menuitem':
        window.open('https://github.com/ipython/colaboratory/issues');
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

  // TODO(kayur): The code below is horrible. Make it less horrible.
  // jQuery command for listening to kernel messages
  jQuery([IPython.events]).on('status_started.Kernel', function() {
    buttonElement.text('Connected');
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        ['connecting', 'disconnected'], 'connected');
  });

  jQuery([IPython.events]).on('status_restarting.Kernel', function() {
    buttonElement.text('Restarting');
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        ['connected', 'disconnected'], 'connecting');
  });

  jQuery([IPython.events]).on('websocket_closed.Kernel', function() {
    buttonElement.text('Connect to Python');
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        ['connected', 'connecting'], 'disconnected');
  });

  // TODO(kayur): add distinct behavior for start failed
  jQuery([IPython.events]).on('start_failed.Kernel', function(ev, data) {
    buttonElement.text('Connect to Python');
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        ['connected', 'connecting'], 'disconnected');
  });

  // TODO(colab-team): starting.Kernel is not fired anymore. Confirmed by Min.
  // register callback when event is fired.
  jQuery([IPython.events]).on('starting.Kernel', function(ev, data) {
    buttonElement.text('Connecting');
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        ['connected', 'disconnected'], 'connecting');
  });

  jQuery([IPython.events]).on('status_loading.Kernel', function(ev, data) {
    buttonElement.text('PNaCl Loading ' + data['progress'] + '\%');
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        ['connected', 'disconnected'], 'connecting');
  });

  jQuery([IPython.events]).on('pnacl_loadend.Kernel', function(ev, data) {
    buttonElement.text('PNaCl Initializing');
    goog.dom.classes.addRemove(
        goog.dom.getElement('backend-connect-toolbar-button'),
        ['connected', 'disconnected'], 'connecting');
  });


  // on autorestart or restart clear
  jQuery([IPython.events]).on('status_autorestarting.Kernel', function() {
    colab.globalNotebook.reset();
  });

  // on autorestart or restart clear
  jQuery([IPython.events]).on('status_restarting.Kernel', function() {
    colab.globalNotebook.reset();
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
