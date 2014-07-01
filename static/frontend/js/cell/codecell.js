/**
 *
 * @fileoverview The class for coLaboratory code cells.
 *
 */

goog.provide('colab.cell.CodeCell');

goog.require('colab.cell.Cell');
goog.require('colab.cell.FormView');
goog.require('colab.cell.OutputArea');
goog.require('colab.drive.Permissions');
goog.require('colab.services');
goog.require('goog.date.DateTime');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Prompt');
goog.require('goog.ui.ToolbarSelect');

/**
 * Constructor for code cell.
 *
 * @constructor
 * @param {gapi.drive.realtime.CollaborativeMap} realtimeCell The realtime cell
 * @param {colab.drive.Permissions} permissions Drive permissions
 * @extends {colab.cell.Cell}
 */
colab.cell.CodeCell = function(realtimeCell, permissions) {
  goog.base(this, realtimeCell, permissions);

  /** @private {colab.cell.OutputArea} */
  this.outputArea_ = null;

  /** @private {boolean} Running status of cell */
  this.isRunning_ = false;

  /** @private {colab.cell.FormView} Form View */
  this.formView_ = null;
};
goog.inherits(colab.cell.CodeCell, colab.cell.Cell);

/**
 * View type of the code cell.
 * @enum {string}
 */
colab.cell.CodeCell.ViewType = {
  BOTH: 'both',
  CODE: 'code',
  FORM: 'form'
};

/**
 * Add cell specific methods to toolbar.
 * @protected
 */
colab.cell.CodeCell.prototype.createToolbar = function() {
  goog.base(this, 'createToolbar');

  // create clear button
  var clearButton = new goog.ui.ToolbarButton('Clear');
  goog.events.listen(clearButton,
      goog.ui.Component.EventType.ACTION, function(e) {
        this.clearOutput();
      }, false /* Don't fire on capture */, this);
  this.toolbar.addChildAt(clearButton, 0, true);

  // create edit button to toggle edit state
  /** @private {goog.ui.ToolbarButton} */
  this.runInterruptButton_ = new goog.ui.ToolbarButton('Run');
  goog.events.listen(this.runInterruptButton_,
      goog.ui.Component.EventType.ACTION, function(e) {
        if (this.isRunning_) {
          colab.globalKernel.interrupt();
        } else {
          this.execute(true);
        }
      }, false /* Don't fire on capture */, this);
  this.toolbar.addChildAt(this.runInterruptButton_, 0, true);

  /** @private {goog.ui.ToolbarSelect} add select for toolbar */
  this.formViewSelect_ = new goog.ui.ToolbarSelect('');
  var viewTypes = goog.object.getValues(colab.cell.CodeCell.ViewType);
  goog.array.forEach(viewTypes, function(value) {
    this.addItem(new goog.ui.MenuItem(value));
  }, this.formViewSelect_);

  this.formViewSelect_.setSelectedIndex(0);

  var events = [goog.ui.Component.EventType.SHOW,
      goog.ui.Component.EventType.HIDE, goog.ui.Component.EventType.ACTION];
  goog.events.listen(this.formViewSelect_, events, function(e) {
    switch (e.type) {
      case goog.ui.Component.EventType.SHOW:
        goog.dom.classes.add(this.toolbarDiv, 'cell-toolbar-visible');
        break;
      case goog.ui.Component.EventType.HIDE:
        goog.dom.classes.remove(this.toolbarDiv, 'cell-toolbar-visible');
        break;
      case goog.ui.Component.EventType.ACTION:
        this.setView_(/** @type {colab.cell.CodeCell.ViewType} */
            (this.formViewSelect_.getValue()), true);
        break;
    }
  }, false /* Don't fire on capture */, this);
  this.toolbar.addChildAt(this.formViewSelect_, 0, true);
};

/** @type {colab.cell.CodeCell.ViewType}
    @private
 */
colab.cell.CodeCell.prototype.viewType_ = colab.cell.CodeCell.ViewType.BOTH;

/**
 * Set the view of the cell based combo box selection.
 * @param {colab.cell.CodeCell.ViewType} viewType View we are setting to.
 * @param {boolean} update Update Realtime cell.
 * @private
 */
