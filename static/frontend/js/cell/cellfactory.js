goog.provide('colab.cell');
goog.provide('colab.cell.CellType');

goog.require('colab.cell.Cell');
goog.require('colab.cell.CodeCell');
goog.require('colab.cell.TextCell');

/**
 * Type of widgets that can be parsed and turned into a FormView.
 * @enum {string}
 */
colab.cell.CellType = {
  CODE: 'code',
  TEXT: 'text'
};

/**
 * Factory method for creating cells from a Realtime object.
 *
 * @param {gapi.drive.realtime.CollaborativeMap} realtimeCell The realtime
 *     cell object.
 * @param {colab.drive.Permissions} permissions Edit permissions
 * @return {colab.cell.Cell} A cell object.
 */
colab.cell.cellFromRealtime = function(realtimeCell, permissions) {
  if (realtimeCell.get('type') == colab.cell.CellType.CODE) {
    var cell = new colab.cell.CodeCell(realtimeCell, permissions);
  } else {
    cell = new colab.cell.TextCell(realtimeCell, permissions);
  }
  return cell;
};

/**
 * Creates a new blank cell.
 *
 * @param {gapi.drive.realtime.Model} model Realtime model.
 * @param {string} type Type of the cell.
 * @param {string=} opt_text initial value of the cell.
 * @return {gapi.drive.realtime.CollaborativeMap} A realtime cell
 */
colab.cell.newRealtimeCell = function(model, type, opt_text) {
  var realtimeCell = model.createMap();
  realtimeCell.set('text', model.createString(opt_text));
  realtimeCell.set('type', type);
  realtimeCell.set('collaborators', model.createList());

  // for future comments
  realtimeCell.set('commentsSentinel', model.createString());

  if (type == colab.cell.CellType.CODE) {
    realtimeCell.set('outputs', model.createList());
  }
  return realtimeCell;
};
