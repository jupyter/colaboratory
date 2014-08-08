// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Support functions for interactive widgets.
 * These functios are meant to be user visble.
 *
 * TODO(sandler): Refactor maybe to live in some namespace
 * (colabtools)
 *
 * @author sandler@google.com (Mark Sandler)
 */

/**
 *  This function is meant to be bound to a cell element' select
 *  to replace a feature where we would keep stealing focus whenever user
 *  clicks on the output. For example:
 *     code_cell.select = selectWithoutCodeMirrorFocus
 *  @this {CodeCell} - a codecell that this function would be attached to.
 */
var selectWithoutCodeMirrorFocus = function() {
  IPython.Cell.prototype.select.apply(this);
  this.code_mirror.refresh();
};

/**
 * Loads multiple css files into this document
 * @param {string|array} cssFiles
 */
var loadCss = function(cssFiles) {
  if (typeof(cssFiles) == 'string') {
    loadCss([cssFiles]);
    return;
  }
  for (var i = 0; i < cssFiles.length; i++) {
    $('<link/>', {
      rel: 'stylesheet',
      type: 'text/css',
      href: cssFiles[i]
    }).appendTo('head');
  }
};

var interactive_widgets_enabled = function() {
  // If inOutputFrame is on, we can enable widgets. Notebook will prevent any
  // improper communication. Right now interactive_widgets_allowed is
  // inaccessible since it was set in a different iframe. Maybe we should
  // provide common namespace for javascript to communicate.
  return window.interactive_widgets_allowed ||
      (colab && colab.output && colab.output.allowEphemeralScripts);
};

var listenerMap = {};

/**
 * Register for a given listener_id
 * @param {string} listener_id The id to listen for
 * @param {function} callback The callback function
 */
var registerListener = function(listener_id, callback) {
  if (!listenerMap[listener_id]) {
    listenerMap[listener_id] = [];
    sendMessageToNotebook({action: 'register_listener',
                           listenerId: listener_id});

  }
  if (!(callback in listenerMap)) {
    listenerMap[listener_id].push(callback);
  }
};

window.addEventListener('message', function(message) {
  if (message.origin != 'https://www.colab.corp' &&
      // Dev
      message.origin != 'chrome-extension://dmaaimdkehikanjidckkheggnaecfgbg' &&
      // Webstore
      message.origin != 'chrome-extension://pmafdalehkdohndeifdmmodoepemnndj' &&
      message.origin != 'http://127.0.0.1:8888') {
    console.log('Untrusted domain:', message.origin);
    return;
  }
  var listener_id = message.data['listenerId'];
  var callbacks = listenerMap[listener_id];
  if (!callbacks) { return; }
  for (var i = 0; i < callbacks.length; i++) {
    callbacks[i](listener_id);
  }
});

/**
 * Executes all cells that are listenining
 * to given listener_id
 * @param {string} listener_id
 */
var updateListener = function(listener_id) {
  sendMessageToNotebook({action: 'update_listener', listenerId: listener_id});
};

/**
 * Executes this cell.
 */
var executeCell = function() {
  sendMessageToNotebook({action: 'execute_cell'});
};

/**
 * Saves data for interactive tables
 *
 * @param {string} kernel_tag - the data will be sent to this tag
 * @param {object} table dom element for the table
 * @param {string} listener_id id of the listener to notify on update.
 */
var saveInteractiveTableData = function(kernel_tag, table, listener_id) {
   if (!interactive_widgets_enabled()) return;
   var data = table.$('tr', {'filter': 'applied'});
   var indices = data.map(function(index, x) { return x._DT_RowIndex; });
   var max = 5000;
   colabtools.sendMessageToKernel(kernel_tag, {action: 'clear'});

   // Send data back to ipython in batches of 5k indices at a time.
   // Otherwise notebook silently failes at ~10K indices.
   for (i = 0; i < (indices.size() - 1) / max + 1; i++) {
     var indice_list =
         indices.slice(i * max, (i + 1) * max).toArray();

     colabtools.sendMessageToKernel(kernel_tag, {
       action: 'append', indices: indice_list });
   }
   updateListener(listener_id);
};

/**
 * Updates the value of a selector
 *
 * @param {string} kernel_tag
 * @param {object} selector - jquery like object containing selector element
 * @param {string} listener_id id of the listener to notify.
 */
var saveSelectorData = function(kernel_tag, selector, listener_id) {
  if (!interactive_widgets_enabled()) return;
  var value = selector[0].value;
  colabtools.sendMessageToKernel(kernel_tag, { value: value });
  updateListener(listener_id);
};

if (typeof(loadJqueryColumnFilterPlugin) != 'undefined') {
  console.log('Initializing column filter plugin');
  loadJqueryColumnFilterPlugin();
}


// TODO(sandler): Clean up all the code above and move it in here.

colabtools = colabtools || {};

/**
 * cells namespace, we might change this later to goog.provide
 * but for now this code is never compiled
 */
colabtools.cells = colabtools.cells || {};

/**
 * Takes list of css urls and loads it
 */
colabtools.loadCss = loadCss;

/**
 * Identity helper function used by js.py
 * @param {?} x
 * @return {?}
 */
colabtools.identity = function(x) { return x; };