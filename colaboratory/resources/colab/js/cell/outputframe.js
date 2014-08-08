/**
 * Logic for the output iframe.
 */

var colab = window.colab || {};


/**
 * Any common code can actually verify we are running in iframe.
 *
 * Note: Not a secure mechanism, so don't rely on it where it affects
 * security.
 */
colab.inOutputFrame = true;

var sendMessageToNotebook = function(data) {
  data.target = 'notebook';
  data.cellId = document.getElementById('output-area')
      .getAttribute('data-cell-id');
  window.parent.postMessage(data, '*');
};


/**
 * Namespace for output related utility functions
 */
colab.output = {};


/**
 * @type {CSSStyleSheet}
 * @private
 */
colab.output.customCss_ = null;


/**
 * @return {CSSStyleSheet}  custom stylesheet for this area
 */
colab.output.customCss = function() {
  if (colab.output.customCss_) return colab.output.customCss_;
  var style = document.createElement('style');
  document.head.appendChild(style);
  colab.output.customCss_ = style.sheet;
  return colab.output.customCss_;
};


/**
 * Evals ephemeral script
 * @param {string} js
 * @param {Element} container
 */
colab.output.evalEphemeral = function(js, container) {
  if (colab.output.allowEphemeralScripts) {
    try {
      eval(js);
    } catch (err) {
      console.error(err);
    }
  }
};


/**
 * Appends javascript.
 * @param {Object} js - code to append
 * @param {Object} md - metadata
 * @param {Object} container to add ourselves to.
 * @expose
 */
colab.output.append_javascript = function(js, md, container) {
  if (!md || !md['ephemeral']) {
    // Add a container element for this javascript element.
    // We just eval the JS code, element appears in the local scope.
    var element = jQuery('<div/>').addClass('output_subarea');
    container.append(element);
    // Div for js shouldn't be drawn, as it will add empty height to the area.
    container.hide();
  }
  colab.output.evalEphemeral(js, container);
};


/**
 * Handle pyerr from the IPython notebook. The traceback from the notebook
 * relies on non-standard markup to annotate the output. We use IPython util
 * functions to convert that markup to html.
 *
 * @param {Object} traceback JSON object that contains traceback for error.
 * @return {Element} The element from the error to append to the dom.
 */
colab.output.handlePyerr = function(traceback) {
  var outputDiv = jQuery('<div>').addClass('output-error');
  var outputPre = jQuery('<pre>').appendTo(outputDiv);

  // process data through ipython
  var data = traceback.join('\n');
  data = IPython.utils.fixConsole(data);
  data = IPython.utils.fixCarriageReturn(data);
  data = IPython.utils.autoLinkUrls(data);

  // TODO(kayur): ensure this doesn't allow for injection of abitrary HTML.
  outputPre.html(data);
  return outputDiv;
};


/**
 * @param {IPython.OutputArea} helper
 * @param {Object} output
 * @return {jQuery}
 */
colab.output.createOutput = function(helper, output) {
  var outputDiv = jQuery('<div>').addClass(output['output_type']);

  // This code converts from short mimetypes to real mime types may change
  // in IPython 3.0.
  output = helper.rename_keys(output, IPython.OutputArea.mime_map_r);
  output.metadata = helper.rename_keys(output.metadata,
      IPython.OutputArea.mime_map_r);


  // display outputs
  switch (output['output_type']) {
    case 'stream':
    case 'display_data':
    case 'pyout':
      // Note, this is different from the Gooogle version as
      // IPython 2.0 and 2.1 use different signatures for
      // the append_mime_type function.
      helper.append_mime_type(output, outputDiv);
      break;
    case 'pyerr':
      outputDiv.append(colab.output.handlePyerr(output['traceback']));
      break;
    default:
      outputDiv.text(goog.json.serialize(output));
      break;
  }
  return outputDiv;
};


/** @type {boolean} if true, output will be auto resized on dom changes
 */
colab.output.autoResize = true;

