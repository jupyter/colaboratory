/**
 *
 * @fileoverview Output area for a code cell. In charge of displaying and
 *     and managing code output.
 *
 */

goog.provide('colab.cell.OutputArea');

goog.require('colab.Global');
goog.require('colab.params');
goog.require('goog.date.DateTime');
goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.string');
goog.require('goog.style');
goog.require('goog.ui.Zippy');
goog.require('goog.ui.Component');



/**
 * Constructor for output area
 *
 * @constructor
 * @param {gapi.drive.realtime.CollaborativeList} outputs The realtime
 *     list of outputs.
 * @param {String=} opt_cellId a session-unique cell identifier.
 * @extends {goog.ui.Component}
 */
colab.cell.OutputArea = function(outputs, opt_cellId) {
  goog.base(this);

  /** @private {gapi.drive.realtime.CollaborativeList} */
  this.outputs_ = outputs;

  // This is currently set to true whenever the cell is executed
  // for the first time. We don't want ephemeral scripts to be executed
  // on loadTime. This is more of a compatibility feature with ipython-notebook
  // rather than security. Scripts still can be executed, if they
  // are created as part of HTML elements for instance.
  /**@type {boolean} */
  this.executeEphemeralScripts = false;

  // output iframe
  this.iframeLoaded = false;
  this.cellId = opt_cellId;

  // localContent_ is true when the following hold:
  // (1) The current iframe does not contain any content that wasn't locally
  //     generated.
  // (2) The value of this.ouputs_ does not contain any content that wasn't
  //     locally generated.
  // The initial value is true when the initial set of outputs is empty.
  // The value is set to true whenever the outputs are cleared *and* a new
  // iframe is simulataneously created and this.outputIframe is set to that
  // iframe.  It is set to false whenever a non-local output is added to
  // this.outputs_.
  /** @private {boolean} */
  this.localContent_ = outputs.length == 0;

  /** @private @type {Element} */
  this.outputPane_ = null;

  /** @private @type {Element} */
  this.infoImg_ = null;

  /** @private @type {number|undefined} */
  this.lastExecTime_ = undefined;

  /** @private @type {string} */
  this.lastExecUser_ = 'Unknown';
};
goog.inherits(colab.cell.OutputArea, goog.ui.Component);


/** @param {Object} executionInfo New Header Info */
colab.cell.OutputArea.prototype.setHeaderContent = function(executionInfo) {
  if (executionInfo) {

    // No longer compatible with execution time stored as .date, .time
    this.lastExecTime_ = executionInfo['timestamp'];

    // backwards compatibility with .user == "First Last" instead of me object
    var user = executionInfo['user'];
    if (typeof(user) == 'string') {
      this.lastExecUser_ = user;
      var imgSrc = '/colab/img/anon.jpeg';
      goog.dom.classes.enable(this.infoImg_, 'collaborator-img-me', false);
    } else {
      this.lastExecUser_ = user.displayName;
      if (user.userId === colab.Global.getInstance().me.userId) {
        this.lastExecUser_ += ' (Me)';
        var imgSrc = '/colab/img/output-icon.svg';
        goog.dom.classes.enable(this.infoImg_, 'collaborator-img-me', true);
      } else {
        var imgSrc = colab.drive.urlWithHttpsProtocol(user.photoUrl);
        goog.dom.classes.enable(this.infoImg_, 'collaborator-img-me', false);
      }
    }
    goog.dom.setProperties(this.infoImg_, {
        'src': imgSrc
    });
    this.updateImageTitle();
  }
};


/**
 * Update the relative time since last execution on output info image.
 */
colab.cell.OutputArea.prototype.updateImageTitle = function() {
  var userString = this.lastExecUser_ || 'Unknown';
  var timeString = this.lastExecTime_ ?
      goog.date.relative.getDateString(
          goog.date.DateTime.fromTimestamp(this.lastExecTime_)) :
      'Unknown Time';
  goog.dom.setProperties(this.infoImg_, {
      'title': 'executed by ' + userString + '\n' + timeString,
      'alt': userString
  });
};


