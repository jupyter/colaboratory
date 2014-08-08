goog.provide('colab.cell.Cell');
goog.provide('colab.cell.CellType');

goog.require('colab.Global');
goog.require('colab.Shadow');
goog.require('colab.SvgButton');
goog.require('colab.cell.AddCell');
goog.require('colab.presence');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.dom.classlist');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.style');
goog.require('goog.ui.Component');
goog.require('goog.ui.Container');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.ToolbarButton');
goog.require('goog.ui.ToolbarMenuButton');


/**
 * Type of cells. Both colab types and IPython types.
 * @enum {string}
 */
colab.cell.CellType = {
  CODE: 'code', // used by both colab and IPython
  HEADING: 'heading', // used only by IPython
  MARKDOWN: 'markdown', //used only by IPython
  TEXT: 'text' // only used by colab
};

/**
 * CSS classes for cell toolbar buttons.
 * @enum {string}
 */
colab.cell.ToolBarButton = {
  CLEAR: 'cell-clear-output-button', // used by colab.cell.CodeCell
  DELETE: 'cell-delete-button',
  RUN_INTERRUPT: 'cell-run-interrupt-button',
  INTERRUPT: 'cell-interrupt-button', // used by colab.cell.CodeCell
  RUN: 'cell-run-button', // used by colab.cell.CodeCell
  TOGGLE: 'cell-toggle-button' //  used by colab.cell.CodeCell
};


/**
 * A cell in the coLaboratory notebook. A cell is backed by a realtime cell.
 * The base cell class provides a default set of toolbar functions
 * (inserting, moving, deleting).
 *
 * @constructor
 * @param {gapi.drive.realtime.CollaborativeMap} realtimeCell The realtime cell
 * @param {!colab.drive.Permissions} permissions Drive permissions
 * @extends {goog.ui.Component}
 */
colab.cell.Cell = function(realtimeCell, permissions) {
  goog.base(this);

  /** @type {gapi.drive.realtime.CollaborativeObject} */
  this.realtimeCell = realtimeCell;

  /** @private {boolean} Realtime updating to lock editor. */
  this.updating_ = false;

  /** @protected {Element} Main content of the cell. */
  this.mainContentDiv = goog.dom.createDom(goog.dom.TagName.DIV,
      'main-content');

  /** @protected {!colab.drive.Permissions} Drive permissions */
  this.permissions = permissions;

  /** @protected {gapi.drive.realtime.Collaborator} */
  this.me = colab.Global.getInstance().me;

  if (this.permissions.isEditable()) {
    /** @protected {Element} The element (div) that contains the toolbar. */
    this.toolbarDiv = goog.dom.createDom(goog.dom.TagName.DIV, 'cell-toolbar');

    /** @protected {!goog.ui.Toolbar} */
    this.toolbar = this.createToolbar();
    this.addChild(this.toolbar);
    this.toolbar.render(this.toolbarDiv);
  }

  /** @private {colab.cell.AddCell} To add cells after this cell */
  this.addCell_ = new colab.cell.AddCell(permissions, this.realtimeCell.id);
  this.addChild(this.addCell_, true);

  // create a global map of cells
  // TODO(sandler,kayur): deal with cell deletions.
  colab.cell.Cell.idToCellMap[this.realtimeCell.id] = this;

};
goog.inherits(colab.cell.Cell, goog.ui.Component);


/**
 * Contains mapping from cellId to Cell object
 * @type {Object}
 */
colab.cell.Cell.idToCellMap = {};


/**
 * Reset state.
 */
colab.cell.Cell.prototype.reset = function() { };


/**
 * Scroll cell to view. If the cell is fully visible, don't scroll. If the
 * Cell is obstructed from the top scroll down. If the cell is obstructed
 * from the bottom scroll up. If cell is larger than window height
 * scroll minimal length so that it occupies entire window.
 *
 * @param {function()=} opt_callback to call when finished scroll animation
 */
colab.cell.Cell.prototype.scrollIntoView = function(opt_callback) {
  var callback = opt_callback || function() {};

  var cellBounds = goog.style.getBounds(this.getElement());
  var container = goog.dom.getElementByClass('notebook-container');
  var nbBounds = goog.style.getBounds(container);

  var topY = cellBounds.top - nbBounds.top;
  var bottomY = topY + cellBounds.height;

  // Change in scroll value to put cell 10px in from top/bottom of container
  var deltaYTop = topY - 10;
  var deltaYBottom = bottomY - nbBounds.height + 10;

  if (topY < 0 && bottomY > nbBounds.height) {
    // Do nothing, since topY is above the window boundary
    // and bottomY is below, so we already cover the entire screen
    // and can't improve position.
    callback();
    return;
  }

  if (topY > 0 && bottomY < nbBounds.height) {
    // Do nothing, since we are fully in screen already
    callback();
    return;
  }
  // Align either top or bottom, whichever ends up producing less scrolling.
  var deltaY = Math.abs(deltaYTop) < Math.abs(deltaYBottom) ?
      deltaYTop : deltaYBottom;
  jQuery(container).animate({'scrollTop': container.scrollTop + deltaY}, {
    duration: 100,
    complete: callback
  });
};


