goog.provide('colab.cell.ComboBoxFormWidget');
goog.provide('colab.cell.ComboBoxParams');

goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.string');
goog.require('goog.ui.ComboBox');
goog.require('goog.ui.Component');
goog.require('goog.ui.MenuItem');


/** @typedef  {!{domain: (!Array.<string>|undefined)}} */
colab.cell.ComboBoxParams;



/**
 * Class for creating a combo box in the form view. The domain of the combo
 * box is specified in the domain variable.
 *
 * @param {string} name Parameter name
 * @param {string} value Current value of the combobox
 * @param {colab.cell.ComboBoxParams} params Supported keys:
 *     domain: !Array.<string> Array of string that are the domain.
 * @final @constructor @extends {goog.ui.Component}
 */
colab.cell.ComboBoxFormWidget = function(name, value, params) {
  goog.base(this);

  /** @const {string} */
  this.name = name;

  /** @type {string} */
  this.value = value;

  /**
   * Domain of the combobox.
   * @const @private {!Array.<string>}
   */
  this.domain_ = params['domain'] || [];

  /** @private {!goog.ui.ComboBox} */
  this.combobox_ = new goog.ui.ComboBox();
};
goog.inherits(colab.cell.ComboBoxFormWidget, goog.ui.Component);


/** @override */
colab.cell.ComboBoxFormWidget.prototype.createDom = function() {
  // TODO(colab-team): Replace with soy templates.
  var element = goog.dom.createDom(goog.dom.TagName.DIV, 'formview-combobox',
      goog.dom.createDom(goog.dom.TagName.DIV, 'formview-namelabel',
          this.name.concat(': ')));

  this.setElementInternal(element);

  this.addChild(this.combobox_, true);
  goog.array.forEach(this.domain_, function(v) {
    this.combobox_.addItem(new goog.ui.MenuItem(v));
  }, this);
  this.combobox_.setValue(goog.string.stripQuotes(this.value, '"`\''));
};


/** @override */
colab.cell.ComboBoxFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  this.getHandler().listenWithScope(this.combobox_,
      goog.ui.Component.EventType.CHANGE,
      function(e) {
        this.value = '"' + e.target.getValue() + '"';
        e.stopPropagation();
        this.dispatchEvent(goog.ui.Component.EventType.CHANGE);
      }, false, this);
};