/** @inheritDoc */
colab.cell.OutputArea.prototype.createDom = function() {
  var element = goog.dom.createDom('div', 'output');

  // create header
  var header = goog.dom.createDom('div', 'output-header');
  goog.dom.appendChild(element, header);

  // create content div
  this.outputPane_ = goog.dom.createDom('div', 'output-content');
  goog.dom.appendChild(element, this.outputPane_);

  var info = goog.dom.createDom('div', 'output-info');
  goog.dom.appendChild(this.outputPane_, info);
  this.infoImg_ = goog.dom.createDom('img', {
      'class': 'collaborator collaborator-img',
      'src': '/colab/img/anon.jpeg'
    });
  this.updateImageTitle();
  goog.dom.appendChild(info, this.infoImg_);

  var container = goog.dom.createDom('div', 'output-iframe-container');
  goog.dom.appendChild(this.outputPane_, container);

  this.setElementInternal(element);
};


/** @inheritDoc */
colab.cell.OutputArea.prototype.getContentElement = function() {
  return goog.dom.getElementByClass('output-iframe-container',
      this.getElement());
};

/**
 * Check whether this has any outputs in its internal realtime list.
 * @return {boolean}
 */
colab.cell.OutputArea.prototype.hasOutput = function() {
  return (this.outputs_.length != 0);
};


/**
 * Toggles output
 */
colab.cell.OutputArea.prototype.toggle = function() {
  this.setVisible(!this.isOutputVisible());
};


/** @inheritDoc */
colab.cell.OutputArea.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // TODO(jasnyder): use custom animation instead of zippy to reveal from top
  // as in quantum paper spec and to get rid of lingering border
  var header = goog.dom.getElementByClass('output-header', this.getElement());
  this.zippy_ = new goog.ui.Zippy(header, this.outputPane_);

  // create output
  this.realtimeUpdateHandler = goog.bind(this.outputsChanged_, this);
  this.realtimeOutputsRemovedHandler = goog.bind(this.outputsRemoved_, this);
  this.createOutput();

  // NOTE: these are not currently removed at any point.
  this.outputs_.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED,
      this.realtimeUpdateHandler);
  this.outputs_.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED,
      this.realtimeOutputsRemovedHandler);
  this.outputs_.addEventListener(gapi.drive.realtime.EventType.VALUES_SET,
      this.realtimeUpdateHandler);

  this.getHandler().listenWithScope(this.infoImg_,
      goog.events.EventType.MOUSEOVER, this.updateImageTitle, false, this);

  this.setVisible(true /* only if output */);
};


/**
 * Set output area visible if both given value and output exists.
 * @param {boolean} value True if visible
 */
colab.cell.OutputArea.prototype.setVisible = function(value) {
  this.zippy_.setExpanded(value && this.hasOutput());
};


/** @return {boolean} */
colab.cell.OutputArea.prototype.isOutputVisible = function() {
  return this.zippy_.isExpanded();
};


/**
 * Clear the output area.
 */
colab.cell.OutputArea.prototype.clearOutput = function() {
  this.outputs_.clear();
};


/**
 * NOTE: this should be in sync with outputarea.html, which is a backup.
 *
 * @type {string}
 */
colab.cell.OutputArea.html = '<head>' +
    '<link rel="stylesheet" href="/colab/css/ansi.css"/>' +
    '<link rel="stylesheet" href="/colab/css/main.css"/>' +
    '<script>' +
    '   IPython  = {};' +
    '   IPython.namespace = function() {};' +
    '   IPython.keyboard_manager = {};' +
    '   IPython.keyboard_manager.register_events = function(x) {};' +
    '</script>' +
    '<script src="/ipython/components/jquery/jquery.min.js"></script>' +
    '<script src="/colab/js/cell/outputframe.js"></script>' +
    '<script src="/ipython/base/js/utils.js"></script>' +
    '<script src="/colab/js/colabtools.js"></script>' +
    '<script src="/colab/js/interactive_widgets.js"></script>' +
    '<script src="/ipython/notebook/js/outputarea.js"></script>' +
    '<script>' +
    '    if (!window[\'colab\']) {' +
    '        window.parent.postMessage({target:\'notebook\',' +
    '                                   action:\'load_failed\'}, \'*\');' +
    '    }' +
    '</script>' +
    '</head>' +

    '<body style="background: white;">' +
    '<div id="output-area">' +
    '  <span id="output-header"> </span>' +
    '  <div id="output-body"> </div>' +
    '  <span id="output-footer"> </span>' +
    '</div>' +
    '</body>';