/**
 * @return {boolean}
 */
colab.cell.Cell.prototype.isVisible = function() {
  var bounds = goog.style.getBounds(this.getElement());
  var topY = bounds.top - window.scrollY;
  var bottomY = topY + bounds.height;
  var topHeight = 120;
  if (topY < topHeight && bottomY < topHeight) return false;
  if (topY > window.innerHeight && bottomY > window.innerHeight) return false;
  return true;
};


/**
 * Gets the cell container that this cell is part of. The container should be a
 * type that contains cells and can do basic cell manipulations (e.g., adding,
 * removing, reordering).
 *
 * @return {!colab.Notebook}
 */
colab.cell.Cell.prototype.getCellContainer = function() {
  return /** @type {!colab.Notebook} */ (this.getParent());
};


/**
 * Create cell toolbar.
 * TODO(kayur): Change access to global functions to use an events
 * @return {!goog.ui.Toolbar}
 * @protected
 */
colab.cell.Cell.prototype.createToolbar = function() {
  var toolbar = new goog.ui.Toolbar();

  var deleteButton = new colab.SvgButton('img/delete-icon', 'Delete cell');
  goog.events.listen(deleteButton, goog.ui.Component.EventType.ACTION,
      function(e) {
        this.getCellContainer().removeCell(this.realtimeCell);
      }, false /* Don't fire on capture */, this);
  toolbar.addChild(deleteButton, true);
  goog.dom.classlist.add(deleteButton.getElement(),
      colab.cell.ToolBarButton.DELETE);

  return toolbar;
};


/**
 * Gets the type for the cell.
 * @return {string} The type of the cell
 */
colab.cell.Cell.prototype.getType = function() {
  return this.realtimeCell.get('type');
};


/** @private {string} Selected class css name */
colab.cell.Cell.SELECTED_CSS_NAME_ = 'selected';


/**
 * @return {?colab.cell.Editor|undefined}
 */
colab.cell.Cell.prototype.getEditor = function() {
  return this.editor_;
};


/**
 * @return {?Array.<string>}
 */
colab.cell.Cell.prototype.splitAtCursor = function() {
  var editor = this.getEditor();

  if (!editor) return null;
  var first = editor.getRange(undefined, editor.getCursor());
  var second = editor.getRange(editor.getCursor());
  if (!first || !second) return null;
  else return [first, second];
};


/**
 * Toggles cell selection.
 * @param {boolean} value True if selected
 */
colab.cell.Cell.prototype.setSelected = function(value) {
  if (this.isSelected() == value) {
    return;
  }
  goog.dom.classlist.enable(this.getElement(),
      colab.cell.Cell.SELECTED_CSS_NAME_, value);
  this.shadow_.setZ(value ? 2 : 0);

  var collaborators = this.realtimeCell.get('collaborators');
  var me = this.me;
  // if the current user already exists in the collaborators list remove them.
  // Note this will only remove one element, but there should never be more
  // than one element that points to our
  var isMe = goog.bind(function(c) {
    return c.sessionId === me.sessionId && c.userId === me.userId;
  }, this);
  var meIndex = goog.array.findIndex(collaborators.asArray(), isMe);

  if (meIndex != -1) {
    collaborators.remove(meIndex);
  }

  // reinsert at the front of the list if selected
  if (value) {
    // the same person in will appear twice in the list if they select the same
    // cell in different sessions.
    collaborators.insert(0, this.me);
    var focus = goog.bind(function() {
      // TODO(jasnyder): this circularly calls notebook.selectCell, refactor
      // with events
      if (this.getType() == colab.cell.CellType.CODE) this.focusOnEditor();
    }, this);
    this.scrollIntoView(focus);
  }

};


/**
 * Refresh the cell dom.
 */
colab.cell.Cell.prototype.refresh = function() { };


/**
 * Change the cell if it is being dragged.
 * @param {boolean} value True if cell is being dragged
 */
colab.cell.Cell.prototype.setDragging = function(value)  {
  console.debug(this.realtimeCell.id +
      (value ? ': start dragging' : ': finish dragging'));
};


/**
 * @return {boolean} True if cell is selected.
 */
colab.cell.Cell.prototype.isSelected = function() {
  return goog.dom.classlist.contains(this.getElement(),
      colab.cell.Cell.SELECTED_CSS_NAME_);
};


/**
 * Updates the collaborative presence for the cell.
 * @private
 */
