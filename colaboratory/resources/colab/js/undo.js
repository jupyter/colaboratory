/**
 * Maintains undo list.
 *
 * @fileoverview undo
 *
 */
goog.provide('colab.Undo');



/**
 * Maintains undo/redo stack for list operations (e.g.
 * insertion and deletion)
 * @constructor
 * @param {gapi.drive.realtime.CollaborativeList} cells -
 *    backing array for all the cells.
 *
 *   Meant to be used with gapi.drive.realtime.CollaborativeList.
 *   But any array can be used with minimal modifications:
 *    list = [1,2,3,4,5,6];
 *    list.insert = function(pos, v) { list.splice(pos, 0, v); };
 *    list.get = function(pos) { return list[pos]; };
 *    list.removeValue = function(v) { list.splice(list.indexOf(v), 1); };
 *    undo = new colab.Undo(list);
 *
 * TODO(sandler): consider to make stack and redostack collaborative as well.
 */
colab.Undo = function(cells) {
  this.cells = cells;
  /**
   * @type {Array.<colab.Undo.Operation>} undo stack
   */
  this.stack = [];
  /**
   * @type {Array.<colab.Undo.Operation>} redo stack
   */
  this.redoStack = [];
};


/**
 * Different operations for which we support undo
 * @enum {string}
 */
colab.Undo.OpType = {
  INSERT: 'insert',
  DELETE: 'delete'
};


/**
 * Returns cell which is immediately after 'cell'
 * @param {Object} cell
 * @return {Object|string|undefined}
 */
colab.Undo.prototype.findNextCell = function(cell) {
  var idx = this.cells.indexOf(cell);
  if (idx < 0) return undefined;
  if (idx == this.cells.length - 1) return null;
  return this.cells.get(idx + 1);
};



/**
 * Maintains single undo operation.
 * thisCell contains cell which which is being manipulated
 * nextCell contains the cell which is immediately after.
 * @constructor
 * @param {colab.Undo.OpType} type
 * @param {Object|string} thisCell
 * @param {Object|string} nextCell
 * @param {number=} opt_numCompounded if provided, this undo operation
 * will compound that many elements on the stack.
 * Note: only the top's element on the stack compound matters, so
 * if the top element has nuMCompound = 2, and next has 10. Only 2 elements
 * will be compounded.
 */
colab.Undo.Operation = function(type, thisCell, nextCell, opt_numCompounded) {
  this.type = type;
  this.thisCell = thisCell;
  this.nextCell = nextCell;
  this.numCompounded = opt_numCompounded;
};


/**
 * Records undo action.
 * Note: action should be recorded *before* it actually happened
 * @param {colab.Undo.OpType} type
 * @param {Object} cell
 * @param {number=} opt_position
 */
colab.Undo.prototype.record = function(type, cell, opt_position) {
  if (type == colab.Undo.OpType.INSERT) {
    var position = opt_position || 0;
    this.cells.insert(position, cell);
  }
  var nextCell = this.findNextCell(cell);
  if (nextCell === undefined) {
    console.error('Can\'t record undo operation when cell is not present',
        cell);
  }
  this.stack.push(new colab.Undo.Operation(type,
      cell, nextCell || null));
  this.redoStack = [];
  if (type == colab.Undo.OpType.DELETE) {
    this.cells.removeValue(cell);
  }
};


/**
 * Records cell move operation
 * as compounded delete and insert.
 * @param {number} insertAfterRemovePosition
 * @param {Object} cell
 */
colab.Undo.prototype.recordMove = function(insertAfterRemovePosition, cell) {
  this.record(colab.Undo.OpType.DELETE, cell);
  this.record(colab.Undo.OpType.INSERT, cell, insertAfterRemovePosition);
  this.compound(2);
};


/**
 * Records cell split, where cell in position, is replaced
 * by 2 cells, splitCell1 and splitCell2.
 * User is responsible for populating splitCell1 and splitCell2
 * @param {number} position
 * @param {Object} splitCell1
 * @param {Object} splitCell2
 */
colab.Undo.prototype.recordSplit = function(position, splitCell1, splitCell2) {
  this.record(colab.Undo.OpType.DELETE,
      /** @type {Object} */ (this.cells.get(position)));
  this.record(colab.Undo.OpType.INSERT, splitCell2, position);
  this.record(colab.Undo.OpType.INSERT, splitCell1, position);
  this.compound(3);
};