/**
 * Creates iframe output.
 * Can be called after removeOutput() was called
 */
colab.cell.OutputArea.prototype.createOutput = function() {
  if (colab.params.getHashParams().nodisplayOutput) { return; }
  if (this.outputIframe) {
    this.outputIframe.remove();
  }
  console.log('Creating output');
  this.outputIframe = goog.dom.createDom('iframe', {
    // Backup for browsers that don't support srcdoc.
    // TODO(sandler): IE < 9 and Safari < 12, don't
    // support sandbox at all, we should be serving this from a
    // different domain, otherwise it is a security hole if browser
    // ignores sandbox attribute.
    //  src: '/ipython/outputframe.html',
    height: '20px',
    srcdoc: colab.cell.OutputArea.html,
    sandbox: 'allow-forms allow-scripts'
  });
  this.iframeLoaded = false;
  jQuery(this.outputIframe).css('height', 0);
  this.outputHeight = 0;
  var cell = this;
  goog.dom.appendChild(this.getContentElement(), this.outputIframe);
  this.height = 0;
  this.outputIframe.onload = function() {
    console.log('Loaded iframe');
    // configure outputIframe

    // Signal that iframe is ready to recieve realtime updates.
    // (safe to set now, since no listeners will fire until we exit this
    // function)
    cell.iframeLoaded = true;

    cell.postUpdate({
      action: 'config',
      value: { 'cellId': cell.cellId,
        'allowEphemeralScripts': cell.allowEphemeralScripts_ }
    });
    // populate outputIframe with initial value of outputs_
    for (var i = 0; i < cell.outputs_.length; i++) {
      cell.updateOutput_(i);
    }
  };

  this.outputIframe.onunload = function() {
    console.log('Frame unloaded');
  };
};


/**
 * Removes iframe output
 */
colab.cell.OutputArea.prototype.removeOutput = function() {
  if (this.outputIframe) {
    this.outputIframe.remove();
  }
  this.outputIframe = null;
};


/**
 * Resizes output, desiredHeight is used as hint
 * but no guarantee is made.
 *
 * @param {number=} desiredHeight - the new desired height.
 */
colab.cell.OutputArea.prototype.resizeOutput = function(desiredHeight) {
  var container = goog.dom.getElementByClass('notebook-container');

  var maxHeight = 2 * goog.style.getSize(container).height / 3;
  desiredHeight = Math.min(desiredHeight, maxHeight);

  if (this.height == desiredHeight) return;
  var heightIncrease = desiredHeight - this.height;
  this.height = desiredHeight;
  var enclosingDivHeight = 'initial';
  if (desiredHeight == 0) {
    enclosingDivHeight = 0;
  }

  // Find scrolling point that we want to keep still, if selected cell is
  // on the screen and visible, use its top, otherwise, use window.topY
  var refScroll = container.scrollTop;

  var scrollCell = colab.Global.getInstance().notebook ?
      colab.Global.getInstance().notebook.getSelectedCell() : null;
  var resizingCurrentCell = false;
  if (scrollCell && scrollCell.isVisible()) {
    // Use selected cell as reference.
    var bounds = goog.style.getBounds(scrollCell.getElement());
    refScroll = bounds.top;
    resizingCurrentCell = scrollCell.realtimeCell.id == this.cellId;
  }

  var this_bounds = goog.style.getBounds(this.getContentElement());
  goog.style.setHeight(this.outputIframe, desiredHeight + 'px');
  goog.style.setHeight(this.getContentElement(), enclosingDivHeight);

  // Change happened above, so we need to scroll to keep the reference
  // point in the right place.
  if (this_bounds.top <= refScroll) {
    jQuery(container).animate(
        {'scrollTop': (container.scrollTop + heightIncrease)}, 100);
  } else if (resizingCurrentCell) {
    // If selected cell is the one being resized, reposition it so that
    // it is fits the screen
    scrollCell.scrollIntoView();
  }
};


