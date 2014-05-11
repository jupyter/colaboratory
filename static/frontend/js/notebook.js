/**
 *
 * @fileoverview Contains the main Notebook class.
 *
 */
goog.provide('colab.CellDragger');
goog.provide('colab.Notebook');

goog.require('colab.CommentsWidget');
goog.require('colab.Preferences');
goog.require('colab.Undo');
goog.require('colab.cell');
goog.require('colab.cell.Cell');
goog.require('colab.drive.Permissions');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.fx.DragListDirection');
goog.require('goog.fx.DragListGroup');
goog.require('goog.fx.dom.FadeInAndShow');
goog.require('goog.fx.dom.FadeOutAndHide');
goog.require('goog.json');


/**
 * Creates a new Notebook object. A Notebook is a collection of Cell objects.
 *
 * @param {gapi.drive.realtime.Model} model The Realtime root model object.
 * @param {colab.drive.Permissions} permissions Edit permissions
 * @constructor
 */
colab.Notebook = function(model, permissions) {
  /** @private {Array.<colab.cell.Cell>} */
  this.cells_ = [];

  /** @private {colab.drive.Permissions} */
  this.permissions_ = permissions;

  /** @private {gapi.drive.realtime.CollaborativeList} */
  this.realtimeCells_ = model.getRoot().get('cells');

  /** @private */
  this.history_ = new colab.Undo(this.realtimeCells_);

  /** @type {gapi.drive.realtime.Model} model The Realtime root */
  this.model = model;

  /** @private */
  this.listeners_ = {};

  var readOnly = model.isReadOnly;
  // add realtime cells as document cells
  var contentDiv = goog.dom.getElement('content');
  this.contentDiv = contentDiv;
  for (var i = 0; i < this.realtimeCells_.length; i++) {
    var rt_cell = /** @type {gapi.drive.realtime.CollaborativeMap} */
        (this.realtimeCells_.get(i));

    var cell = colab.cell.cellFromRealtime(
        rt_cell,
        this.permissions_);

    // Previous version of the realtime model may not have the support
    // for comments and collaborator. This patches old models to add that
    // support.

    if (!readOnly && !rt_cell.has('commentsSentinel')) {
      rt_cell.set('commentsSentinel', model.createString());
    }

    if (!readOnly && !rt_cell.has('collaborators')) {
      rt_cell.set('collaborators', model.createList());
    }

    this.cells_.push(cell);
    cell.render(contentDiv);
  }

  // make the cells drag droppable
  if (this.permissions_.isEditable()) {
    this.makeDraggable_();
  }

  // listen to changes to realtime cells
  this.realtimeCells_.addEventListener(
      gapi.drive.realtime.EventType.VALUES_ADDED,
      goog.bind(this.realtimeCellsAdded_, this));
  this.realtimeCells_.addEventListener(
      gapi.drive.realtime.EventType.VALUES_REMOVED,
      goog.bind(this.realtimeCellsRemoved_, this));
  this.realtimeCells_.addEventListener(
      gapi.drive.realtime.EventType.VALUES_SET,
      goog.bind(this.realtimeCellsSet_, this));

  if (!model.getRoot().get('sentinel')) {
    model.getRoot().set('sentinel',
                        model.createList([new Date().toISOString()]));
  }

  var commentSentinel = model.getRoot().get('sentinel');
  this.commentsWidet = new colab.CommentsWidget(
      commentSentinel, this.permissions_);
  window.addEventListener('message', goog.bind(this.receiveCellMessage, this));

  this.setupKeyHandler();
};

/**
 * Returns the unique ID of the notebook. Currently set to the id of the
 * realtime cells list.
 *
 * @return {string} Unique id
 */
colab.Notebook.prototype.getId = function() {
  return this.realtimeCells_.id;
};

/** @private {number} duration of animations in millisecons */
colab.Notebook.ANIMATION_DURATION_ = 400;

/**
 * Add new cell to the end of the document.
 *
 * TODO(kayur): have better semantics for adding a cell. This boils
 * down to a major decision on how to keep two types of state. One is realtime
 * state. This state keeps the notebook synced between version. However, not
 * everything needs to be sync, for example selected index.
 *
 * @param {string} type Type of the cell.
 * @param {number} opt_position Position of the cell
 * @param {string} opt_content Content of the cell
 */
