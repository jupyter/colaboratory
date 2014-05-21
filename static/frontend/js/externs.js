/**
 * @fileoverview various externs
 */

/**
 * IPython Notebook related externs
 */
var IPython = {};


/**
 * Notebook events..
 */
IPython.events = {};

/**
 * @param {Object} params (expects 'editor' and 'kernel')
 * @constructor
 */
IPython.Completer = function(params) {};

/***/
IPython.Completer.prototype.startCompletion = function() {};

/**
 * @type {IPython.Cell}
 */
IPython.Completer.prototype.cell = null;

/**
 * @constructor
 */
IPython.Cell = function() {};

/**
 * @type {IPython.Kernel}
 */
IPython.Cell.prototype.kernel = null;

/**
 * @param {string} url
 * @param {KernelOptions|undefined} opt_options
 * @constructor
 */

/**
 * @type {string}
 */
IPython.Kernel.prototype.base_url = '';

/***/
IPython.Kernel.prototype.interrupt = function() {};

/**
 * @type {WebSocket}
 */
IPython.Kernel.prototype.shell_channel = null;

/**
 * @param {string} url
 * @param {?IPython.KernelCreationOptions=} opt_options
 * @constructor
 */
IPython.Kernel = function(url, opt_options) {};

/***/
IPython.Kernel.prototype.kill = function() {};

/***/
IPython.Kernel.prototype.stop_channels = function() {};

/***/
IPython.Kernel.prototype.restart = function() {};

/** @type {boolean} */
IPython.Kernel.prototype.running = false;

/**
 * @param {string} id
 */
IPython.Kernel.prototype.start = function(id) {};

/**
 * @param {string} code
 * @param {IPython.KernelCallbacks=} callbacks
 * @param {IPython.KernelOptions=} options
 */
IPython.Kernel.prototype.execute = function(code, callbacks, options) {};

/**
 * @param {string} code
 * @param {IPython.KernelCallbacks=} callbacks
 */
IPython.Kernel.prototype.object_info_request = function(code, callbacks) {};

/**
 * @param {JsonObject|string} reply
 */
IPython.Kernel.prototype.send_input_reply = function(reply) {};


/**
 * @param {string} code
 * @param {number} position
 * @param {IPython.KernelCallbacks=} callbacks
 */
IPython.Kernel.prototype.complete = function(code, position, callbacks) {};


/**
 * @constructor
 */
IPython.KernelCallbacks = function() {};


/**
 * @type {function(string)}
 */
IPython.KernelCallbacks.prototype.execute_reply = function(content) {};


/**
 * @type {function(IPython.CompleterReply=)}
 */
IPython.KernelCallbacks.prototype.complete_reply = function(content) {};

/**
 * @type {function(string, Object)}
 */
IPython.KernelCallbacks.prototype.output = function(s, o) {};

/**
 * @type {function()}
 */
IPython.KernelCallbacks.prototype.clear_output = function() {};

/**
 * @type {function(string)} s
 */
IPython.KernelCallbacks.prototype.set_next_input = function(s) {};

/**
 * @type {function(IPython.ObjectInfoReply=)} s
 */
IPython.KernelCallbacks.prototype.object_info_reply = function(s) {};


/**
 * @constructor
 */
IPython.ObjectInfoReply = function() {};

/**
 * @type {string}
 */
IPython.ObjectInfoReply.prototype.docstring = '';

/**
 * @type {string}
 */
IPython.ObjectInfoReply.prototype.init_docstring = '';


/** @type {string}  */
IPython.ObjectInfoReply.prototype.init_definition = '';

/** @type {string}  */
IPython.ObjectInfoReply.prototype.definition = '';

// Many more are avaiable in ObjectInfoReply see kernel.js

/**
 * @struct
 * @constructor
 */
IPython.CompleterReply = function() {
  /** @type {Array.<string>} */
  this.matches = null;

  /** @type {string}  */
  this.matched_text = '';
};

/**
 * @constructor
 * @struct
 */
IPython.KernelOptions = function() {
  /** @type {?boolean}; */
  this.silent = false;

  /** @type {Object|undefined}; */
  this.user_expressions;

  /** @type {?Array.<?>} */
  this.user_variables = null;

  /** @type {?boolean} */
  this.allow_stdin = false;

  /** @type {?boolean} */
  this.store_history = false;
};

/**
 * @constructor
 */
IPython.OutputArea = function() {};

/**
 * @param {Object} a
 * @param {Object} b
 */
IPython.OutputArea.prototype.convert_mime_types = function(a, b) {};

/**
 * @param {string} a
 * @param {Object} b
 * @param {boolean} c
 */
IPython.OutputArea.prototype.append_mime_type = function(a, b, c) {};

/**
 * @param {Object} js - code to append
 * @param {Object} md - metadata
 * @param {Object} container to add ourselves to.
 */