colab.cell.Cell.prototype.updateCollaborators_ = function() {
  // filter collaborators to only be global
  var globalCollaborators =
      this.getCellContainer().notebookModel.getDocument().getCollaborators();
  var collaborators = this.realtimeCell.get('collaborators');
  if (this.permissions.isEditable()) {
    goog.array.forEach(collaborators.asArray(), function(collaborator, index) {
      var globalCollaborator = goog.array.find(globalCollaborators,
          function(c) {
            return c.sessionId === collaborator.sessionId &&
                c.userId === collaborator.userId;
          });

      if (!globalCollaborator) {
        collaborators.remove(index);
      }
    });
  }

  var collabs = this.getElementByClass('collaborators-container');
  colab.presence.populateCollaboratorsDiv(
      collabs, collaborators.asArray(), 3);

  // set the offset of -4 minus the width of the div so that the collaborators
  // appear the right of the cell.
  var collabDiv = this.getElementByClass('cell-collaborators');
  var rightOffset = -4 - goog.style.getBounds(collabDiv).width;
  collabDiv.style.right = rightOffset.toString() + 'px';
};


/** @override */
colab.cell.Cell.prototype.createDom = function() {
  // set the element to the cellDiv
  var element = goog.dom.createDom(goog.dom.TagName.DIV,
      {'class': 'cell ' + this.getType(), 'id': this.realtimeCell.id});

  // TODO (jasnyder) redo drag with new handle

  // set the create the main content div
  // create collaborators div
  var collaborators = goog.dom.createDom('div', 'cell-collaborators');
  goog.dom.appendChild(element, collaborators);
  goog.dom.appendChild(collaborators,
      goog.dom.createDom('div', 'collaborators-container'));

  goog.dom.appendChild(element, this.mainContentDiv);

  /** @private @type {colab.Shadow} */
  this.shadow_ = new colab.Shadow([this.mainContentDiv, collaborators], 0);

  if (!this.permissions.isEditable()) {
    goog.dom.classlist.add(element, 'readonly');
  }

  this.setElementInternal(element);
};


/**
 * Handler for selecting cells.
 * @param {goog.events.Event} e Click event
 * @protected
 */
colab.cell.Cell.prototype.selectCellHandler = function(e) {
  this.getCellContainer().selectCell(this.realtimeCell.id);
};


/**
 * Handle window resizing by repositioning the add cell buttons attached to this
 * cell
 */
colab.cell.Cell.prototype.onWindowResize = function() {
  this.addCell_.onWindowResize();
};


/**
 * Remove collaborator from collaborator list.
 * @param {gapi.drive.realtime.Collaborator} collaborator
 */
colab.cell.Cell.prototype.removeCollaborator = function(collaborator) {
  var collabList = this.realtimeCell.get('collaborators');

  // remove all instances of the user from the collaborators list
  goog.array.forEach(collabList.asArray(), function(c, index) {
    if (c.sessionId === collaborator.sessionId &&
        c.userId === collaborator.userId) {
      collabList.remove(index);
    }
  });
};



/** @override */
colab.cell.Cell.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // listen to updates on collaborators
  var collabList = this.realtimeCell.get('collaborators');
  collabList.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED,
      goog.bind(this.updateCollaborators_, this));
  collabList.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED,
      goog.bind(this.updateCollaborators_, this));
  collabList.addEventListener(gapi.drive.realtime.EventType.VALUES_SET,
      goog.bind(this.updateCollaborators_, this));
  // Consider making these functions more efficient.
  this.updateCollaborators_();

  if (this.permissions.isEditable()) {
    var toolbarDiv = this.toolbarDiv;
    var handler = this.getHandler();
    handler.listen(this.toolbarDiv, goog.events.EventType.CLICK,
        function(e) {
          if (e.target == toolbarDiv) {
            // hide toolbar
            goog.style.setElementShown(e.target, false);

            // find underlying cell if there is one and click that cell
            var newTarget = document.elementFromPoint(e.clientX, e.clientY);
            var cellParent = goog.dom.getAncestorByClass(newTarget, 'cell');
            if (cellParent) {
              var event = document.createEvent('UIEvents');
              event.initUIEvent(goog.events.EventType.CLICK,
                  true, true, window, 1);
              cellParent.dispatchEvent(event);
            }

            // remove hide
            goog.style.setStyle(e.target, 'display', '');
          }
        }, false);

    // add selection on click event
    // TODO(kayur): turn into a CellEvent and move to constructor.
    handler.listen(this.mainContentDiv, goog.events.EventType.CLICK,
        goog.bind(this.selectCellHandler, this), false);

    handler.listenWithScope(this.mainContentDiv,
        goog.events.EventType.MOUSEENTER, function(e) {
          if (!this.isSelected()) {
            this.shadow_.setZ(1);
          }
        }, false, this);
    handler.listenWithScope(this.mainContentDiv,
        goog.events.EventType.MOUSELEAVE, function(e) {
          if (!this.isSelected()) {
            this.shadow_.setZ(0);
          }
        }, false, this);
  }
};