colab.Notebook.prototype.addNewCell = function(type, opt_position, opt_content) {
  if (!this.permissions_.isEditable()) {
    return;
  }

  var realtimeCell = colab.cell.newRealtimeCell(this.model, type, opt_content);

  var position = opt_position === undefined ?
      this.realtimeCells_.length : opt_position;

  this.history_.recordInsert(position, realtimeCell);
  //this.realtimeCells_.insert(position, realtimeCell);
};

/**
 * @return {boolean}
 */
colab.Notebook.prototype.isEditable = function() {
  return this.permissions_.isEditable();
};

/**
 * Gets the position of a cell in the list of cells.
 *
 * @param {string} id The unique id of the cell
 * @return {number} Position of cell in the realtime list
 */
colab.Notebook.prototype.getCellIndex = function(id) {
  return goog.array.findIndex(this.cells_, function(c) {
    return c.realtimeCell.id == id;
  });
};

/**
 * Finds a cell by its cellId.
 * @param {string} cellId
 * @return {colab.cell.Cell} Found cell, or 'undefined' otherwise.
 */
colab.Notebook.prototype.findCellByCellId = function(cellId) {
  return colab.cell.Cell.idToCellMap[cellId];
};

/**
* Checks that a cell has the right to send/receive messages
*
* @param {colab.cell.Cell} cell the cell
* @return {boolean} True if allowed false otherwise.
*/
colab.Notebook.prototype.kernelAccessAllowed = function(cell) {
  if (cell.getType() != colab.cell.CellType.CODE) {
    return false;
  }

  return cell.getOutputArea().isLocalContent();
};

/**
 * Handles messages coming from cells (which run in their own iframes)
 *
 * @param {Event} message Messages from cells.
 */
colab.Notebook.prototype.receiveCellMessage = function(message) {
  var data = /** @type {CellMessage} */ (/** @type {?} */ (message.data));
  if (data.target != 'notebook') return;
  /** type {colab.cell.CodeCell} */
  var cell = this.findCellByCellId(data.cellId);

  // For security reasons, ensure that cellId is the id of the cell
  // that sent the message.
  if (cell == null ||
      cell.getOutputArea().outputIframe.contentWindow != message.source) {
    colab.notification.showPrimary('Cell id did not match message source.');
    return;
  }

  if (data.action == 'send_message') {
    if (!this.kernelAccessAllowed(cell)) {
      colab.notification.showPrimary(
          'For security only locally run cells may communicate with kernel. ' +
          'Re-run this cell.');
      return;
    }
    colabtools.sendMessageToKernel(
        data.tag, data.payload,
        function(code) { colab.globalKernel.execute(code); });
    return;
  }
  if (data.action == 'execute_cell') {
    if (!this.kernelAccessAllowed(cell)) {
      colab.notification.showPrimary(
          'For security reasons, only locally run cells may request' +
              ' cell execution. Re-run this cell. ');
      return;
    }

    // execute cell and mark the execution as automatic
    cell.execute(false /* auto */);
  }
  if (data.action == 'register_listener') {
    var listenerId = data.listenerId;
    var cellId = data.cellId;
    var listeners = this.listeners_[listenerId] || [];
    if (listeners.indexOf(cellId) < 0) {
      listeners.push(cellId);
      this.listeners_[listenerId] = listeners;
    }
  }
  if (data.action == 'update_listener') {
    if (!this.kernelAccessAllowed(cell)) {
      colab.notification.showPrimary(
          'For security reasons, only locally run cells may update' +
              ' listeners. Re-run this cell. ');
      return;
    }

    var listenerCellIds = this.listeners_[data.listenerId] || [];
    var that = this;
    goog.array.forEach(listenerCellIds, function(cellId) {
      var c = that.findCellByCellId(cellId);
      if (that.kernelAccessAllowed(c) && c.getOutputArea() &&
          c.getOutputArea().outputIframe.contentWindow) {
        c.getOutputArea().outputIframe.contentWindow.postMessage({
          'listenerId': data.listenerId}, '*');
      }
    });
  }

  if (data.action == 'resize_cell_output') {
    cell.getOutputArea().resizeOutput(data.desiredHeight);
  }
};

/**
 * Move cell up.
 *
 * @param {gapi.drive.realtime.CollaborativeObject?} opt_realtimeCell
 *   Cell being moved
 */
colab.Notebook.prototype.moveCellUp = function(opt_realtimeCell) {
  this.moveCell(-1, opt_realtimeCell);
};

