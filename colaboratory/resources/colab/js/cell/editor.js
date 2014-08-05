goog.provide('colab.cell.Editor');

goog.require('colab.Global');
goog.require('colab.notification');
goog.require('colab.sharing');
goog.require('colab.tooltip.Tooltip');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events.BrowserEvent');
goog.require('goog.events.EventType');
goog.require('goog.style');
goog.require('goog.ui.Component');



/**
 * Wrapper for the code mirror editor. Backed by a collaborative string.
 *
 * @constructor
 * @param {gapi.drive.realtime.CollaborativeString} text Content of the editor
 * @param {boolean=} opt_codeCompletion True if codeCompletion is enabled.
 * @extends {goog.ui.Component}
 */
colab.cell.Editor = function(text, opt_codeCompletion) {
  goog.base(this);

  /** @private {colab.tooltip.Tooltip} */
  this.tooltip_ = colab.cell.Editor.tooltip;

  /** @private {gapi.drive.realtime.CollaborativeString} */
  this.text_ = text;

  // Note currently this enables both code completion and tooltip
  /** @private {boolean} True if we are enabling code completion. */
  this.codeCompletion_ = !!opt_codeCompletion;
};
goog.inherits(colab.cell.Editor, goog.ui.Component);


/**
 * Get text. Return the value from the editor, rather than the collaborative
 * string. This is important for security as our model is truly based on local
 * content.
 * @return {string} Text form the colaborative string.
 */
colab.cell.Editor.prototype.getText = function() {
  return this.editor_.getValue();
};


/**
 * blurs the editor
 */
colab.cell.Editor.prototype.blur = function() {
  this.editor_.getInputField().blur();
};


/**
 * @return {boolean} True is content in the content is local.
 */
colab.cell.Editor.prototype.isTrustedContent = function() {
  return this.isLocalContent_ ||
      !colab.Global.getInstance().notebookModel.isShared() ||
      (colab.Global.getInstance().notebook &&
      !colab.Global.getInstance().sharingState.hasOtherWriters);
};


/**
 * @param {boolean} value local status of editor
 */
colab.cell.Editor.prototype.setLocalContent = function(value) {
  this.isLocalContent_ = value;
  this.refreshTrustedContent_();
};


/**
 * Refresh editor coloring based on trusted content
 * @private
 */
colab.cell.Editor.prototype.refreshTrustedContent_ = function() {
  goog.dom.classlist.enable(this.getElement(), 'non-trusted',
      !this.isTrustedContent());

  var elem = goog.dom.getElementByClass('CodeMirror-gutter',
      this.getElement());

  // this is a text cell, which doesn't use gutters
  if (!elem) {
    return;
  }

  if (!this.isTrustedContent()) {
    elem.title = 'This code has been modifed outside of ' +
        'this session. Automatic running disabled.';
  } else {
    elem.title = '';
  }
};


/**
 * Set text.
 * @param {string} text Text to set for the colaborative string.
 */
colab.cell.Editor.prototype.setText = function(text) {
  this.text_.setText(text);
};


/**
 * Finds a function that user is currently trying to call. Returns nothing
 * if filterRe is not matched.
 *
 * @param {string} preCursor string - everything up to the current position
 * @param {RegExp} filterRe - regexp to be used to do initial filtering.
 * @return {?string} null if nothing is found.
 */
colab.cell.Editor.prototype.findFunction = function(preCursor, filterRe) {
  var atSpace = preCursor.substr(-1) == ' ';
  preCursor = preCursor.trim();
  if (atSpace) {
    // Allow docstrings for magics:
    var p = preCursor.search(/%%?[_a-zA-Z0-9.]*$/);
    if (p < 0) return null;
    return preCursor.substr(p);
  }
  if (preCursor.search(filterRe) == -1) {
    return null;
  }
  var pos = preCursor.length - 1;
  // Search until we find the first unclosed ')'
  // Note: this might not work in case of quotes and/or comments
  // however good enough for 99.99% use cases.
  var count = 1;
  while (pos >= 0) {
    if (preCursor.charAt(pos) == ')') count++;
    if (preCursor.charAt(pos) == '(') count--;
    if (count == 0) {
      break;
    }
    pos--;
  }
  var suffix = preCursor.substr(0, pos).trim();
  // Now we try to extract function name, right preceding the unclosed (
  var p = suffix.search(/[_a-zA-Z0-9.]+$/);
  if (p < 0) return null;
  return suffix.substr(p);
};