IPython.OutputArea.prototype.append_javascript = function(js, md, container) {};


/**
 * @param {string} data
 * @return {string}
 */
IPython.utils.fixConsole = function(data) { return ''; };

/**
 * @param {string} data
 * @return {string}
 */
IPython.utils.fixCarriageReturn = function(data) { return ''; };

/**
 * @param {string} data
 * @return {string}
 */
IPython.utils.autoLinkUrls = function(data) { return ''; };


/***/
IPython.mathjaxutils = {};

/***/
IPython.mathjaxutils.init = function() {};

/**
 * @param {string} html
 * @param {string} math
 * @return {Object}
 */
IPython.mathjaxutils.replace_math = function(html, math) { return null; };

/**
 * @param {string} inp
 * @return {Array.<string>}
 */
IPython.mathjaxutils.remove_math = function(inp) { return null; };

/***/
var MathJax = {};

/***/
MathJax.Hub = {};

/**
 * @param {Array.<?>} e
 * @return {?function(?)}
 */
MathJax.Hub.Queue = function(e) { return null; };

// TODO(sandler): maybe this should be compiled in.
var colabtools = {};



// TODO(sandler): move this to codemirro3/externs.js?

/**
 * @param {string} content
 */
CodeMirror.prototype.setValue = function(content) {};

/**
 * @type {CodeMirror.Doc}
 */
CodeMirror.prototype.doc = null;

/**
 * @param {string} sel
 * @param {string} cur
 * @param {string} opt
 */
CodeMirror.prototype.replaceSelection = function(sel, cur, opt) {};

/**
 * @param {string} tag to pass along to the kernel
 * @param {JsonObject}  payload to pass to the kernel
 * @param {?function(string)} opt_executor function that executes code
 * on kernel
 */
colabtools.sendMessageToKernel = function(tag, payload, opt_executor) {};


// The types below should not be used except for type annotations.
// (they won't be available at run time)
//
// Use this to indicate that this is an external type and shouldn't be renamed
/**
 * @constructor
 */
var JsonObject = function() {};

/**
 * Searialization json types for notebook. They never actually
 * materialize, but JsCompiler users them to enforce type checks.
 */
var NotebookFormat = {};

/**
 * @constructor
 */
NotebookFormat.Cell = function() {};


/**
 * @constructor
 * @extends JsonObject
 */
NotebookFormat.Notebook = function() {};

/**
 * @constructor
 */
NotebookFormat.Metadata = function() {};

/**
 * @type {NotebookFormat.Metadata}
 */
NotebookFormat.Notebook.prototype.metadata = null;

/**
 * @type {Array.<NotebookFormat.Worksheet>}
 */
NotebookFormat.Notebook.prototype.worksheets = null;

/**
 * @constructor
 */
NotebookFormat.Worksheet = function() {};

/**
 * @type {Array.<NotebookFormat.Cell>}
 */
NotebookFormat.Worksheet.prototype.cells = null;

/**
 * @type {string}
 */
NotebookFormat.Cell.prototype.cell_type = '';

/**
 * @type {Array.<?>}
 */
NotebookFormat.Cell.prototype.outputs = null;

/**
 * Describe hash parameters
 * @struct
 * @constructor
 */
var HashParams = function() {

  /** @type {string} */
  this.fileId = '';

  /** @type {string}  */
   this.folderId = '';

  /**
   * Legacy
   *  @type {string}  */
  this.fileIds = '';

  /**
   * Drive param
   * @type {string}
   */
  this.state = '';

  /** @type {boolean} */
  this.legacyClient = false;

  /** @type {boolean} */
  this.create = false;

  /**  @type {string} */
  this.mode = '';

  /** @type {string} */
  this.extensionOrigin = '';

  /** @type {string} */
  this.nodisplayOutput = '';
};

/**
 * Message received from Cell by the frontend
 * @constructor
 */
var CellMessage = function() {};

/**
 * @type {string}
 */
CellMessage.prototype.listenerId = '';


/**
 * @type {string}
 */
CellMessage.prototype.action = '';


/**
 * @type {string}
 */
CellMessage.prototype.target = '';


/**
 * @type {string}
 */
CellMessage.prototype.tag = '';

/**
 * @type {string}
 */
CellMessage.prototype.cellId = '';

/**
 * @type {JsonObject}
 */
CellMessage.prototype.payload = null;

/**
 * @type {number}
 */
CellMessage.prototype.desiredHeight = 0;

/**
 *
 * @constructor
 */
IPython.KernelCreationOptions = function() {};

/**
 * @type {boolean}
 */
IPython.KernelCreationOptions .prototype.in_browser_kernel = true;

/**
 * @type {string}
 */
IPython.KernelCreationOptions .prototype.kernel_origin = '';

/**
 * @type {string}
 */
IPython.KernelCreationOptions .prototype.kernel_window = '';