/**
 * Move cell down.
 *
 * @param {gapi.drive.realtime.CollaborativeObject?} opt_realtimeCell
 *   cell being moved
 */
colab.Notebook.prototype.moveCellDown = function(opt_realtimeCell) {
  this.moveCell(1, opt_realtimeCell);
};

/**
 * Moves cell in a given direction
 * @param {number} direction
 * @param {gapi.drive.realtime.CollaborativeObject=} opt_realtimeCell Cell
 *   being moved
 */
colab.Notebook.prototype.moveCell = function(direction, opt_realtimeCell) {
  if (!this.permissions_.isEditable()) {
    return;
  }

  // get the realtimeCell
  var realtimeCell = opt_realtimeCell;
  var selectedIndex = this.getCellIndex(this.selectedCellId_);
  if (realtimeCell === undefined) {
    if (selectedIndex != -1) {
      realtimeCell = /** @type {gapi.drive.realtime.CollaborativeObject} */ (
          this.realtimeCells_.get(selectedIndex));
    } else {
      console.log('Could not move cell because no cell is selected');
      return;
    }
  }

  var index = this.realtimeCells_.indexOf(realtimeCell);

  if (index == -1) {
    console.error('Could not find realtimeCell to move.');
    return;
  }

  var newIndex = index + direction;
  if (newIndex >= 0 && newIndex < this.realtimeCells_.length) {
    this.cellAdded_ = realtimeCell.id;
    this.recordCellMove(realtimeCell, newIndex);
  }
};

/**
 * Records in realtime api the fact that cell has been moved.
 * @param {gapi.drive.realtime.CollaborativeObject} realtimeCell
 * @param {number} newIndex
 */
colab.Notebook.prototype.recordCellMove = function(realtimeCell, newIndex) {
  this.model.beginCompoundOperation();
  this.history_.recordMove(newIndex, realtimeCell);
  this.model.endCompoundOperation();
};

/**
 * @param {gapi.drive.realtime.CollaborativeObject=} opt_realtimeCell
 * if not provided, uses selected cell.
 */
colab.Notebook.prototype.removeCell = function(opt_realtimeCell) {
  var selected = this.getSelectedCell();
  if (!opt_realtimeCell && !selected) return;
  var realtimeCell = opt_realtimeCell || selected.realtimeCell;
  if (selected && realtimeCell != selected.realtimeCell) {
    this.history_.recordDelete(realtimeCell);
    return;
  }
  var index = this.getCellIndex(this.selectedCellId_);
  if (index >= this.cells_.length - 1) { index--; }
  this.history_.recordDelete(realtimeCell);
  if (index >= this.cells_.length) { index--; }
  this.selectCell(this.realtimeCells_.get(index).id);
};

/**
 * Changes selected cell 'delta' cells up or down
 * @param {number} delta
 */
colab.Notebook.prototype.changeSelectedCell = function(delta) {
  var index = this.getCellIndex(this.selectedCellId_);
  var newIndex = index + delta;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= this.realtimeCells_.length) {
    newIndex = this.realtimeCells_.length - 1;
  }
  this.selectCell(this.realtimeCells_.get(newIndex).id);
};

/**
 * Undo last notebook-level action (cell change)
 */
colab.Notebook.prototype.undo = function() {
  this.history_.undo();
};

/**
 * Redo last notebook-level action (cell change)
 */
colab.Notebook.prototype.redo = function() {
  this.history_.redo();
};

/**
 * Saves notebook with notification on the screen
 */
colab.Notebook.prototype.saveNotebook = function() {
  var n = colab.notification.showNotification(
      'Saving...', '', -1);
  colab.drive.saveDocument(
      colab.globalRealtimeDoc,
      function() { n.change('Saved successfully!', 5000); },
      function(err) {
        n.clear();
        colab.dialog.displayError('Failed to save', err);
      },
      {'pinned': true });
};

/**
 * @type {Object}
 */
colab.Notebook.prototype.magicCommands = null;

/**
 * @param {boolean} after
 */
colab.Notebook.prototype.insertCellAtSelection = function(after) {
  this.insertCellAt(this.selectedCellId_, colab.cell.CellType.CODE, after);
};

/**
 * @param {string} realtimeId
 * @param {colab.cell.CellType} cellType
 * @param {boolean} after
 */
colab.Notebook.prototype.insertCellAt = function(realtimeId, cellType, after) {
  var index = this.getCellIndex(realtimeId);
  if (after) { index++; }
  this.addNewCell(cellType, index);
};

