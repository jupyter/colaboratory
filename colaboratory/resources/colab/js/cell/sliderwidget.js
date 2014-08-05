goog.provide('colab.cell.SliderFormWidget');
goog.provide('colab.cell.SliderParams');

goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.string');
goog.require('goog.ui.Component');
goog.require('goog.ui.Slider');


/** @typedef  {!{min: (string|undefined),
 *               max: (string|undefined),
 *               step: (string|undefined)}} */
colab.cell.SliderParams;



/**
 * Class for creating a slider elmenet in the form view. The min, max, and
 * step values of slider are specified in the json params object.
 *
 * @param {string} name Parameter name
 * @param {string} value Current value of the slider
 * @param {colab.cell.SliderParams} params Slider parameters
 * @final @constructor @extends {goog.ui.Component}
 */
colab.cell.SliderFormWidget = function(name, value, params) {
  goog.base(this);

  /** @const {string} */
  this.name = name;

  /** @type {string} */
  this.value = value;

  /** @private {!goog.ui.Slider} */
  this.slider_ = new goog.ui.Slider();
  this.slider_.setMaximum(goog.isNumber(params['max']) ? params['max'] : 100);
  this.slider_.setMinimum(goog.isNumber(params['min']) ? params['min'] : 10);
  this.slider_.setStep(goog.isNumber(params['step']) ? params['step'] : 1);
};
goog.inherits(colab.cell.SliderFormWidget, goog.ui.Component);


/** @inheritDoc */
colab.cell.SliderFormWidget.prototype.createDom = function() {
  // TODO(colab-team): Replace with soy templates.
  var element = goog.dom.createDom(goog.dom.TagName.DIV, 'formview-slider',
      goog.dom.createDom(goog.dom.TagName.DIV, 'formview-namelabel',
          this.name.concat(': ')),
      goog.dom.createDom(goog.dom.TagName.DIV, 'formview-content'),
      goog.dom.createDom(goog.dom.TagName.DIV, 'formview-valuelabel'));

  this.setElementInternal(element);

  // TODO(kayur): slider position doesn't update to the value when rendered.
  // This is an open bug: https://github.com/google/closure-library/issues/264
  this.addChild(this.slider_, true);
  this.slider_.setValue(goog.string.parseInt(this.value));
};


/**
 * Sets the value label.
 * @param {string} value Variable value.
 * @private
 */
colab.cell.SliderFormWidget.prototype.setValueLabel_ = function(value) {
  goog.dom.setTextContent(goog.dom.getElementByClass('formview-valuelabel'),
      ' [' + value + ']');
};


/** @override */
colab.cell.SliderFormWidget.prototype.getContentElement = function() {
  return goog.dom.getElementByClass('formview-content', this.getElement());
};


/** @override */
colab.cell.SliderFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  this.setValueLabel_(this.value);
  this.getHandler().listenWithScope(this.slider_,
      goog.ui.Component.EventType.CHANGE,
      function(e) {
        this.value = e.target.getValue();
        this.setValueLabel_(this.value);
        e.stopPropagation();
        this.dispatchEvent(goog.ui.Component.EventType.CHANGE);
      }, false, this);
};



