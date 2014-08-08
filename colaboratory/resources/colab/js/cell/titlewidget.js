goog.provide('colab.cell.TitleFormWidget');
goog.provide('colab.cell.TitleParams');

goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.style');
goog.require('goog.ui.Button');
goog.require('goog.ui.Component');


/** @typedef  {!{run-button: (string|undefined),
 *               font-family: (string|undefined),
 *               font-weight: (string|undefined)
 *             }} */
colab.cell.TitleParams;



/**
 * Class for creating a Title widget. Titles are text with a run button.
 *
 * @param {string} titleText Parameter name
 * @param {Object} params TextBox parameters
 * @final @constructor @extends {goog.ui.Component}
 */
colab.cell.TitleFormWidget = function(titleText, params) {
  goog.base(this);

  /** @private {string} The title text. */
  this.titleText_ = titleText;

  /** @private {Object} Parmeters. */
  this.params_ = params;

  /** @private {goog.ui.Button} */
  this.button_ = this.params_['run-button'] == 'false' ? null :
      new goog.ui.Button('Run');
};
goog.inherits(colab.cell.TitleFormWidget, goog.ui.Component);


/** @override */
colab.cell.TitleFormWidget.prototype.createDom = function() {
  // TODO(kayur): Replace with soy templates.
  var element = goog.dom.createDom(goog.dom.TagName.DIV, 'formview-title');

  var title = goog.dom.createDom(goog.dom.TagName.DIV, 'formview-title-text',
      this.titleText_);

  // Iterate through the parameters and set the title style
  var elementStyles = ['font-size', 'font-weight'];
  goog.array.forEach(elementStyles, function(style) {
    if (this.params_[style]) {
      goog.style.setStyle(title, style, this.params_[style]);
    }
  }, this);
  goog.dom.appendChild(element, title);

  this.setElementInternal(element);

  if (this.button_) {
    this.addChild(this.button_, true);
  }
};


/** @override */
colab.cell.TitleFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  if (this.button_) {
    this.getHandler().listenWithScope(this.button_,
        goog.ui.Component.EventType.ACTION,
        function(e) {
          e.stopPropagation();
          this.dispatchEvent(goog.ui.Component.EventType.ACTION);
        }, false, this);
  }
};