/**
 * Setups magic commands for this notebook
 */
colab.Notebook.prototype.setupMagicCommands = function() {
  var notebook = this;

  /**
   * @param {number} sc keyboard keycode
   * @param {function(?)} f
   * @param {string} help
   * @return {colab.KeyboardShortcut}
   */
  var shortcut = function(sc, f, help) {
    return { shortcut: sc, help: help,
             func: goog.bind(f, notebook),
             notimplemented: f == notebook.NotImplemented
           };
  };

  var codes = goog.events.KeyCodes;
  /**
   * Object
   */
  var commands = [
    shortcut(codes.X, this.NotImplemented, 'Cut Cell'),
    shortcut(codes.C, this.NotImplemented, 'Copy Cell'),
    shortcut(codes.V, this.NotImplemented, 'Paste Cell'),

    shortcut(codes.D, function() { this.removeCell(); }, 'Delete Cell'),

    shortcut(codes.Z, this.undo, 'Undo Last Cell Op'),

    shortcut(codes.DASH, this.splitSelectedCellAtCursor, 'Split At Cursor'),

    shortcut(codes.A, goog.bind(this.insertCellAtSelection,
        this, false /* before */), 'Insert Cell Above'),

    shortcut(codes.B, goog.bind(this.insertCellAtSelection,
        this, true /* after */), 'Insert Cell Below'),

    shortcut(codes.O, this.toggleOutput, 'Toggle output'),

    shortcut(codes.L, this.toggleLineNumbers, 'Toggle line numbers'),

    shortcut(codes.NINE,
       goog.bind(this.changeEditorFontSize, this, -1),
       'Editor Font Size++'),

    shortcut(codes.ZERO,
       goog.bind(this.changeEditorFontSize, this, 1),
       'Editor Font Size--'),

    shortcut(codes.S, this.saveNotebook, 'Save and Checkpoint'),

    shortcut(codes.J, this.moveCellDown, 'Move Cell Down'),
    shortcut(codes.K, this.moveCellUp, 'Move Cell Up'),

    shortcut(codes.P, goog.bind(this.changeSelectedCell, this, -1),
             'Previous Cell'),
    shortcut(codes.N, goog.bind(this.changeSelectedCell, this, 1),
             'Next Cell'),
    shortcut(codes.I, function() { colab.globalKernel.interrupt(); },
             'Interrupt Kernel'),
    shortcut(codes.PERIOD, function() { colab.globalKernel.restart(); },
             'Restart Kernel'),
    shortcut(codes.H, this.displayShortcutHelp,
             'Show Keyboard Shortcuts'),

    shortcut(codes.Y, this.NotImplemented, 'Convert to Code Cell'),

    shortcut(codes.M, this.NotImplemented, 'Convert to Markdown Cell')

  ];
  this.magicCommands = {};
  for (var i = 0; i < commands.length; i++) {
    this.magicCommands[commands[i].shortcut] = commands[i];
  }
};

/**
 * Toggles output of currently selected cell, if it has output
 */
colab.Notebook.prototype.toggleOutput = function() {
  var cell = this.getSelectedCell();
  if (!cell || cell.getType() != colab.cell.CellType.CODE) return;
  cell.toggleOutput();
};

/**
 * Shows help on shortcuts
 */
colab.Notebook.prototype.displayShortcutHelp = function() {
  var dialog = new goog.ui.Dialog();
  var msg = '<h3>Notebook</h3><br/><table>';
  var c = 0;
  var toChar = function(code) {
     switch (code) {
       case goog.events.KeyCodes.PERIOD: return '.';
       case goog.events.KeyCodes.DASH: return '-';
       default: return String.fromCharCode(code);
     }
  };

  /**
   * @param {string} shortcut
   * @param {string} help
   * @param {boolean=} notimplemented
   * @return {string}
   */
  var shortcutText = function(shortcut, help, notimplemented) {
    var status = '';
    if (notimplemented) {
      status = 'style="color:gray" title="Not implemented"';
    }
    return '<td>' + shortcut + '</td><td ' + status + '> ' + help + '</td> ';
  };

  for (var i in this.magicCommands) {
    var sc = this.magicCommands[i];
    if (c % 2 == 0) msg += '<tr>';
    msg += shortcutText('Ctrl-M ' + toChar(sc.shortcut),
        sc.help, sc.notimplemented);
    if (c % 2 == 1) {msg += '</tr>'} else { msg += '<td>&nbsp;</td>' }
    c++;
  }
  msg += '<tr><td> <div></div>  </td> </tr>';
  msg += '<tr><td colspan=4><h3>Code Cell</h3> </tr>';
  msg += '<tr>' + shortcutText('Ctrl-/', 'Toggle Comment') + '</tr>';

  msg += '</table>';
  dialog.setContent(msg);
  dialog.setTitle('Keyboard shortcuts');
  dialog.setButtonSet(goog.ui.Dialog.ButtonSet.createOk());
  dialog.setModal(true);
  dialog.setDisposeOnHide(true);

  dialog.setVisible(true);
};