/**
 * Posts data message to the content iframe
 * @param {Object} data JSON message to post.
 */
colab.cell.OutputArea.prototype.postUpdate = function(data) {
  if (!this.outputIframe.contentWindow || !this.iframeLoaded) {
    console.error('No output window available');
  }
  this.outputIframe.contentWindow.postMessage(data, '*');
};


/**
 * Allows execution of ephemeral scripts
 */
colab.cell.OutputArea.prototype.allowEphemeralScripts = function() {
  this.allowEphemeralScripts_ = true;
};


/**
 * Clear output area.
 */
colab.cell.OutputArea.prototype.clear = function() {
  this.outputs_.clear();
};


/**
 * Add add output from IPython kernel.
 *
 * @param {string} msgType the type of the message
 * @param {Object} content the content of the message
 */
colab.cell.OutputArea.prototype.handleKernelOutputMessage =
    function(msgType, content) {
  var output = this.convertKernelOutput_(msgType, content);
  var lastOutIdx = this.outputs_.length - 1;
  var lastOutput = this.hasOutput() ?
      this.outputs_.get(lastOutIdx) : null;
  if (this.tryMerge(/** @type {Object} */ (lastOutput), output)) {
    this.outputs_.set(lastOutIdx, output);
  } else {
    this.outputs_.push(output);
  }
};


/**
 * Tries to merge old output with the new one
 * Merge is only possible if msgType is the same and the name
 * of the content is the same.
 * @param {Object} prevOut - elements that could be pushed into outputs_
 * @param {Object} nextOut - new element that might be merged with prev.
 * @return {boolean} true on success
 */
colab.cell.OutputArea.prototype.tryMerge = function(prevOut, nextOut) {
  if (!prevOut) return false;
  if (prevOut['output_type'] != 'stream' ||
      nextOut['output_type'] != 'stream') {
    return false;
  }
  if (prevOut['stream'] != nextOut['stream']) {
    return false;
  }
  nextOut.text = prevOut.text + nextOut.text;
  return true;
};


/**
 * Handle removal of realtime outputs.
 *
 * @param {gapi.drive.realtime.ValuesRemovedEvent} e Realtime Event
 * @private
 */
colab.cell.OutputArea.prototype.outputsRemoved_ = function(e) {
  this.setVisible(true /* only if output */);

  if (!this.hasOutput()) {
    this.createOutput();
    this.localContent_ = true;
    this.dispatchEvent(goog.ui.Component.EventType.CHANGE);
  } else {
    // If this event comes from another client, then mark the content of
    // this output area as not all local.
    this.localContent_ = this.localContent_ && e.isLocal;
    if (this.iframeLoaded) {
      this.postUpdate({action: 'remove', index: e.index,
        num: e.values.length });
    }
  }
};


/**
 * Handle changes to the realtime outputs object.
 *
 * @param {gapi.drive.realtime.BaseModelEvent} e Realtime Event
 * @private
 */
