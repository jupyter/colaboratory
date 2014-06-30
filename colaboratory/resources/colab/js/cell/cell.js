/**
 *
 * @fileoverview The base class for a coLaboratory notebook Cell.
 *
 * TODO(kayur): create CellEvents and pass message to notebook through those
 *     events.
 *
 * TODO(kayur): add Componenet setModel and getModel.
 */

goog.provide('colab.cell.Cell');

goog.require('colab.Presence');
goog.require('colab.drive.Permissions');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.ui.Component');
goog.require('goog.ui.Container.Orientation');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Toolbar');
goog.require('goog.ui.ToolbarButton');
goog.require('goog.ui.ToolbarMenuButton');

/**
 * A cell in the coLaboratory notebook. A cell is backed by a realtime cell.
 * The base cell class provides a default set of toolbar functions
 * (inserting, moving, deleting).
 *
 * @constructor
 * @param {gapi.drive.realtime.CollaborativeMap} realtimeCell The realtime cell
 * @param {colab.drive.Permissions} permissions Drive permissions
 * @extends goog.ui.Component
 */
colab.cell.Cell = function(realtimeCell, permissions) {
  goog.base(this);

  /** @type {gapi.drive.realtime.CollaborativeObject} */
  this.realtimeCell = realtimeCell;

  /**  @protected {Element} The element (div) that contains the toolbar. */
  this.toolbarDiv = null;

  /** @protected {goog.ui.Component} The element toolbar component. */
  this.toolbar = null;

  /** @private {boolean} Realtime updating to lock editor. */
  this.updating_ = false;

  /** @protected {Element} Main content of the cell. */
  this.mainContentDiv = null;

  /** @protected {colab.drive.Permissions} Drive permissions */
  this.permissions = permissions;

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
 * Reset state
 */
colab.cell.Cell.prototype.reset = function() { };

/**
 * Scroll cell to view. If the cell is fully visible, don't scroll. If the
 * Cell is obstructed from the top scroll down. If the cell is obstructed
 * from the bottom scroll up. If cell is larger than window height
 * scroll minimal length so that it occupies entire window.
 */
colab.cell.Cell.prototype.scrollIntoView = function() {
  var bounds = goog.style.getBounds(this.getElement());
  var topY = bounds.top - window.scrollY;
  var bottomY = topY + bounds.height;

  // TODO(kayur): remove this hard coded value, here to represent the height
  //    of the top header.
  var topHeight = 120;
  // aligns top with the top of the screen
  var scrollToTop = bounds.top - topHeight;
  // aligns bottom with the bottom
  var scrollToBottom = bounds.top - window.innerHeight + bounds.height + 10;
  if (topY < topHeight && bottomY > window.innerHeight) {
      // Do nothing, since topY is above the window boundary
      // and bottomY is below, so we already cover the entire screen
      // and can't improve position.
    return;
  }

  if (topY > topHeight && bottomY < window.innerHeight) {
      // Do nothing, since we are fully in screen already
    return;
  }
  // Align either top or bottom, whichever ends up producing less scrolling.
  if (Math.abs(scrollToTop - window.scrollY) <
      Math.abs(scrollToBottom - window.scrollY)) {
    jQuery('html, body').animate({'scrollTop': scrollToTop});
  } else {
    jQuery('html, body').animate({'scrollTop': scrollToBottom});
  }
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
 * Create cell toolbar.
 * TODO(kayur): Change access to global functions to use an events
 *
 * @protected
 */
colab.cell.Cell.prototype.createToolbar = function() {
  this.toolbar = new goog.ui.Toolbar();
  this.toolbar.setOrientation(goog.ui.Container.Orientation.VERTICAL);

  // add menu for appending cells before and after
  var insertMenu = new goog.ui.ToolbarMenuButton('Insert');
  var addCellInsertMenuItem = goog.bind(function(title, cellType, after) {
    var menuItem = new goog.ui.MenuItem(title);
    insertMenu.addItem(menuItem);
    this.getHandler().listenWithScope(menuItem,
      goog.ui.Component.EventType.ACTION, function(e) {
      colab.globalNotebook.insertCellAt(this.realtimeCell.id, cellType, after);
    }, false, this);
  }, this);

  addCellInsertMenuItem('Code Above', colab.cell.CellType.CODE, false);
  addCellInsertMenuItem('Code Below', colab.cell.CellType.CODE, true);
  addCellInsertMenuItem('Text Above', colab.cell.CellType.TEXT, false);
  addCellInsertMenuItem('Text Below', colab.cell.CellType.TEXT, true);

  // add events
  var events = [goog.ui.Component.EventType.SHOW,
    goog.ui.Component.EventType.HIDE];
  goog.events.listen(insertMenu, events, function(e) {
    switch (e.type) {
      case goog.ui.Component.EventType.SHOW:
        goog.dom.classes.add(this.toolbarDiv, 'cell-toolbar-visible');
        break;
      case goog.ui.Component.EventType.HIDE:
        goog.dom.classes.remove(this.toolbarDiv, 'cell-toolbar-visible');
        break;
    }
  }, false, this);
  this.toolbar.addChild(insertMenu, true);

  var deleteButton = new goog.ui.ToolbarButton('Delete');
  goog.events.listen(deleteButton, goog.ui.Component.EventType.ACTION,
      function(e) {
        colab.globalNotebook.removeCell(this.realtimeCell);
      }, false /* Don't fire on capture */, this);
  this.toolbar.addChild(deleteButton, true);
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
 * @return {?Array.<gapi.drive.realtime.CollaborativeMap>}
 */
colab.cell.Cell.prototype.splitAtCursor = function() {
  var editor = this.getEditor();

  if (!editor) return null;
  var first = editor.getRange(undefined, editor.getCursor());
  var second = editor.getRange(editor.getCursor());
  if (!first || !second) return null;
  var model = colab.globalNotebook.model;
  var cell1 = colab.cell.newRealtimeCell(model, this.getType(), first);
  var cell2 = colab.cell.newRealtimeCell(model, this.getType(), second);
  return [cell1, cell2];
};

/**
 * Toggles cell selection.
 * @param {boolean} value True if selected
 */
colab.cell.Cell.prototype.setSelected = function(value) {
  if (this.isSelected() == value) {
    return;
  }

  var collaborators = this.realtimeCell.get('collaborators');

  // if the current user already exists in the collaborators list remove them.
  // Note this will only remove one element, but there should never be more
  // than one element that points to our
  var meIndex = goog.array.findIndex(collaborators.asArray(), function(c) {
    return c.sessionId === colab.globalMe.sessionId &&
      c.userId === colab.globalMe.userId;
  });

  if (meIndex != -1) {
    collaborators.remove(meIndex);
  }

  // reinsert at the front of the list if selected
  if (value) {
    // the same person in will appear twice in the list if they select the same
    // cell in different sessions.
    collaborators.insert(0, colab.globalMe);
  }

  goog.dom.classes.enable(this.getElement(),
      colab.cell.Cell.SELECTED_CSS_NAME_, value);
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
  return goog.dom.classes.has(this.getElement(),
      colab.cell.Cell.SELECTED_CSS_NAME_);
};

/**
 * Updates the collaborative presence for the cell.
 * @private
 */
colab.cell.Cell.prototype.updateCollaborators_ = function() {
  // filter collaborators to only be global
  var globalCollaborators =
      colab.drive.globalNotebook.getDocument().getCollaborators();
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

  var collabDiv = this.getElementByClass('cell-collaborators');
  colab.populateCollaboratorsDiv(collabDiv, collaborators.asArray(), 3);

  // set the offset of -4 minus the width of the div so that the collaborators
  // appear the right of the cell.
  var rightOffset = -4 - goog.style.getBounds(collabDiv).width;
  collabDiv.style.right = rightOffset.toString() + 'px';
};

/** @inheritDoc */
colab.cell.Cell.prototype.createDom = function() {
  // set the element to the cellDiv
  var element = goog.dom.createDom('div',
      {'class': 'cell ' + this.getType(), 'id': this.realtimeCell.id});

  // set the cell handle
  var cellHandle = goog.dom.createDom('div', 'cell-handle',
      [goog.dom.createDom('div', 'line'),
       goog.dom.createDom('div', 'line'),
       goog.dom.createDom('div', 'line')]);
  goog.dom.appendChild(element, cellHandle);

  // create the selectionDiv needed to show selection border when hovering
  var selectionDiv = goog.dom.createDom('div', 'selection-wrapper');
  goog.dom.appendChild(element, selectionDiv);

  // set the create the main content div
  this.mainContentDiv = goog.dom.createDom('div', 'main-content');
  goog.dom.appendChild(selectionDiv, this.mainContentDiv);

  // create toolbar div
  if (this.permissions.isEditable()) {
    this.toolbarDiv = goog.dom.createDom('div', 'cell-toolbar');
    goog.dom.appendChild(this.mainContentDiv, this.toolbarDiv);
  } else {
    goog.dom.classes.add(element, 'readonly');
  }

  // create collaborators div
  goog.dom.appendChild(element,
      goog.dom.createDom('div', 'cell-collaborators'));

  this.setElementInternal(element);
};

/**
 * Handler for selecting cells.
 * @param {goog.events.Event} e Click event
 * @protected
 */
colab.cell.Cell.prototype.selectCellHandler = function(e) {
  // only select if we did not click on the toolbar.
  if (goog.dom.findCommonAncestor(/** @type {Node} */ (e.target),
      this.toolbarDiv) != this.toolbarDiv) {
    colab.globalNotebook.selectCell(this.realtimeCell.id);
  }
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

/** @inheritDoc */
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
    this.createToolbar();
    this.addChild(this.toolbar);
    this.toolbar.render(this.toolbarDiv);
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
    handler.listen(this.getElement(), goog.events.EventType.CLICK,
        goog.bind(this.selectCellHandler, this), false);
  }
};