/**
 * Splits cell at cursor
 */
colab.Notebook.prototype.splitSelectedCellAtCursor = function() {
  var cell = this.getSelectedCell();
  var index = this.getCellIndex(this.selectedCellId_);

  if (!cell) return;
  var realtimeCells = cell.splitAtCursor();
  if (!realtimeCells || realtimeCells.length < 2) return;
  this.history_.recordSplit(index, realtimeCells[0], realtimeCells[1]);
};

/**
 * @typedef  {{
 *   shortcut: number,
 *   help: string,
 *   func: (function(colab.KeyboardShortcut, KeyboardEvent): boolean)
 * }}
 */
colab.KeyboardShortcut;

/**
 * @param {KeyboardEvent} ev
 * @return {boolean}
 */
colab.Notebook.prototype.handleMagicKey = function(ev) {
  /**
   * @type {colab.KeyboardShortcut}
   */
  var sc = this.magicCommands[ev.keyCode];
  if (sc && sc.func) {
    sc.func(sc, ev);
    return true;
  }
  return false;
};

/**
 * Toggles line numbers
 */
colab.Notebook.prototype.toggleLineNumbers = function() {
  colab.preferences.showLineNumbers ^= true;
  for (var i = 0; i < this.cells_.length; i++) {
    this.cells_[i].refresh();
  }
};

/**
 * Changes font size by delta
 *
 * @param {number} delta
 */
colab.Notebook.prototype.changeEditorFontSize = function(delta) {
  colab.preferences.fontSize += delta;
  for (var i = 0; i < this.cells_.length; i++) {
    setTimeout(goog.bind(this.cells_[i].refresh, this.cells_[i]), 1);
  }
};
/**
 * @param {colab.KeyboardShortcut} shortcut
 */
colab.Notebook.prototype.NotImplemented = function(shortcut) {
  colab.notification.showPrimary('Shortcut for "' + shortcut.help + '"' +
      ' is not implemented yet.');
};

/**
 * Sets up document keyhandler, which handles global key presses.
 * TODO(kayur): look into browser events for undo and redo.
 */
