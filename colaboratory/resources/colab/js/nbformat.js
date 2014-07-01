/**
 *
 * @fileoverview Conversion from file format to realtime format.
 *
 */

goog.provide('colab.nbformat');

goog.require('goog.format.JsonPrettyPrinter');

/** @type {string} The version of the colab realtime data model. */
colab.nbformat.COLAB_VERSION = '0.1';


/** @private {goog.format.JsonPrettyPrinter} */
colab.nbformat.JSON_FORMATTER_ = new goog.format.JsonPrettyPrinter(
    null /* use default to make js compiler happy */);


/**
 * Joins lines that have have been split at \n, into a single string.
 * This function mutates the input argument, and has no return value.
 *
 * Note: This splitting is part of the IPython notebook file format.
 * it is done in order to make changes easier to track by version control
 * software/diff tools.
 *
 * @param {JsonObject} json_nb The json object read from the notebook file.
 *   On return, this is the object representing the notebook file using the
 *   in-memory format.
 * @private
 */
colab.nbformat.unsplitLines_ = function(json_nb) {
  var multiline_outputs = {
    'text': 0,
    'html': 0,
    'svg': 0,
    'latex': 0,
    'javascript': 0,
    'json': 0
  };

  // Implements functionality of IPython.nbformat.v3.rwbase.rejoin_lines
  var nb = /** @type {NotebookFormat.Notebook} */ (json_nb);
  goog.array.forEach(nb.worksheets, function(ws) {
    goog.array.forEach(ws.cells, function(cell) {
      if (cell.cell_type === 'code') {
        if ('input' in cell && Array.isArray(cell.input)) {
          cell.input = cell.input.join('');
        }
        goog.array.forEach(cell.outputs, function(output) {
          for (var key in multiline_outputs) {
            if (key in output && Array.isArray(output[key])) {
              output[key] = output[key].join('');
            }
          }
        });
      } else {
        for (var key in {'source': 0, 'rendered': 0}) {
          if (key in cell && Array.isArray(cell[key])) {
            cell[key] = cell[key].join('');
          }
        }
      }
    });
  });
};


/**
 * Converts IPython JSON to a realtime cell.
 * @param {Object} json JSON object from notebook
 * @param {gapi.drive.realtime.Model} model The Realtime root model object.
 * @return {gapi.drive.realtime.CollaborativeMap}
 * @private
 */
colab.nbformat.cellFromJson_ = function(json, model) {
  var cell = model.createMap();
  if (json['cell_type'] == colab.cell.CellType.CODE) {
    cell.set('type', colab.cell.CellType.CODE);
    cell.set('text', model.createString(json['input']));
    cell.set('outputs', model.createList(json['outputs']));
    // TODO(kayur): read metadata here.
    var metadata = json['metadata'];
    if (metadata) {
      if (metadata['cellView']) {
        cell.set('cellView', metadata['cellView']);
      }
      if (metadata['executionInfo']) {
        cell.set('executionInfo', metadata['executionInfo']);
      }
    }
  } else if (json['cell_type'] == colab.cell.CellType.HEADING) {
    cell.set('type', colab.cell.CellType.TEXT);
    var level = json['level'] || 0;
    var text = '########'.substring(0, level) + json['source'];
    cell.set('text', model.createString(text));
  } else {
    cell.set('type', colab.cell.CellType.TEXT);
    cell.set('text', model.createString(json['source']));
  }
  return cell;
};


/**
 * Takes in notebook file content and saves it in the realtime model.
 *
 * @param {string} fileContents A string containing the notebook file contents.
 * @param {gapi.drive.realtime.Model} model The Realtime root model object.
 */
