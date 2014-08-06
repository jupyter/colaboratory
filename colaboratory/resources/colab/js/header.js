/**
 *
 * @fileoverview Functions and classes for creating and manipulating the top
 *     header for coLaboratory.
 *
 */

goog.provide('colab.header');

goog.require('colab.Global');
goog.require('colab.app');
goog.require('colab.cell.CellType');
goog.require('colab.dialog');
goog.require('colab.filepicker');
goog.require('colab.model.Notebook');
goog.require('colab.nbformat');
goog.require('colab.notification');
goog.require('colab.params');
goog.require('colab.share');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.style');
goog.require('goog.ui.Component');
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
 * @private {goog.ui.Menu}
 */
colab.header.menubar_ = null;


/**
 * @param {string} idToFind
 * @param {?goog.ui.Menu=} opt_menu if not provided uses top level menu
 * @return {goog.ui.MenuItem}
 */
colab.header.findMenuItem = function(idToFind, opt_menu) {
  var menubar = opt_menu || colab.header.menubar_;
  if (menubar == null) { return null; }
  var child = /** @type {goog.ui.MenuItem} */ (menubar.getChild(idToFind));
  if (child) return child;
  /** @type {goog.ui.MenuItem} */
  var result = null;
  goog.array.forEach(menubar.getChildIds(), function(id) {
    if (result) return;
    var child = menubar.getChild(id);
    if (!child.getMenu || !child.getMenu()) return;
    result = colab.header.findMenuItem(idToFind, child.getMenu());
  });
  return result;
};


/**
 * Sets menu item shortcut
 * @param {string} menuid id of the menu
 * @param {string} shortcut string to display as shortcut
 *  (e.g. Ctrl-M)
 */
colab.header.updateMenuItemShortcut = function(menuid, shortcut) {
  var selector = '#' + menuid + '>.goog-menuitem-content';
  jQuery(selector + '>.' + goog.ui.MenuItem.ACCELERATOR_CLASS).remove();
  jQuery(selector).append(goog.dom.createDom(
      goog.dom.TagName.SPAN,
      goog.ui.MenuItem.ACCELERATOR_CLASS,
      shortcut));
};


/**
 * Setup coLaboratory header.
 * @param {colab.model.Notebook} notebook the current realtime document.
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
    //var commentsButton = goog.dom.getElement('comments');
    //goog.style.setElementShown(commentsButton, true);
  }
};


/**
 * @param {colab.model.Notebook} notebook
 * @param {!Event} e
 */
colab.handleMenuBarAction = function(notebook, e) {
  var targetItem = /** @type {goog.ui.MenuItem} */ (e.target);
  var global = colab.Global.getInstance();
  switch (targetItem.getId()) {
    case 'save-menuitem':
      // TODO(kestert): either we should call a method of
      // colab.model.Notebook, or we should be passing
      // in a colab.Notebook object.
      global.notebook.saveNotebook();
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
      colab.filepicker.selectFileAndReload();
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
      global.notebook.clearOutputs();
      break;

    case 'undo-menuitem':
      global.notebook.undo();
      break;

    case 'redo-menuitem':
      global.notebook.redo();
      break;

    case 'runall-menuitem':
      global.notebook.runAll();
      break;

    case 'runbefore-menuitem':
      global.notebook.runBefore();
      break;

    case 'runafter-menuitem':
      global.notebook.runAfter();
      break;

    case 'download-ipynb-menuitem':
      var a = goog.dom.createElement('a');
      var name = goog.dom.getElement('doc-name').value;
      var data = colab.nbformat.convertRealtimeToJsonNotebook(
          global.notebookModel.getTitle(),
          global.notebookModel.getDocument().getModel());
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
        global.kernel.restart();
      } else {
        global.session.restart_kernel();
      }
      break;
    case 'interrupt-menuitem':
      global.session.interrupt_kernel();
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
      global.notebook.displayShortcutHelp();
    default:
      console.error('Unknown menu item ' + targetItem.getContent());
  }
};


/**
 * Create the main menu menubar.
 * @param {colab.model.Notebook} notebook the current realtime document.
 */
colab.createMenubar = function(notebook) {
  var permissions = notebook.getPermissions();

  var menubarElement = goog.dom.getElement('top-menubar');
  goog.style.setElementShown(menubarElement, true);
  var menubar = goog.ui.decorate(menubarElement);
  colab.header.menubar_ = /** @type {goog.ui.Menu} */ (menubar);
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

  goog.events.listen(menubar, goog.ui.Component.EventType.ACTION,
      goog.partial(colab.handleMenuBarAction, notebook));
  colab.Global.getInstance().notebook.updateMenuShortcuts();
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
    var global = colab.Global.getInstance();
    switch (e.target.getId()) {
      case 'add-code-toolbar-button':
        global.notebook.addNewCell(
            colab.cell.CellType.CODE);
        break;
      case 'add-text-toolbar-button':
        global.notebook.addNewCell(
            colab.cell.CellType.TEXT);
        break;
      case 'cell-up-toolbar-button':
        global.notebook.moveCellUp();
        break;
      case 'cell-down-toolbar-button':
        global.notebook.moveCellDown();
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
 * @param {colab.model.Notebook} notebook The notebook
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
  element.value = title;

  notebook.listen(colab.model.Notebook.EventType.TITLE_CHANGED, function(e) {
    var event = /** @type {colab.model.Notebook.TitleChangedEvent} */ (e);
    if (element.value != event.title) {
      element.value = event.title;
    }
  });
};