colab.cell.CodeCell.prototype.setView_ = function(viewType, update) {
  if (viewType != this.viewType_) {
    if (update) {
      this.realtimeCell.set('cellView', viewType);
    }
    var viewTypes = goog.object.getValues(colab.cell.CodeCell.ViewType);
    if (this.formViewSelect_) {
      this.formViewSelect_.setSelectedIndex(viewTypes.indexOf(viewType));
    }
  }

  // set cell viewtype
  this.viewType_ = viewType;

  // only for the scope of this function
  var realViewType = this.formView_.hasChildren() ? this.viewType_ :
      colab.cell.CodeCell.ViewType.CODE;

  // if the form has widgets show menu item in the toolbar.
  if (this.formViewSelect_) {
    goog.style.setElementShown(this.formViewSelect_.getElement(),
      this.formView_.hasChildren());
  }

  switch (realViewType) {
    case colab.cell.CodeCell.ViewType.BOTH:
      this.formView_.show(true);
      this.formView_.setExpanded(false);
      this.editor_.setVisible(true);
      break;
    case colab.cell.CodeCell.ViewType.CODE:
      this.formView_.show(false);
      this.editor_.setVisible(true);
      break;
    case colab.cell.CodeCell.ViewType.FORM:
      this.formView_.show(true);
      this.formView_.setExpanded(true);
      this.editor_.setVisible(false);
      break;
  }
};

/** @inheritDoc */
colab.cell.CodeCell.prototype.createDom = function() {
  goog.base(this, 'createDom');

  /** @private {Element} Div containing the editor and other input widgets */
  this.inputDiv_ = goog.dom.createDom('div', 'inputarea');
  goog.dom.appendChild(this.mainContentDiv, this.inputDiv_);

  // set the status of the running area
  var runningDiv = goog.dom.createDom('div', 'running-status', 'Running');
  goog.dom.appendChild(this.mainContentDiv, runningDiv);
  goog.style.setElementShown(runningDiv, false);

  var executionCountDiv = goog.dom.createDom('div', 'execution-count',
      '');
  goog.dom.appendChild(this.mainContentDiv, executionCountDiv);
  this.setExecutionCount(colab.cell.CodeCell.ExecutionCountStatus.UNKNOWN);
};

/**
 * Execution count status
 * @enum {string}
 */
colab.cell.CodeCell.ExecutionCountStatus = {
  FRESH: 'fresh',
  STALE: 'stale',
  UNKNOWN: 'unknown'
};

/**
 * @param {colab.cell.CodeCell.ExecutionCountStatus} status
 * @param {number=} opt_count ignored for status different from 'FRESH'.
 * if not provided for 'FRESH' status assumes execution is in flight.
 */
colab.cell.CodeCell.prototype.setExecutionCount = function(status,
    opt_count) {
  var el = goog.dom.getElementByClass('execution-count', this.getElement());
  goog.dom.classes.addRemove(el, 'up-to-date', 'out-of-date');
  switch (status) {
  case colab.cell.CodeCell.ExecutionCountStatus.FRESH:
    goog.dom.classes.addRemove(el, 'out-of-date', 'up-to-date');
    el.setAttribute('title', 'This cell is up-to-date');
    jQuery(el).text('Last Run Index: ' + (opt_count || '*'));
    break;
  case colab.cell.CodeCell.ExecutionCountStatus.STALE:
    el.setAttribute('title',
          'This cell might have changed since last execution.');
    // keep the old content in place.
    break;
  case colab.cell.CodeCell.ExecutionCountStatus.UNKNOWN:
    el.setAttribute('title',
       'This cell has not been executed in this session');
    jQuery(el).text('Not yet run');
    break;
  }
};

/**
 * Change the cell if it is being dragged.
 * @param {boolean} value True if cell is being dragged
 */
colab.cell.CodeCell.prototype.setDragging = function(value)  {
  goog.base(this, 'setDragging', value);
  if (value) {
    // The output needs to be deleted, because drag and drop
    // moves the cell in the dom hierarchy and keeps inserting
    // it in all possible spots, and each such insertion
    // causes iframe to reload.
    this.outputArea_.removeOutput();
  } else {
    // Potentially we could avoid creating output, since
    // the cell is re-created by RT update if it actually moved.
    //
    // But in the case it stays in-place, we need to recover the old value.
    // In the  future we might want to check for this condition and only
    // recreate if the cell didn't move.
    this.outputArea_.createOutput();
  }

  // hide the output area while dragging
  this.outputArea_.setVisible(!value);
  this.refresh();
};

/**
 * Clear output.
 */
colab.cell.CodeCell.prototype.clearOutput = function()  {
  // hide the output area while dragging
  this.outputArea_.clearOutput();
  this.refresh();
};


/**
 * Callback for updating the editor from the form.
 * @param {string} name The name of the variable
 * @param {string|Object|number} value The new value.
 * @private
 */
colab.cell.CodeCell.prototype.formCallback_ = function(name, value) {
  var t = this.editor_.getText();
  var re = new RegExp('(' + name + '\\s*=).*(#\\s*@param.*)');

  // TODO(kayur): Somewhat a hack. Maybe there will be other sync
  //    issues with events.
  /** @private {boolean} Mutex for updating the form */
  this.formUpdate_ = true;
  this.editor_.setText(t.replace(re, '$1 ' + value + ' $2'));
  this.formUpdate_ = false;
};