colab.nbformat.convertJsonNotebookToRealtime = function(fileContents, model) {
  /** @type {NotebookFormat.Notebook} */
  var json = /** @type {NotebookFormat.Notebook} */ (goog.json.parse(
      fileContents));
  var worksheets = json.worksheets;
  var metadata = json.metadata;
  colab.nbformat.unsplitLines_(json);
  // This is initialized from filename.
  // colab.drive.setTitle(metadata['name'], model);

  var cells = model.createList();
  goog.array.forEach(worksheets, function(worksheet) {
    cells.pushAll(goog.array.map(worksheet['cells'],
        function(cell) { return colab.nbformat.cellFromJson_(cell, model); }));
  });

  metadata = model.createMap();
  model.getRoot().set('cells', cells);
  model.getRoot().set('metadata', metadata);
  model.getRoot().set('colabVersion', colab.nbformat.COLAB_VERSION);
};


/**
 * Converts a realtime cell to IPython JSON.
 * @param {gapi.drive.realtime.CollaborativeMap} cell Realtime cell
 * @return {Object} JSON object from notebook
 * @private
 */
colab.nbformat.cellToJson_ = function(cell) {
  var isHeadingCell = function(text) {
    // Note this will convert single line markup cells with '#' into
    // appropriate heading, even if they weren't a heading originally.
    // This is actually a feature, since presentation doesn't change
    // but the structured information can be used to generate slide show
    // out of colab notebook. Also, on notebook side it is more likely to
    // be a user-bug, rather than feature.
    //
    // TODO(sandler): change this behavior if it is  for some reason not
    // desirable.
    if (!text.match(/^#/)) return false;
    text = text.replace(/\W+$/, '');
    if (text.search('\n') >= 0) return false;
    return true;
  };

  var json = {};
  var type = cell.get('type');
  if (type === colab.cell.CellType.CODE) {
    json['cell_type'] = colab.cell.CellType.CODE;
    json['input'] = cell.get('text').getText();
    json['outputs'] = cell.get('outputs').asArray();

    // TODO(colab-team): this is currently hardcoded. If we have different
    //     backends, we will need to add a language type to cells.
    json['language'] = 'python';
    json['metadata'] = {
      'cellView': cell.get('cellView'),
      'executionInfo': cell.get('executionInfo')
    };
  } else {
    var text = cell.get('text').getText();
    if (isHeadingCell(text)) {
      var level = text.match(/^#*/)[0].length;
      json['level'] = level;
      json['cell_type'] = colab.cell.CellType.HEADING;
      json['source'] = cell.get('text').getText().substring(level);
    } else {
      json['cell_type'] = colab.cell.CellType.MARKDOWN;
      json['source'] = text;
    }
  }
  return json;
};

/**
 * Creates an empty IPython Notebook JSON.
 * @param {string} title Notebook title
 * @return {string} Notebook file as string
 */
colab.nbformat.createEmptyJsonNotebook = function(title) {
  var cells = [{
    'cell_type': 'code',
    'input': '',
    'outputs': [],
    'language': 'python'
  }];

  return colab.nbformat.createJsonNotebookFromCells_(title, cells);
};


/**
 * Takes a list of and create an IPython JSON object.
 * @param {string} title Notebook title
 * @param {Array.<Object>} cells Cells as IPython JSON
 * @return {string} Notebook file as string
 * @private
 */
colab.nbformat.createJsonNotebookFromCells_ = function(title, cells) {
  var data = {
    'worksheets': [{'cells' : cells}],
    'metadata': {'name': title, 'colabVersion': colab.nbformat.COLAB_VERSION},
    'nbformat': 3,
    'nbformat_minor': 0
  };

  return colab.nbformat.JSON_FORMATTER_.format(data);
};


/**
 * Takes a realtime model and returns a corresponding notebook file.
 *
 * @param {string} title Title of the notebook
 * @param {gapi.drive.realtime.Model} model Drive Realtme model.
 * @return {string} Notebook file as string
 */
colab.nbformat.convertRealtimeToJsonNotebook = function(title, model) {
  var cells = goog.array.map(
      model.getRoot().get('cells').asArray(),
      colab.nbformat.cellToJson_);

  return colab.nbformat.createJsonNotebookFromCells_(title, cells);
};