/**
 * Decide what to do with tooltip in the current context.
 *
 * @param {boolean=} opt_keepOnInsideFunction if true, will keep the tooltip
 *   visible for as long as the cursor is inside function.
 *   If false, the tooltip will disappear unless, the cursor is
 *   is right after "," or "(".
 *
 * @return {boolean} true if tooltip action occurred.
 */
colab.cell.Editor.prototype.handleTooltip = function(opt_keepOnInsideFunction) {
  var cur = this.editor_.getCursor();
  // Need full cell, since the function name might be on different line.
  // if KeepOn, we will find a function for as long we are inside an open
  // parenthesis.
  var preCursor = this.editor_.getRange({line: 0, ch: 0}, cur);

  // Used to filter whether we should display if we are inside function.
  // If strict mode, only allow  docstrings, when user starts typing new
  // parameter (after comma), or starts a function call after '('.
  var allowedReg = opt_keepOnInsideFunction ? /.$/ : /[,(]$/;
  var functionToHelpWith = this.findFunction(preCursor, allowedReg);
  if (!functionToHelpWith) {
    if (this.tooltip_.visible()) {
      this.tooltip_.hide();
      return true;
    }
    return false;
  }

  var tooltip = this.tooltip_;
  var editor = this.editor_;
  var that = this;
  // Show tooltip
  if (tooltip.visible() && this.tooltipFunc == functionToHelpWith) {
    // Don't bother getting help repeatedly. Return
    // true however, since we handled it.
    return true;
  }

  if (!colab.Global.getInstance().kernel ||
      !colab.Global.getInstance().kernel.running) {
    colab.notification.showPrimary('Context help requires ' +
        'a live connection to python');
    return false;
  }

  /** @param {{content: IPython.ObjectInfoReply }} message */
  var callback = function(message) {
    var r = message.content;
    var doc = 'Unrecognized request';
    if (r) {
      doc = '';
      if (r.definition) {
        doc += r.definition + '\n';
      }
      if (r.docstring) {
        doc += r.docstring;
      }
      if (!doc) {
        doc = 'No DocString available';
      }

      if (r.init_definition || r.init_docstring) {
        doc += '\n\n__init__:\n';
      }

      if (r.init_definition) {
        doc += r.init_definition + '\n';
      }

      if (r.init_docstring) {
        doc += r.init_docstring;
      }
    }
    tooltip.showAtCursor(editor, doc);
    tooltip.startFollowingCursor(editor);
    that.tooltipFunc = functionToHelpWith;
  };

  colab.Global.getInstance().kernel.object_info(functionToHelpWith, callback);
  return true;
};


/**
 * Selects appropriate highlight mode
 */
colab.cell.Editor.prototype.selectHighlightMode = function() {
  // Don't modify highlight mode if code completion is disabled

  if (!this.codeCompletion_) { return; }
  var firstline = this.editor_.getLine(0).split(/ +/, 1);
  var magic = firstline[0];
  var highlighting = {
    '%%javascript': 'javascript',
    '%%html': 'htmlmixed',
    // TODO(sandler): google specific below. Factor out/generalize
    '%%dremel_define_macro': 'text/x-dremel',
    '%dremel_define_macro': 'text/x-dremel',
    '%%dremel_query': 'text/x-dremel',
    '%%dremel_inline_table': 'text/x-dremel',
    '%dremel_query': 'text/x-dremel'
    // END google specific
  };
  var highlightMode = highlighting[magic] || 'text/x-python';
  this.editor_.setOption('mode', highlightMode);
};


/**
 * Callback for CodeMirror key events for code completion.
 *
 * @param {CodeMirror} editor CodeMirror editor
 * @param {Object} event CodeMirror Event
 * @return {boolean} true if event should be ingored
 * @private
 */
colab.cell.Editor.prototype.updateCodeOverlays_ = function(editor, event) {
  if (this.tooltip_.visible()) {
    // update tooltip if needed.
    this.handleTooltip(true /* keep visible if possible */);
    // continue regular handling.
  }
  return false;
};


/**
 * @param {CodeMirror} editor CodeMirror editor
 * @return {boolean} true if event should be ingored
 */
colab.cell.Editor.prototype.handleTabForCodeHelp = function(editor) {
  if (editor.somethingSelected()) {
    return false;
  }

  // Tab completion.
  var cur = editor.getCursor();

  var preCursor = editor.getRange(/** @type {!CodeMirror.CursorPosition} */
      ({line: cur.line, ch: 0}), cur);
  /* Handle tooltip even if preCursor is empty, since, if there is
     a function to help with, we might not have naything typed
     yet (on this line). Don't bother with indentation. Re-vist if needed */
  if (this.tooltip_.visible()) {
    this.tooltip_.hide();
    return true;
  }
  if (this.handleTooltip()) {
    return true;
  }
  if (preCursor.trim() == '') {
    // Don't autocomplete if the part of the line before the cursor
    // is empty.  In this case, let CodeMirror handle indentation.
    return false;
  }
  this.tooltip_.hide();
  this.handleCodeCompletion();
  return true;
};


/**
 * Code completion
 */
colab.cell.Editor.prototype.handleCodeCompletion = function() {
  var cm = this.editor_;
  // TODO(sandler): lb[Maybe we should check if kernel is busy here.
  /**
   * @param {CodeMirror} cm
   * @param {function(CodeMirror.Hints) | CodeMirror.HintsConfig} callback
   */
  var hintFunc = function(cm, callback) {
    if (!colab.Global.getInstance().kernel ||
    !colab.Global.getInstance().kernel.running) {
      colab.notification.showPrimary(
          'Autocomplete requires live connection to Python!');
      return;
    }

    /** @param {{content: IPython.CompleterReply}} message */
    var finishResponse = function(message) {
      var result = message.content;
      if (cursorPos != cm.getCursor().ch) {
        console.log('Ignoring stale response');
        return;
      }
      var hint = /** @type {CodeMirror.Hints} */ ({});
      hint.list = [];
      var MAX_AC_LENGTH = 32;
      if (result.matches) {
        // Find beginning of the last token
        var pi = result.matched_text.lastIndexOf('.') + 1 /* skip period */;
        result.matched_text = result.matched_text.slice(pi);
        for (var i = 0; i < result.matches.length; i++) {
          var completion = result.matches[i].slice(pi);
          var displayText = completion;
          if (displayText.length > MAX_AC_LENGTH) {
            // TODO(sandler): the alignment of the hint window if this is
            // the case is not perfect, since it aligns with the beginning
            // of the name, rather than the cursor, but there doesn't seem to be
            // an event that fires everytime hint window repositions to fix
            // that.
            displayText = '...' + displayText.slice(displayText.length -
                MAX_AC_LENGTH + 3);
          }
          var oneHint = {
            'text': completion,
            'displayText': displayText
          };
          hint.list.push(oneHint);
        }
      }
      hint.from = /** @type {!CodeMirror.CursorPosition} */ (
          { line: cm.getCursor().line,
            ch: cm.getCursor().ch - result.matched_text.length });
      hint.to = cm.getCursor();
      // Ugly hack to work around CodeMirror bug, where we would put
      // autocomplete somewhere on top of the editor.
      CodeMirror.on(/** @type {?}  */(hint), 'shown', function() {
        var hintEl = jQuery('.CodeMirror-hints');
        var top = parseInt(hintEl.css('top'), 10);
        var height = parseInt(hintEl.css('height'), 10);
        var pos = cm.cursorCoords(hint.from);
        // We are way above of where we supposed to be.
        // Fix position and go home.
        if (top + height < pos.top) {
          hintEl.css('top', (pos.top - height - 7) + 'px');
        }
      });
      /** @type {function(CodeMirror.Hints)} */(callback)(hint);
    };
    var cursorPos = cm.getCursor().ch;

    colab.Global.getInstance().kernel.complete(
        cm.getLine(cm.getCursor().line) || '',
        cm.getCursor().ch || 0,
        finishResponse);
  };
  CodeMirror.showHint(cm, hintFunc,
      /** @type {CodeMirror.HintsConfig} */ ({ async: true }));
};


/**
 * Update the Collaborative string based on changes to the editor.
 * @private
 */
colab.cell.Editor.prototype.updateCollaborativeText_ = function() {
  this.updating_ = true;
  this.setText(this.editor_.getValue());
  this.updating_ = false;
};


/**
 * Update editor with the value in the realtime function. Used by the listener
 * in the Google Realtime API.
 *
 * @param {Object} e Realtime Event
 * @private
 */
colab.cell.Editor.prototype.updateEditor_ = function(e) {
  // change the local status based on change
  this.setLocalContent(e.isLocal);

  if (!this.updating_) {
    // TODO(kayur): support incremental updates of content rather than
    // overwriting.
    this.editor_.setValue(this.text_.getText());
  }
};


/**
 * Add handler for changes to editor.
 * @param {Function} f Callback function
 */
colab.cell.Editor.prototype.addOnChangeHandler = function(f) {
  this.editor_.on(goog.events.EventType.CHANGE, f);
};


/**
 * Add handler for focus on editor.
 * @param {Function} f Callback function
 */
colab.cell.Editor.prototype.addOnFocusHandler = function(f) {
  this.editor_.on(goog.events.EventType.FOCUS, f);
};


/**
 * Set focus to editor.
 */
colab.cell.Editor.prototype.focus = function() {
  this.editor_.focus();
};


/**
 * If either not provided, assume begin or end respectively
 * @param {CodeMirror.CursorPosition=} opt_begin
 * @param {CodeMirror.CursorPosition=} opt_end
 * @return {string}
 */
colab.cell.Editor.prototype.getRange = function(opt_begin, opt_end) {
  var begin = opt_begin || {'line': 0, 'ch': 0};
  // 1 past the last line, so ch=0;
  var end = opt_end || {'line': this.editor_.lineCount(), 'ch': 0};
  return this.editor_.getRange(begin, end);
};


/**
 * Returns cursor position
 * @return {CodeMirror.CursorPosition}
 */
colab.cell.Editor.prototype.getCursor = function() {
  return this.editor_.getCursor();
};


/**
 * Refresh editor dom. Needed because CodeMirror doesn't know how
 * to size itself unless it's in the document. We can potentially
 * Render a CodeMirror object without it being in the document.
 */
colab.cell.Editor.prototype.refresh = function() {
  jQuery(this.getElement()).css('fontSize',
      colab.Global.getInstance().preferences.editorFontSize);
  // Hack to workaround bug in code mirror where we wouldn't size
  // editor properly on initial focus.
  this.editor_.setSize('100%');
  this.editor_.refresh();
};


/**
 * Set parameters of the CodeMirror editor.
 * @param {string} name Parameter name
 * @param {string|Object|number|boolean} value Parameter value
 */
colab.cell.Editor.prototype.setOption = function(name, value) {
  this.editor_.setOption(name, value);
};


/**
 * Show/Hide editor.
 * @param {boolean} value If true show else hide
 */
colab.cell.Editor.prototype.setVisible = function(value) {
  goog.style.setElementShown(this.getElement(), value);
};


/** @override */
colab.cell.Editor.prototype.createDom = function() {
  var element = goog.dom.createDom('div', 'editor');
  this.setElementInternal(element);
};


/**
 * Global tooltip for editor to avoid multiple tooltips showing up
 * anywhere
 * @type {colab.tooltip.Tooltip}
 */
colab.cell.Editor.tooltip = new colab.tooltip.Tooltip();


/**
 * @param {CodeMirror} cm
 * @return {?}
 */
colab.cell.Editor.prototype.tabHandler = function(cm) {
  if (cm.doc.somethingSelected()) {
    return CodeMirror.Pass;
  }
  if (this.codeCompletion_ && this.handleTabForCodeHelp(cm)) {
    return false;
  }
  var spacesPerTab = this.indentSize;
  var spacesToInsert = spacesPerTab - (
      cm.doc.getCursor(this.indentSize).ch % spacesPerTab);
  var spaces = Array(spacesToInsert + 1).join(' ');
  cm.replaceSelection(spaces, 'end', '+input');
};


/**
 * Handles up and down
 * @param {number} direction
 * @param {CodeMirror} cm
 * @return {?}
 */
colab.cell.Editor.prototype.handleUpDown = function(direction, cm) {
  var cur = this.editor_.getCursor();
  if ((cur.line == 0 && direction == -1) ||
      (cur.line == this.editor_.lastLine() && direction == 1)) {
    // Timeout is necessarily here, since
    // the main keyboard handler in notebook.js is called immediately
    // after this one, and selecting a text cell,
    // deselects the editor and that triggers 'up/down' handler in the
    // notebook, resulting in 2 cell jump.
    // TODO(sandler): For some reason, codemirror doesn't pass actual
    // events to this handler, if it is, maybe we could use stopPropagation
    // instead.
    setTimeout(goog.bind(
        colab.Global.getInstance().notebook.changeSelectedCell,
        colab.Global.getInstance().notebook,
        direction), 1);
    return false;
  }
  return CodeMirror.Pass;
};


/** @override */
colab.cell.Editor.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');
  this.tooltip_.initialize();
  this.indentSize = 2;
  // set up editor parameters
  var editorParams =  /** @type {!CodeMirror.EditorConfig}*/ ({
    lineNumbers: colab.Global.getInstance().preferences.showLineNumbers,
    mode: 'text/x-python',
    matchBrackets: true,
    viewportMargin: 10,
    tabSize: this.indentSize,
    extraKeys: {
      // Do our own tab handling. Use for code completion and replace
      // tabs with spaces.
      Tab: goog.bind(this.tabHandler, this),
      'Ctrl-/': 'toggleComment',
      'Up': goog.bind(this.handleUpDown, this, -1),
      'Down': goog.bind(this.handleUpDown, this, 1)
    }
  });

  var editorElement = /** @type {!Element} */(this.getElement());
  //initialize editor
  this.editor_ = new CodeMirror(editorElement,
      /** @type {CodeMirror.EditorConfig}*/ (editorParams));

  // Selects proper highlighting
  this.editor_.on(goog.events.EventType.CHANGE,
      goog.bind(this.selectHighlightMode, this));

  // Update tooltip
  this.editor_.on(goog.events.EventType.CHANGE,
      goog.bind(this.updateCodeOverlays_, this));
  this.editor_.on('cursorActivity',
      goog.bind(this.updateCodeOverlays_, this));

  this.editor_.setValue(this.text_.getText());
  this.selectHighlightMode();
  // set event for changes to editor
  this.editor_.on(goog.events.EventType.CHANGE,
      goog.bind(this.updateCollaborativeText_, this));

  // set local content to false if there is already content in the editor
  this.setLocalContent(this.editor_.getValue() === '');

  // update on changes to the sharing state
  this.getHandler().listenWithScope(colab.Global.getInstance().sharingState,
      colab.sharing.STATE_UPDATED, this.refreshTrustedContent_, false, this);

  // add event listeners for realtime string change
  this.text_.addEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED,
      goog.bind(this.updateEditor_, this));
  this.text_.addEventListener(gapi.drive.realtime.EventType.TEXT_DELETED,
      goog.bind(this.updateEditor_, this));

  this.editor_.on(goog.events.EventType.BLUR,
      goog.bind(this.tooltip_.hide, this.tooltip_));

  // prevents right click from scrolling the notebook unexpectedly
  this.editor_.on(goog.events.EventType.MOUSEDOWN, function(cm, e) {
    if (e.button == goog.events.BrowserEvent.MouseButton.RIGHT) {
      e.preventDefault();
    }});
};


/** @override */
colab.cell.Editor.prototype.exitDocument = function() {
  goog.base(this, 'exitDocument');

  // add event listeners for realtime string change
  this.text_.removeEventListener(gapi.drive.realtime.EventType.TEXT_INSERTED,
      goog.bind(this.updateEditor_, this));
  this.text_.removeEventListener(gapi.drive.realtime.EventType.TEXT_DELETED,
      goog.bind(this.updateEditor_, this));

  // TODO(kayur): Figure out how to (and if we need to) remove listeners the
  //     CodeMirror editor.
  this.editor_ = null;
};