/** @inheritDoc */
colab.cell.CodeCell.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // add editor
  this.editor_ = new colab.cell.Editor(this.realtimeCell.get('text'), true);
  this.addChild(this.editor_);
  this.editor_.render(this.inputDiv_);
  // add form control
  this.formView_ = new colab.cell.FormView(
      goog.bind(this.formCallback_, this),
      goog.bind(function() { this.execute(true); }, this));
  this.addChild(this.formView_);
  this.formView_.render(this.inputDiv_);

  // if the cell view exists
  if (this.realtimeCell.has('cellView')) {
    this.setView_(this.realtimeCell.get('cellView'), false);
  } else {
    this.setView_(colab.cell.CodeCell.ViewType.BOTH,
        /* only update if editable */ this.permissions.isEditable());
  }
  this.updateFormView_();

  // handles the view for the cell to that view
  // add form if this is editable
  if (this.permissions.isEditable()) {
    // add update for forms
    this.editor_.addOnChangeHandler(goog.bind(function() {
      if (!this.formUpdate_) {
        this.updateFormView_();
      }
    }, this));

    // set focus events
    this.editor_.addOnFocusHandler(goog.bind(this.selectCellHandler, this));
  } else {
    this.editor_.setOption('readOnly', 'nocursor');
  }

  // add output area
  this.outputArea_ = new colab.cell.OutputArea(
      this.realtimeCell.get('outputs'),
      this.realtimeCell.id);
  this.addChild(this.outputArea_);
  this.outputArea_.render(this.mainContentDiv);

  // update the output area header if we have metadata
  if (this.realtimeCell.has('executionInfo')) {
    this.outputArea_.setHeaderContent(/** @type {Object} */ (
        this.realtimeCell.get('executionInfo')));
  }

  // listen for changes to the object
  this.realtimeCell.addEventListener(
      gapi.drive.realtime.EventType.VALUE_CHANGED,
      goog.bind(this.realtimeUpdate_, this));

  var editorUpdateCb = goog.bind(
      this.setExecutionCount, this,
      colab.cell.CodeCell.ExecutionCountStatus.STALE);
  this.realtimeCell.get('text').addEventListener(
      gapi.drive.realtime.EventType.TEXT_INSERTED,
      editorUpdateCb);
  this.realtimeCell.get('text').addEventListener(
      gapi.drive.realtime.EventType.TEXT_DELETED,
      editorUpdateCb);
  this.refresh();
};

/**
 * Toggles output visibility
 */
colab.cell.CodeCell.prototype.toggleOutput = function() {
  this.outputArea_.toggle();
};

/**
 * Updates state based on changes to the realtime cell
 * @param {gapi.drive.realtime.ValueChangedEvent} e Change event
 * @private
 */
colab.cell.CodeCell.prototype.realtimeUpdate_ = function(e) {
  if (e.property == 'executionInfo') {
    this.outputArea_.setHeaderContent(/** @type {Object} */ (e.newValue));
  } else if (e.property == 'cellView') {
    this.setView_(/** @type {colab.cell.CodeCell.ViewType} */ (e.newValue),
        false);
  }
};

/**
 * Updates the form view based on text.
 * @private
 */
colab.cell.CodeCell.prototype.updateFormView_ = function() {
  // parse code to generate form
  this.formView_.parseCode(this.editor_.getText());

  this.setView_(this.viewType_, false /* don't update rt */);
};

/** @inheritDoc */
colab.cell.CodeCell.prototype.reset = function() {
  this.setRunning_(false);
};

/**
 * Set running status for cell
 * @param {boolean} value True if cell is running
 * @private
 */
colab.cell.CodeCell.prototype.setRunning_ = function(value) {
  var runningElem = goog.dom.getElementByClass('running-status',
      this.getElement());
  goog.style.setElementShown(runningElem, value);
  this.isRunning_ = value;
  this.runInterruptButton_.setCaption(value ? 'Interrupt' : 'Run');
  this.refresh();
};

/**
 * Indicate if cell content is trusted for automatic execution
 * @return {boolean} True if local content, or the document
 * has no other writers other than the current user.
 */
colab.cell.CodeCell.prototype.isTrustedContent = function() {
  return this.editor_.isTrustedContent();
};

/**
 * TODO(sandler): move this to kernel
 * @return {boolean}
 */
colab.cell.CodeCell.prototype.connectedToKernel = function() {
  return !!(colab.globalKernel && colab.globalKernel.running &&
      !colab.globalKernel.disconnected);
};

/**
 * @param {{content: IPython.ExecuteReply}} message
 */