var resizeOutput = function() {
  if (!(colab.output.autoResize)) return;
  var now = new Date();
  clearTimeout(colab.output.timer);
  // Don't update more than twice per second.
  if (colab.output.lastResized > now.getTime() - 500) {
    colab.output.timer = setTimeout(resizeOutput, 500);
    return;
  }
  colab.output.lastResized = now.getTime();
  var outputAreaElement = jQuery('#output-area');
  var height = outputAreaElement[0].scrollHeight;
  var width = outputAreaElement[0].scrollWidth;
  if (width > window.innerWidth) {
    height += 20;
  }
  // Don't jitter. If our side reduced by less than 20
  // pixels, don't bother resizing.
  if (height > colab.output.height - 20 &&
      height <= colab.output.height) { return; }
  colab.output.setOutputHeight(height, true /* keep resizing */);
};


/**
 * @param {number} height
 * @param {boolean} optAutoResize if true, the height might update automatically
 * in the future, based on dom resizes.
 */
colab.output.setOutputHeight = function(height, optAutoResize) {
  /** @type {number} Contains the saved height of colab output */
  colab.output.height = height;
  /** @type {boolean} */
  colab.output.autoResize = !!optAutoResize;
  sendMessageToNotebook({
    action: 'resize_cell_output',
    desiredHeight: height
  });
};


/**
 * @param {string} rule of the form cssselector {key: value; ...}
 */
colab.output.addCustomCssRule = function(rule) {
  // we might consider cleaning up the list, but it doesn't seem to be
  // too important, since outputarea is overwritten regularly,
  // and new rules will supercede the old, so gains are not
  // clear.
  css = colab.output.customCss();
  var ruleList = css.cssRules;
  css.insertRule(rule, ruleList.length);
  setTimeout(resizeOutput, 1);
};


/**
 * @param {boolean} wordWrap If true, stream/pyout will be wrapped.
 */
colab.output.setWordWrap = function(wordWrap) {
  var s = wordWrap ?
      'pre { white-space : pre-wrap;  word-break: break-all; }' :
      'pre { white-space: pre; word-break: initial;} ';
  colab.output.addCustomCssRule(s);
};


/**
 * @param {string} type one of ipython output types
 *     (display_data, pyout, pyerr, stream)
 * @param {boolean} visible
 */
colab.output.setOutputVisibility = function(type, visible) {
  var display = visible ? 'initial' : 'none';
  var rule = 'div.' + type + ' { display: ' + display + '; }';
  colab.output.addCustomCssRule(rule);
};


window.addEventListener('load', function() {
  var domObserver = new MutationObserver(function(event, obs) {
    resizeOutput();
  });
  // We actually don't want any of ipython structures.
  colab.output.helper = new IPython.OutputArea('');

  // Fix append_javascript
  colab.output.helper.append_javascript = colab.output.append_javascript;
  // Remove dblclick handler, it uses 'resize'
  colab.output.helper._dblclick_to_reset_size = function() {};

  domObserver.observe(jQuery('#output-area')[0],
                      {childList: true, subtree: true });
});

window.addEventListener('message', function(message) {
  // TODO(sandler): check the origin
  var data = message.data;
  var outputArea = jQuery('#output-body');
  var outputIndex = data.index;

  if (data.action == 'remove') {
    for (var i = 0; i < data.num; i++) {
      // Since the children will shift upwards, we just always
      // pick up e.index one to delete an element
      var toRemove = outputArea.children()[outputIndex];
      if (toRemove) {
        toRemove.remove();
      }
    }
  } else if (data.action == 'update') {
    var outputDiv = colab.output.createOutput(
        colab.output.helper,
        data.value);
    if (outputArea.children()[outputIndex]) {
      jQuery(outputArea.children()[outputIndex]).replaceWith(outputDiv);
    } else {
      jQuery(outputArea).append(outputDiv);
    }
  } else if (data.action == 'execute') {

  } else if (data.action == 'config') {
    var config = data.value;
    // Note we can't use data() field of jquery here
    // since it is frame-local and we need all friendly
    // frames to access it.
    if (config.cellId !== undefined) {
      outputArea.attr('data-cell-id', config.cellId);
      jQuery('#output-area').attr('data-cell-id', config.cellId);
    }
    if (config.allowEphemeralScripts !== undefined) {
      colab.output.allowEphemeralScripts = config.allowEphemeralScripts;
    }
  }
});

window.addEventListener('click', function(e) {
  sendMessageToNotebook({
    action: 'select_cell'
  });
});