colab.Notebook.prototype.setupKeyHandler = function() {
  this.setupMagicCommands();
  var notebook = this;
  var docKh = new goog.events.KeyHandler(document);
  var magicMode = false;

  goog.events.listen(docKh, 'key', function(e) {
    if ((e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) &&
         e.keyCode == goog.events.KeyCodes.ENTER) {
      var nextCell = e.shiftKey || e.altKey;
      var create = e.altKey;
      notebook.runSelectedCell(nextCell, create);
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    if (magicMode && notebook.handleMagicKey(e)) {
      e.stopPropagation();
      e.preventDefault();
      // Keep magic mode, so we can do more than one command at a time
      // (e.g. for font changes)
      magicMode = false;
      return;
    }
    magicMode = false;
    if (e.ctrlKey && e.keyCode == goog.events.KeyCodes.M) {
      e.preventDefault();
      magicMode = true;
      return;
    }





    // For whatever reason these get triggered whether in capture
    // or in bubble mode. It might have something to do with codemirror
    // magic, or set of extensions, or google event handler
    // or combination there of. So we manually check if we are in editing
    // mode.
    // TODO(sandler, kayur): maybe this should be an independent operation
    // with different hot key.
    if (document.activeElement.tagName == 'TEXTAREA') return;

    if ((e.metaKey || e.ctrlKey) &&
               e.shiftKey && e.keyCode == goog.events.KeyCodes.Z) {
      notebook.redo();
      e.stopPropagation();
      e.preventDefault();
    } else if ((e.metaKey || e.ctrlKey) &&
               e.keyCode == goog.events.KeyCodes.Z) {
      notebook.undo();
      e.stopPropagation();
      e.preventDefault();
    }
  }, false /* bubble */);
};


/**
 * Handle VALUES_ADDED event for the list of cells.
 * @param {gapi.drive.realtime.ValuesAddedEvent} e Realtime event
 * @private
 * TODO(kayur,kestert): Take into account the dragged cell, which affects
 *     the order of cells so that inserts done this way may be incorrect.
 */
colab.Notebook.prototype.realtimeCellsAdded_ = function(e) {
  var index = e.index;
  /**
   * @type {Array.<gapi.drive.realtime.CollaborativeMap>}
   */
  var values = e.values;

  // Update DOM element content and its parallel structure this.cells_
  var content = goog.dom.getElement('content');

  // Find the "corrected" index, which is index or index - 1 depending
  // on whether the order of elements has been shifted by a local drag
  // drop event.
  var correctedIndex;
  if (index == 0 || index == this.cells_.length) {
    correctedIndex = index;
  } else {
    var elementAbove = this.cells_[index - 1].getElement();
    if (goog.dom.classes.has(elementAbove, 'dragged')) {
      correctedIndex = jQuery(elementAbove).index() + 1;
    } else {
      var elementBelow = this.cells_[index].getElement();
      correctedIndex = jQuery(elementBelow).index();
    }
  }
  if (!(correctedIndex == index || correctedIndex == index - 1)) {
    console.log('warning: encountered inconsistent index correction');
  }

  for (var i = 0; i < values.length; i++) {
    var cell = colab.cell.cellFromRealtime(values[i], this.permissions_);
    cell.render(content);
    goog.dom.removeNode(cell.getElement());
    goog.array.insertAt(this.cells_, cell, index + i);
    goog.style.setElementShown(cell.getElement(), false);
    goog.dom.insertChildAt(content, cell.getElement(), correctedIndex + i);
    var anim = new goog.fx.dom.FadeInAndShow(cell.getElement(),
        colab.Notebook.ANIMATION_DURATION_);
    anim.play();
    cell.refresh();
  }
  // If this event originated locally, then shift focus to the last cell added.
  if (e.isLocal) {
    this.selectCell(this.realtimeCells_.get(index + values.length - 1).id);
  }

  if (this.permissions_.isEditable()) {
    this.makeDraggable_();
  }
};

/**
 * Handle VALUES_REMOVED event for the list of cells.
 *
 * @param {gapi.drive.realtime.ValuesRemovedEvent} e Realtime event
 * @private
 */
colab.Notebook.prototype.realtimeCellsRemoved_ = function(e) {
  var index = e.index; // The index to add the new values
  var values = e.values; // The values to add
  for (var i = 0; i < values.length; i++) {
    // Note content adjusts immediately.
    var cellElem = this.cells_[index].getElement();
    goog.array.removeAt(this.cells_, index);

    if (e.isLocal) {
      goog.dom.removeNode(cellElem);
    } else {
      // NOTE: this animation strategy could be dangerous because the element
      // is nore removed until after the animation is finished. That might lead
      // strage behavior if the user tries to interact with the element or move
      // the element when it is animating out. It might also lead to strange
      // behavior if the element is being added right after this element is
      // being deleted. Also for local changes it creates strange behavior on
      // drag and drop. For that reason we only animate on remote deletions.
      var anim = new goog.fx.dom.FadeOutAndHide(cellElem,
        colab.Notebook.ANIMATION_DURATION_);
      goog.events.listen(anim, goog.fx.Transition.EventType.END, function() {
        goog.dom.removeNode(cellElem);
      });
      anim.play();
    }
  }

  // TODO(kestert): if a selected cell was removed, select the next cell.
  if (this.permissions_.isEditable()) {
    this.makeDraggable_();
  }
};

/**
 * Handle VALUES_SET event for the list of cells.
 *
 * @param {gapi.drive.realtime.ValuesSetEvent} e Realtime event
 * @private
 */
colab.Notebook.prototype.realtimeCellsSet_ = function(e) {
  var index = e.index; // The index to add the new values
  /**
   * @type {Array.<gapi.drive.realtime.CollaborativeMap>}
   */
  var values = e.newValues; // The values to add
  var content = goog.dom.getElement('content');
  var children = goog.dom.getChildren(content);
  for (var i = 0; i < values.length; i++) {
    var cell = colab.cell.cellFromRealtime(values[i], this.permissions_);

    // TODO(sandler,kayur): remove this hack once colab.Notebook is also a
    // goog.component subclass.
    if (cell.getElement() == null) {
      cell.render(content);
      goog.dom.removeNode(cell.getElement());
    }

    this.cells_[index + i] = cell;
    goog.dom.replaceNode(cell.getElement(), children[index + i]);
    cell.refresh();
  }

  // TODO(kestert): if a selected cell was set, ensure the replacement cell
  // is still selected.

  if (this.permissions_.isEditable()) {
    this.makeDraggable_();
  }
};


/**
 * Custom dragger for cells
 * @constructor
 * @extends {goog.fx.DragListGroup}
 */
colab.CellDragger = function() {
  goog.base(this);
};
goog.inherits(colab.CellDragger, goog.fx.DragListGroup);

/**
 * @inheritDoc
 */
colab.CellDragger.prototype.createDragElementInternal = function(sourceEl) {
  var element = goog.fx.Dragger.cloneNode(sourceEl);
  var iframes = element.getElementsByTagName('iframe');
  for (var i = 0; i < iframes.length; i++) {
    iframes[i].remove();
  }

  // set width to current width
  goog.style.setWidth(element, goog.style.getSize(sourceEl).width);
  return element;
};


/**
 * Make cells draggable.
 * @private
 */
colab.Notebook.prototype.makeDraggable_ = function() {
  // make cells draggable
  var dlg = new colab.CellDragger();
  dlg.addDragList(goog.dom.getElement('content'),
      goog.fx.DragListDirection.DOWN, true);
  dlg.setDragItemHoverClass('dragged');
  dlg.setCurrDragItemClass('dragitem');

  dlg.init();

  goog.events.listen(dlg, goog.fx.DragListGroup.EventType.BEFOREDRAGSTART,
      goog.bind(function(e) {
        if (!goog.dom.classes.has(e.event.target, 'cell-handle')) {
          e.preventDefault();
          return;
        }

        this.selectCell(e.currDragItem.id);
        this.findCellByCellId(e.currDragItem.id).setDragging(true);
      }, this));

  goog.events.listen(dlg, goog.fx.DragListGroup.EventType.DRAGEND,
      goog.bind(function(e) {
        // turn off dragging state
        this.findCellByCellId(e.draggerEl.id).setDragging(false);

        // to move the element first delete it and then add it.
        // TODO(kayur): change to closure when refactoring.
        var insertIndex = jQuery('#' + e.draggerEl.id).index();
        var removeIndex = goog.array.findIndex(this.cells_, function(c) {
          return c.realtimeCell.id == e.draggerEl.id;
        });

        // only swap if the element has been moved
        if (insertIndex != removeIndex) {
          var realtimeCell =
              /** @type {gapi.drive.realtime.CollaborativeObject} */ (
                  this.realtimeCells_.get(removeIndex));
          this.recordCellMove(realtimeCell, insertIndex);
        } else {
          this.cells_[insertIndex].refresh();
        }
    }, this));
};

/**
 *
 * Currently selected cell
 *
 * @type {colab.cell.Cell}
 * @private
 */
colab.Notebook.prototype.selectedCell_ = null;

/**
 * Reutrns currently selected cell
 * @return {colab.cell.Cell}
 */
colab.Notebook.prototype.getSelectedCell = function()  {
  return this.selectedCell_;
};

/**
 * Select a cell. Unselect previously selected cell.
 *
 * @param {string} id The realtimeCell id
 */
colab.Notebook.prototype.selectCell = function(id) {
  if (!this.permissions_.isEditable()) {
    return;
  }

  // set the selected cell id and get the cell
  var prevSelectedId = this.selectedCellId_;
  this.selectedCellId_ = id;
  var selectedCell = this.findCellByCellId(id);

  this.selectedCell_ = selectedCell;

  // check to see if cell exists and is not already selected
  if (!selectedCell || selectedCell.isSelected()) {
    return;
  }

  // the refresh for OSX screws up the scoll position, so we
  // store previous scroll position to reset it later.
  var prevScrollY = window.scrollY;

  // unselect all other cells
  goog.array.forEach(this.cells_, function(cell) {
    cell.setSelected(false);
  });

  // reset scroll position
  window.scrollTo(window.scrollX, prevScrollY);

  // selecte cell, show cell, and focus on the editor if it's a code cell
  selectedCell.setSelected(true);

  selectedCell.scrollIntoView();

  // TODO(kayur): this logic should be moved into cell itself
  if (selectedCell.getType() == colab.cell.CellType.CODE &&
      prevSelectedId != this.selectedCellId_) {
    selectedCell.focusOnEditor();
  }
};

/**
 * Runs range of of cells [startCell, endCell)
 *
 * @param {number} startCell - inclusive
 * @param {number} endCell - exclusive
 */
colab.Notebook.prototype.runRange = function(startCell, endCell) {
  if (!this.permissions_.isEditable()) {
    colab.notification.showPrimary(
        'Running read-only notebook is not yet supported.');
    return;
  }
  startCell = Math.max(0, startCell);
  endCell = Math.min(this.cells_.length, endCell);
  for (var i = startCell; i < endCell; i++) {
    var cell = this.cells_[i];
    if (cell.getType() == colab.cell.CellType.CODE &&
        !cell.isTrustedContent()) {
      colab.notification.showPrimary(
          ' Some cells were modified outside of this session. ' +
          ' For security reasons run this notebook manually first.');
      return;
    }
  }

  for (var i = startCell; i < endCell; i++) {
    var cell = this.cells_[i];
    if (cell.getType() == colab.cell.CellType.CODE) {
      cell.execute();
    }
  }
};

/**
 * Runs all the cells starting from the top.
 */
colab.Notebook.prototype.runAll = function() {
  this.runRange(0, this.cells_.length);
};

/**
 * Runs all cells up to the selected one
 */
colab.Notebook.prototype.runBefore = function() {
  var idx = this.getCellIndex(this.selectedCellId_);
  if (idx >= 0) {
    this.runRange(0, idx);
  }
};

 /**
 * Runs all cells after selected
 */
colab.Notebook.prototype.runAfter = function() {
  var idx = this.getCellIndex(this.selectedCellId_);
  if (idx >= 0) {
    this.runRange(idx, this.cells_.length);
  }
};

/**
 * Run selected cell. Repeats the beahvior of IPython notebook. Running a text
 * cell doesn't do anything. Running a code cell will execute the code.
 *
 * There is also an option to move to the next cell. If there is no next cell,
 * it will create a new code cell.
 *
 * @param {boolean} opt_nextCell Move to next cell if true
 * @param {boolean} opt_insert if true, will insert the empty cell
 *   (if opt_nextCell)
 */
colab.Notebook.prototype.runSelectedCell = function(opt_nextCell, opt_insert) {
  if (!this.permissions_.isEditable()) {
    colab.notification.showPrimary('Running read-only notebooks is ' +
        ' not yet supported.');
    return;
  }

  // only run if a cell is selected
  var selectedIndex = this.getCellIndex(this.selectedCellId_);
  if (selectedIndex == -1) {
    return;
  }

  // get cell and execute if it's a code cell
  var cell = this.cells_[selectedIndex];
  // for non code cells  we just advance forward.
  var executed = true;
  if (cell.getType() == colab.cell.CellType.CODE) {
    executed = cell.execute(true);
  }

  if (!opt_nextCell || !executed) {
    return;
  }

  // add new code cell if this is the last cell.
  if (selectedIndex == (this.cells_.length - 1) || opt_insert) {
    cell.setSelected(false);
    this.addNewCell(colab.cell.CellType.CODE, selectedIndex + 1);
  } else {
    // select next cell
    cell = this.cells_[selectedIndex + 1];
    this.selectCell(cell.realtimeCell.id);
  }
};

/**
 * Clears all data from notebook and dom.
 */
colab.Notebook.prototype.clear = function() {
  if (!this.permissions_.isEditable()) {
    return;
  }
  this.realtimeCells_.clear();
};

/**
 * removes the collaborator
 * @param {gapi.drive.realtime.Collaborator} c
 */
colab.Notebook.prototype.removeCollaborator = function(c) {
  goog.array.forEach(this.cells_, function(cell) {
    cell.removeCollaborator(c);
  });
};


/**
 * Clears outputs of the code cells.
 */
colab.Notebook.prototype.clearOutputs = function() {
  if (!this.permissions_.isEditable()) {
    return;
  }

  goog.array.forEach(this.cells_, function(cell) {
    if (cell.getType() === colab.cell.CellType.CODE) {
      cell.clearOutput();
    }
  });
};


/**
 * Clear notebook state. Used when kernel is reset.
 */
colab.Notebook.prototype.reset = function() {
  goog.array.forEach(this.cells_, function(cell) {
    cell.reset();
  });
};