colab.cell.CodeCell.prototype.handleExecuteReply = function(message) {
  var content = message.content;

  var ts = new goog.date.DateTime();
  this.setRunning_(false);
  this.setExecutionCount(
      colab.cell.CodeCell.ExecutionCountStatus.FRESH,
      content.execution_count);
  this.realtimeCell.set('executionInfo', {
    'content': content,
    'timestamp': ts.getTime(),
    'user_tz': ts.getTimezoneOffset(),
    'user': colab.globalMe.displayName
  });
  if (!content.payload || content.payload.length == 0) {
    return;
  }

  var element = goog.dom.createDom('span');
  for (var i = 0; i < content.payload.length; i++) {
    if (content.payload[i].source != 'page') continue;
    var help = goog.dom.createDom('div', 'code-help');
    var help_text = content.payload[i].text;
    // This will escape all existing html and add formatting.
    help.innerHTML = IPython.utils.fixConsole(help_text);
    goog.dom.appendChild(element, help);
  }
  colab.globalNotebook.setBottomPaneContent(element);
};

/**
 * Execute code.
 * @param {boolean=} opt_isManual Indicates if the cell was executed manually by
 *    the user or automatically by other javascript.
 * @return {boolean}
 */
colab.cell.CodeCell.prototype.execute = function(opt_isManual) {
  if (!this.connectedToKernel()) {
     colab.notification.showPrimary('Not connected to kernel.');
    this.setRunning_(false);
    return false;
  }

  if (this.isRunning_) {
    colab.notification.showPrimary('Already running!');
    return false;
  }

  // if isManual is not defined set it to false, because it is safter.
  // otherwise use the defined value
  var isManual = (opt_isManual === undefined) ? false : opt_isManual;

  // check if the cell has been run by the user or automatically by javascript
  // only execute automatically generated cells if the python is local.
  if (isManual) {
    this.editor_.setLocalContent(true);
  } else if (!this.isTrustedContent()) {
    return false;
  }

  this.setExecutionCount(colab.cell.CodeCell.ExecutionCountStatus.FRESH);
  this.setRunning_(true);

  // clear the contents of the cell
  this.outputArea_.clear();
  this.outputArea_.allowEphemeralScripts();

  // these callbacks handle kernel events
  // TODO(kayur): handle set_next_input, input_request
  var callbacks = /** @type {IPython.KernelCallbacks} */ ({
    'shell' : {
      'reply': goog.bind(this.handleExecuteReply, this),
      'payload': {'set_next_input': goog.bind(function(content) {
        console.log('set_next_input not implemented: ', content);
      }, this)}
    },
    'input' : goog.bind(function(message) {
      var dialog = new goog.ui.Prompt('User Input Requested',
          message['content']['prompt'],
          function(input) {
            colab.globalKernel.send_input_reply(input || '');
          });
      dialog.setDisposeOnHide(true);
      dialog.setVisible(true);
    }, this),
    'iopub' : {
      'clear_output': goog.bind(function() {
        this.outputArea_.clear();
      }, this),
      'output': goog.bind(function(msg) {
        var msgType = msg['msg_type'];
        var content = msg['content'];
        // Handle special requests by the kernel.  These are answered on the
        // stdin channel.
        var metadata = msg['metadata'];
        if (metadata && metadata[colab.services.REQUEST_TYPE_KEY]) {
          colab.services.handleKernelRequest(metadata);
          return;
        }

        // create output object and add it to outputs list
        this.outputArea_.handleKernelOutputMessage(msgType, content);
      }, this)
    }
  });

  try {
    colab.globalKernel.execute(this.editor_.getText(), callbacks,
       /** @type {IPython.KernelOptions} */ ({ silent: false,
                                               store_history: true}));
  } catch (e) {
    this.setRunning_(false);
    console.error('Could not send execute message to Kernel: ', e);
    return false;
  }
  return true;

};

/**
 * Refresh the cell dom
 */
colab.cell.CodeCell.prototype.refresh = function() {
  goog.base(this, 'refresh');
  this.editor_.setOption('lineNumbers',
      colab.preferences.showLineNumbers);
  this.editor_.refresh();
};

/**
 * Sets focus on editor.
 */
colab.cell.CodeCell.prototype.focusOnEditor = function() {
  this.editor_.focus();
};

/**
 * @inheritDoc
 */
colab.cell.CodeCell.prototype.setSelected = function(value) {
  goog.base(this, 'setSelected', value);
  if (!value) {
    this.editor_.blur();
  }
};

/**
 * Returns the output area of the cell
 * @return {colab.cell.OutputArea} The cell's outputarea
 */
colab.cell.CodeCell.prototype.getOutputArea = function() {
  return this.outputArea_;
};
