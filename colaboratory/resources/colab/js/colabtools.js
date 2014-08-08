/**
 *
 * @fileoverview Various user visible utilities.
 *
 */


/**
 * Create appropriate namespace
 */
var colab = colab || {};
/**
 * utility functions. TODO(sandler): Move to colabtools and somewhere
 * where it can be compiled
 */
colab.util = colab.util || {};

/**
 * Loads js files in files, then executes closure.
 * If selector is provided, displays loading message in the given selector.
 *
 *
 *
 * @param {list} files - list of javascript files
 * @param {String} selector jquery selector to put loading message in
 * @param {Function} closure
 */

colab.util.sequentiallyLoadJavascript = function(files, selector, closure) {
  if (!('loaded_js_files_CL58545484' in window)) {
    window['loaded_js_files_CL58545484'] = {};
  }
  if ('define' in window && window['define']) {
    // This is a hack around requirejs, that breaks jQuery.getScript
    // functionality so we disable it altogether. Only needed for
    // ipython-notebook. Noop for colab.
    window.saveDefineFromRequireJs = window.define;
    window.define = null;
  }

  function load_files() {
    if (files.length > 0) {
      var file = files.pop();
      if (file in loaded_js_files_CL58545484) {
        load_files();
      } else {
        var el = document.createElement('script');
        el.src = file;
        el.onload = load_files;
        document.body.appendChild(el);
      }
    } else {
      if (selector) {
        $(selector).html('');
      }
      closure();
      if (window.saveDefineFromRequireJs) {
        window.define = window.saveDefineFromRequireJs;
      }
    }
  }

  if (selector) {
    $(selector).html('<b>Trying to load supporting javascript....  </b> ' +
        ' If this message does not disappear, try to ' +
        '<a href=http://login.corp.google.com?authLevel=2000000' +
        ' target=_blank>login</a> and then rerun this cell');
  }
  files.reverse();
  load_files();
};

/**
 * Create new namespace if it is not there yet
 */
colabtools = window.colabtools || {};

/**
 * Sends message to the kernel works both in v1 and v2.
 * In v2, if called from output frame, it forwards this to frontend
 * If  called from frontend (when proxying the message) actually executes
 * code.
 *
 * This complication is caused by the fact that we want existing code to
 * work in both ipython notebook and colab
 *
 * @param {string} tag
 * @param {Object} payload
 * @param {Function} opt_ExecutionFunction function that takes String as
 *    input
 */
colabtools.sendMessageToKernel = function(tag, payload, opt_ExecutionFunction) {
  if (colab && colab.inOutputFrame) {
    sendMessageToNotebook({target: 'notebook', action: 'send_message',
                           tag: tag, payload: payload});
    return;
  }
  payload = JSON.stringify(payload);
  if (typeof tag != 'string') {
    console.log(tag, ' is not a string');
    return;
  }
  // This is safe against XSS, since tag is string
  // and payload is stringified json, which can't contain
  // """
  code = ('from colabtools import message as __msg239;' +
          '__msg239.Post(' + JSON.stringify(tag) + ',' +
                        '""" ' + payload + ' """' +
                      ',origin_info={});');
  if (opt_ExecutionFunction) {
    opt_ExecutionFunction(code);
  } else {
    IPython.notebook.kernel.execute(code);
  }
};