colab.cell.OutputArea.prototype.outputsChanged_ = function(e) {
  this.setVisible(true /* only if output */);
  this.dispatchEvent(goog.ui.Component.EventType.CHANGE);

  // If this event comes from another client, then mark the content of
  // this output area as not all local.
  this.localContent_ = this.localContent_ && e.isLocal;

  if (this.iframeLoaded) {
    var values = 0;
    var index = 0;
    if (e.type == gapi.drive.realtime.EventType.VALUES_ADDED) {
      var event = /** @type {gapi.drive.realtime.ValuesAddedEvent} */ (e);
      values = event.values;
      index = event.index;
    } else if (e.type == gapi.drive.realtime.EventType.VALUES_SET) {
      var event = /** @type {gapi.drive.realtime.ValuesSetEvent} */ (e);
      values = event.newValues;
      index = event.index;
    }
    // This works because we only append values to the outputs_
    // if we also inserted them in the middle we would need to pass in
    // 'insert' vs. 'update' flag here.
    for (var i = 0; i < values.length; i++) {
      this.updateOutput_(index + i);
    }
  }
};


/**
 * Convert kernel output to ipynb output. Modified from function in
 * outputarea.js in Ipython.
 *
 * @param {string} msgType Type of the data
 * @param {Object} content JSON object containing the content of the message
 * @return {Object} json object for data
 * @private
 */
colab.cell.OutputArea.prototype.convertKernelOutput_ =
    function(msgType, content) {
  var json = /** @type {JsonObject} */ ({});
  json['output_type'] = msgType;
  if (msgType === 'stream') {
    json['text'] = content['data'];
    json['stream'] = content['name'];
  } else if (msgType === 'display_data') {
    json = content['data'];
    json['output_type'] = msgType;
    json['metadata'] = content['metadata'];
  } else if (msgType === 'pyout') {
    json = content['data'];
    json['prompt_number'] = content['execution_count'];
    json['output_type'] = msgType;
    json['metadata'] = content['metadata'];
  } else if (msgType === 'pyerr') {
    json['ename'] = content['ename'];
    json['evalue'] = content['evalue'];
    json['traceback'] = content['traceback'];
  }

  return json;
};


/**
 * Convert from kernel mime types to internal representation.
 *
 * @param {JsonObject} json Output that needs to be returned
 * @param {Object} data Data from execute call
 * @return {JsonObject} modified json
 * @private
 */
colab.cell.OutputArea.prototype.convertMimeTypes_ =
    function(json, data) {

  // Need each of the these if statements becase we can have multiple MIME
  // types in one display data message.
  // TODO(kayur): Maybe we don't need data === undefined, because it will
  //     default the properties to undefined.
  if (data === undefined) {
    return json;
  }
  if (data['text/plain'] !== undefined) {
    json['text'] = data['text/plain'];
  }
  if (data['text/html'] !== undefined) {
    json['html'] = data['text/html'];
  }
  if (data['image/svg+xml'] !== undefined) {
    json['svg'] = data['image/svg+xml'];
  }
  if (data['image/png'] !== undefined) {
    json['png'] = data['image/png'];
  }
  if (data['image/jpeg'] !== undefined) {
    json['jpeg'] = data['image/jpeg'];
  }
  if (data['text/latex'] !== undefined) {
    json['latex'] = data['text/latex'];
  }
  if (data['application/json'] !== undefined) {
    json['json'] = data['application/json'];
  }
  if (data['application/javascript'] !== undefined) {
    json['javascript'] = data['application/javascript'];
  }

  return json;
};


/**
 * Updates a single element of the output iframe to its current value in
 * this.outputs_.  Calling updateOutput_ with an index larger than the number
 * of outputs currently in the output iframe has the effect of appending to the
 * output iframe's outputs.
 *
 * @param {number} outputIndex - contains the index in outputs_
 *   that would be updated on screen.
 * @private
 */
colab.cell.OutputArea.prototype.updateOutput_ = function(outputIndex) {
  if (!(outputIndex < this.outputs_.length)) {
    console.error('Can\'t update non-existent output ' + outputIndex);
    return;
  }
  var rt_output = this.outputs_.get(outputIndex);
  this.postUpdate({action: 'update', index: outputIndex,
    value: rt_output});
};



/**
 * Whether all content in the iframe was generated locally
 * @return {boolean} True when all content in the iframe was generated lcoally
 */

colab.cell.OutputArea.prototype.isLocalContent = function() {
  return this.localContent_;
};