/**
 * Records cell split, where cell in position, is replaced
 * by 2 cells, splitCell1 and splitCell2.
 * User is responsible for populating splitCell1 and splitCell2
 * @param {number} position
 * @param {Object} newCell
 */
colab.Undo.prototype.recordReplacement = function(position, newCell) {
  this.record(colab.Undo.OpType.DELETE,
      /** @type {Object} */ (this.cells.get(position)));
  this.record(colab.Undo.OpType.INSERT, newCell, position);
  this.compound(2);
};


/**
 * Records cell merge, where cell's at position/position+1
 * are merged into mergeCell
 * @param {number} position
 * @param {Object} mergeCell
 */
colab.Undo.prototype.recordMerge = function(position, mergeCell) {
  this.record(colab.Undo.OpType.DELETE,
      /** @type {Object} */ (this.cells.get(position)));
  this.record(colab.Undo.OpType.DELETE,
      /** @type {Object} */ (this.cells.get(position)));
  this.record(colab.Undo.OpType.INSERT, mergeCell, position);
  this.compound(3);
};


/**
 * Records clear all operation
 */
colab.Undo.prototype.recordClearAll = function() {
  var numDeletions = this.cells.length;
  for (var i = this.cells.length - 1; i >= 0; i--) {
    this.record(colab.Undo.OpType.DELETE,
        /** @type {?} */ (this.cells.get(i)));
  }
  this.compound(numDeletions);
};


/**
 * Records  insertion operation
 * @param {number} insertPosition
 * @param {Object} cell
 */
colab.Undo.prototype.recordInsert = function(insertPosition, cell) {
  this.record(colab.Undo.OpType.INSERT, cell, insertPosition);
};


/**
 * Records deletion
 * @param {Object} cell
 */
colab.Undo.prototype.recordDelete = function(cell) {
  this.record(colab.Undo.OpType.DELETE, cell);
};


/**
 * Glues together last num operations to become monolothic.
 * @param {number} num of elements to glue.
 */
colab.Undo.prototype.compound = function(num) {
  var stack = this.stack;
  if (num > stack.length) num = stack.length;
  var t = stack.length - 1;
  for (var i = 0; i < num; i++) {
    stack[t - i].numCompounded = num;
  }
};


/**
 * Undos last action
 *
 * stack and redoStack should either be both provided or both absent.
 *
 * @param {Array.<colab.Undo.Operation>=} opt_stack -- undo stack
 * @param {Array.<colab.Undo.Operation>=} opt_redoStack  -- redo stack which
 *   will be updated with the last undo operation.
 * @param {boolean=} opt_ignoreExtras -- if provided will treat compound
 * undo as individual.
 */
colab.Undo.prototype.undo = function(opt_stack, opt_redoStack,
    opt_ignoreExtras) {
  var stack = opt_stack || this.stack;
  var redo = opt_redoStack || this.redoStack;
  var action = stack.pop();
  if (!action) { return; }
  var extras = opt_ignoreExtras ? 0 : action.numCompounded;
  if (extras) {
    console.log('compounding ', extras, ' undos ');
    stack.push(action);
    for (var i = 0; i < extras; i++) {
      this.undo(opt_stack, opt_redoStack, true /* ignore compound */);
    }
    return;
  }

  var redoAction = colab.Undo.OpType.INSERT;

  if (action.type == colab.Undo.OpType.INSERT) {
    redoAction = colab.Undo.OpType.DELETE;
    // Undoing insert
    this.cells.removeValue(action.thisCell);
  } else { // Undoing DELETE
    if (action.nextCell == null) {
      this.cells.push(/** @type {Object} */ (action.thisCell));
    } else {
      var idx = this.cells.indexOf(action.nextCell);
      this.cells.insert(idx, /** @type {Object} */ (action.thisCell));
    }
  }
  redo.push(new colab.Undo.Operation(redoAction,
      action.thisCell, action.nextCell, action.numCompounded));
};


/**
 * Redos the last undone action
 */
colab.Undo.prototype.redo = function() {
  this.undo(this.redoStack, this.stack);
};

