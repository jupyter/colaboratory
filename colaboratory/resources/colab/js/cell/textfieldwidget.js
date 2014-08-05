goog.provide('colab.cell.TextFieldFormWidget');

goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.events.EventType');
goog.require('goog.ui.Component');



/**
 * Class for creating a text field in the from view. A text field
 * is the default value for a paramter.
 *
 * @param {string} name Parameter name
 * @param {string} value Value of the Text Field
 * @final @constructor @extends {goog.ui.Component}
 */
colab.cell.TextFieldFormWidget = function(name, value) {
  goog.base(this);

  /** @const {string} Name of the variable */
  this.name = name;

  /** @type {string} */
  this.value = value;
};
goog.inherits(colab.cell.TextFieldFormWidget, goog.ui.Component);


/** @override */
colab.cell.TextFieldFormWidget.prototype.createDom = function() {
  // TODO(kayur): Replace with soy templates.
  var element = goog.dom.createDom(goog.dom.TagName.DIV, 'formview-textfield',
      goog.dom.createDom(goog.dom.TagName.DIV, 'formview-namelabel',
          this.name.concat(': ')),
      goog.dom.createDom(goog.dom.TagName.INPUT, {
        'class': 'formview-input',
        'name': this.name,
        'value': this.value
      }));

  this.setElementInternal(element);
};


/** @override */
colab.cell.TextFieldFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  var text = goog.dom.getElementByClass('formview-input', this.getElement());
  this.getHandler().listenWithScope(text, goog.events.EventType.INPUT,
      function(e) {
        e.stopPropagation();
        this.value = /** @type {string} */ (e.target.value);
        this.dispatchEvent(goog.ui.Component.EventType.CHANGE);
      }, false, this);
};

