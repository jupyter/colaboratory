goog.provide('colab.cell.TextCell');

goog.require('colab.cell.Cell');
goog.require('colab.cell.Editor');
goog.require('goog.dom');
goog.require('goog.dom.classlist');
goog.require('goog.events.EventType');



/**
 * Constructor for code cell.
 *
 * @constructor
 * @param {gapi.drive.realtime.CollaborativeMap} realtimeCell The realtime cell
 * @param {!colab.drive.Permissions} permissions Drive permissions
 * @extends {colab.cell.Cell}
 */
colab.cell.TextCell = function(realtimeCell, permissions) {
  goog.base(this, realtimeCell, permissions);

  /** @private {!Element} */
  this.topDiv_ = goog.dom.createDom('div', 'text-top-div');

  /** @private {!Element} */
  this.markdownDiv_ = goog.dom.createDom('div', 'markdown');
};
goog.inherits(colab.cell.TextCell, colab.cell.Cell);


/** @private {string} css for edit */
colab.cell.TextCell.EDIT_CSS_NAME_ = 'edit';


/**
 * Update the markdown based on changes to the text.
 * @private
 */
colab.cell.TextCell.prototype.updateMarkdown_ = function() {
  if (this.markdownDiv_ != null) {
    var markdownConverter = Markdown.getSanitizingConverter();
    var text = this.editor_.getText();

    if (text == '') {
      text = 'Double-click (or enter) to edit';
    }
    var text_and_math = IPython.mathjaxutils.remove_math(text);
    text = text_and_math[0];
    var math = text_and_math[1];
    var html = markdownConverter.makeHtml(text);
    if (math.length > 0) {
      html = jQuery(IPython.mathjaxutils.replace_math(html, math));
    }
    jQuery(this.markdownDiv_).html(html);
    if (math.length > 0) {
      MathJax.Hub.Queue(['Typeset', MathJax.Hub, this.markdownDiv_]);
    }
  } else {
    console.error('Markdown Element not initialized. Cannot update Markdown.');
  }
};


/**
 * Refresh the cell dom.
 */
colab.cell.TextCell.prototype.refresh = function() {
  goog.base(this, 'refresh');
  this.editor_.refresh();
};


/**
 * Toggles cell selection.
 * @param {boolean} value True if selected
 */
colab.cell.TextCell.prototype.setSelected = function(value) {
  goog.base(this, 'setSelected', value);

  // this undoes edit mode if we unselect the cell. Otherwise it might
  // undo edit mode
  if (!value) {
    this.setEditing(false);
  }
};


/** @override */
colab.cell.TextCell.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  goog.dom.appendChild(this.mainContentDiv, this.topDiv_);
  goog.dom.appendChild(this.topDiv_, this.markdownDiv_);
  goog.dom.appendChild(this.topDiv_, this.toolbarDiv);

  // add editor
  this.editor_ = new colab.cell.Editor(this.realtimeCell.get('text'));
  this.addChild(this.editor_);
  this.editor_.render(this.mainContentDiv);
  this.editor_.setOption('lineNumbers', false);
  this.editor_.setOption('lineWrapping', true);
  this.editor_.setOption('mode', 'text/x-markdown');

  // update markdown
  this.updateMarkdown_();
  // set event for changes
  this.editor_.addOnChangeHandler(goog.bind(this.updateMarkdown_, this));

  if (!this.permissions.isEditable()) {
    this.editor_.setOption('readOnly', 'nocursor');
  }
  var textCell = this;
  this.getHandler().listen(this.markdownDiv_, goog.events.EventType.DBLCLICK,
      function(e) {
        if (!textCell.permissions.isEditable()) {
          return;
        }

        var editStatus = goog.dom.classlist.contains(textCell.getElement(),
            colab.cell.TextCell.EDIT_CSS_NAME_);
        textCell.setEditing(!editStatus);
      }, false);
  this.refresh();
};


/**
 * Sets the edit mode.
 * @param {boolean} value True if editing
 */
colab.cell.TextCell.prototype.setEditing = function(value) {
  var classAdded = goog.dom.classlist.enable(this.getElement(),
      colab.cell.TextCell.EDIT_CSS_NAME_, value);

  this.refresh();
  if (value) {
    this.editor_.focus();
  }
};


/** @override */
colab.cell.TextCell.prototype.exitDocument = function() {
  goog.base(this, 'exitDocument');

  this.editor_.dispose();
};
