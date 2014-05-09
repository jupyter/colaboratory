/**
 *
 * @fileoverview Description of this file.
 *
 * TODO(kayur): consider adding base Widget class
 */

goog.provide('colab.cell.ComboBoxFormWidget');
goog.provide('colab.cell.FormView');
goog.provide('colab.cell.SliderFormWidget');
goog.provide('colab.cell.TextFieldFormWidget');

goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.ui.ComboBox');
goog.require('goog.ui.Component');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Select');
goog.require('goog.ui.Slider');

/**
 * Class for the form view of the code cell. Creates a form view element
 * and manages it's visiblity.
 *
 * @param {function(string, string)} callback Updates the edtior based on form
 * changes.
 * @extends {goog.ui.Component}
 * @constructor
 */
colab.cell.FormView = function(callback) {
  goog.base(this);

  /** @private {function(string, string)} Updates the edtior based on form
   *  changes. */
  this.callback_ = callback;
};
goog.inherits(colab.cell.FormView, goog.ui.Component);

/** @inheritDoc */
colab.cell.FormView.prototype.createDom = function() {
  this.setElementInternal(goog.dom.createDom('div', 'formview'));
};

/**
 * Sets toggles class that sets expaned mode. Exapnded means the form should
 * take up all of the space in the CodeCell.
 * @param {boolean} value Expanded if true
 */
colab.cell.FormView.prototype.setExpanded = function(value) {
  if (value) {
    goog.dom.classes.add(this.getElement(), 'formview-full');
  } else {
    goog.dom.classes.remove(this.getElement(), 'formview-full');
  }
};

/**
 * Sets Element visibility.
 * @param {boolean} value
 */
colab.cell.FormView.prototype.show = function(value) {
  goog.style.setElementShown(this.getElement(), value);
};

/**
 * Type of widgets that can be parsed and turned into a FormView.
 * @enum {string}
 */
colab.cell.FormView.WidgetType = {
  TEXT: 'text',
  COMBOBOX: 'combo',
  SLIDER: 'slider'
};

/**
 * Parses the code in the code cell to generate form. Currently the code
 * Must be of form x.
 *
 * @param {string} code The content of the editor.
 */
colab.cell.FormView.prototype.parseCode = function(code) {
  // clear form and set to empty
  goog.array.forEach(this.removeChildren(true), function(child) {
    child.dispose();
  });

  // parse lines
  // TODO(kayur): put regex as class constant.
  var lines = code.split(/[\r\n]+/);
  goog.array.forEach(lines, function(line) {
    var formWidget = this.parseLine_(line);
    if (formWidget != null) {
      this.addChild(formWidget, true);
    }
  }, this);
};

/**
 * Parses the params string and returns a JSON object.
 *
 * @param {string} paramsString Parameters in string form
 * @return {Object}
 * @private
 */
colab.cell.FormView.prototype.parseParams_ = function(paramsString) {
  try {
    return /** @type {?Object} */ (JSON.parse(
        paramsString.replace(/([\S]+)\:/g, '"$1":').replace(/'/g, '"')));
  } catch (e) {
    return null;
  }
};


/**
 * Parses a line in the code cell to generate an element
 *
 * @param {string} line
 * @return {?goog.ui.Component} Form element
 * @private
 */
colab.cell.FormView.prototype.parseLine_ = function(line)
{
  // TODO(kayur): move to be part part of class
  var matches = /(\w+)\s*=(.*)#\s*@param(.*)/.exec(line);
  if (!matches)
    return null;

  // grab name value and params
  var name = matches[1];
  var value = matches[2].trim();
  var params = null;

  // parse parameters
  params = this.parseParams_(matches[3]);
  // infer type
  if (goog.isArray(params)) {
    var domain = params;
    params = {};
    params['type'] = colab.cell.FormView.WidgetType.COMBOBOX;
    params['domain'] = domain;
  } else if (!params || !params['type']) {
    params = {'type': colab.cell.FormView.WidgetType.TEXT};
  }
  return colab.cell.newFormWidget(name, value, params, this.callback_);
};

/**
 * Factory method that creates the proper type of widget for a parameter
 * based on the parsing the code.
 *
 * @param {string} name Parameter name
 * @param {string} value Parameter value
 * @param {Object} params Widget parameters. Supports 'type' value
 * These parameters come from external sources, so they should never accessed
 * as properties, only as keys.
 * @param {function(string, string)} callback Function for updating the editor
 * @return {goog.ui.Component} a field widget
 */
colab.cell.newFormWidget = function(name, value, params, callback) {
  switch (params['type'])
  {
    case colab.cell.FormView.WidgetType.SLIDER:
      return new colab.cell.SliderFormWidget(name, value, params, callback);
    case colab.cell.FormView.WidgetType.COMBOBOX:
      return new colab.cell.ComboBoxFormWidget(name, value, params, callback);
    case colab.cell.FormView.WidgetType.TEXT:
      return new colab.cell.TextFieldFormWidget(name, value, callback);
    default:
      console.error('Can not load unknown form view: ', params['type']);
      return new colab.cell.TextFieldFormWidget(name, value, callback);
  }
};


/**
 * Class for creating a text field in the from view. A text field
 * is the default value for a paramter.
 *
 * @constructor
 * @param {string} name Parameter name
 * @param {string} value Value of the Text Field
 * @param {function(string, string)} callback Callback to the editor on text
 *   field change. First parameter will be 'name' the second 'value'.
 *
 * @extends {goog.ui.Component}
 */
colab.cell.TextFieldFormWidget = function(name, value, callback) {
  goog.base(this);

  this.name_ = name;
  /**
   * @private
   * @type {string}
   */
  this.value_ = value;
  this.callback_ = callback;
};
goog.inherits(colab.cell.TextFieldFormWidget, goog.ui.Component);

/** @inheritDoc */
colab.cell.TextFieldFormWidget.prototype.createDom = function() {
  var element = goog.dom.createDom('div', 'formview-textfield');

  var label = goog.dom.createDom('div', 'formview-namelabel',
      this.name_.concat(': '));
  goog.dom.appendChild(element, label);

  var text = goog.dom.createDom('input', {
    'class': 'formview-input',
    'name': this.name_,
    'value': this.value_
  });
  goog.dom.appendChild(element, text);

  this.setElementInternal(element);
};

/** @inheritDoc */
colab.cell.TextFieldFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  var text = goog.dom.getElementByClass('formview-input', this.getElement());
  var widget = this;
  this.getHandler().listen(text, goog.events.EventType.INPUT, function(e) {
    console.log(e);
    widget.callback_(/** @type {string} */ (e.target.name),
                    /** @type {string} */ (e.target.value));
    // refers to the input
  }, false);
};

/**
 * Class for creating a combo box in the form view. The domain of the combo
 * box is specified in the domain variable.
 *
 * @constructor
 * @param {string} name Parameter name
 * @param {string} value Current value of the combobox
 * @param {Object} params Supported keys: type: colab.cell.FormView.WidgetType,
 *     domain: Array. widget creation parameters(contains combo box domain)
 * @param {function(string, string)} callback Callback to the editor on
 *   combobox change.
 * @extends {goog.ui.Component}
 */
colab.cell.ComboBoxFormWidget = function(name, value, params, callback) {
  goog.base(this);

  this.name_ = name;
  this.value_ = value;
  this.domain_ = params['domain'] || [];
  this.callback_ = callback;
};
goog.inherits(colab.cell.ComboBoxFormWidget, goog.ui.Component);

/** @inheritDoc */
colab.cell.ComboBoxFormWidget.prototype.createDom = function() {
  var element = goog.dom.createDom('div', 'formview-combobox');

  var label = goog.dom.createDom('div', 'formview-namelabel',
      this.name_.concat(': '));
  goog.dom.appendChild(element, label);

  this.setElementInternal(element);
};

/** @inheritDoc */
colab.cell.ComboBoxFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // create combobox
  var combobox = new goog.ui.ComboBox();
  goog.array.forEach(this.domain_, function(v) {
    this.addItem(new goog.ui.MenuItem(v));
  }, combobox);

  // add to widget
  this.addChild(combobox, true);
  combobox.setValue(this.value_.replace(/\"/g, ''));
  var widget = this;
  this.getHandler().listen(combobox, goog.ui.Component.EventType.CHANGE,
      function(e) {
        widget.callback_(this.name_, '"' + e.target.getValue() + '"');
      }, false);
};

/**
 * Class for creating a slider elmenet in the form view. The min, max, and
 * step values of slider are specified in the json params object.
 *
 * @constructor
 * @param {string} name Parameter name
 * @param {string} value Current value of the slider
 * @param {Object} params Slider parameters
 *     (type, min, max, step)
 * @param {function(string, string)} callback Callback to the editor on
 *   slider change.
 * @extends {goog.ui.Component}
 */
colab.cell.SliderFormWidget = function(name, value, params, callback) {
  goog.base(this);

  this.name_ = name;
  this.value_ = value;
  this.params_ = params;
  this.max = params['max'];
  this.min = params['min'];
  this.step = params['step'];
  this.callback_ = callback;
};
goog.inherits(colab.cell.SliderFormWidget, goog.ui.Component);

/** @inheritDoc */
colab.cell.SliderFormWidget.prototype.createDom = function() {
  var element = goog.dom.createDom('div', 'formview-slider');

  var label = goog.dom.createDom('div', 'formview-namelabel',
      this.name_.concat(': '));
  goog.dom.appendChild(element, label);

  goog.dom.appendChild(element, goog.dom.createDom('div', 'formview-content'));

  this.valueLabel_ = goog.dom.createDom('div', 'formview-valuelabel',
    ' [' + this.value_ + ']');
  goog.dom.appendChild(element, this.valueLabel_);

  this.setElementInternal(element);
};

/** @inheritDoc */
colab.cell.SliderFormWidget.prototype.getContentElement = function() {
  return goog.dom.getElementByClass('formview-content', this.getElement());
};

/** @inheritDoc */
colab.cell.SliderFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  var slider = new goog.ui.Slider();
  slider.setMaximum(this.max ? this.max : 100);
  slider.setMinimum(this.min ? this.min : 10);
  slider.setStep(this.step ? this.step : 1);

  // TODO(kayur): slider position doesn't update to the value when rendered.
  this.addChild(slider, true);
  slider.setValue(Number(this.value_));
  // technically unneeded since context is correct for listen()
  var widget = this;
  this.getHandler().listen(slider, goog.ui.Component.EventType.CHANGE,
      function(e) {
        goog.dom.setTextContent(widget.valueLabel_,
            ' [' + e.target.getValue() + ']');
        widget.callback_(widget.name_, e.target.getValue());
      }, false);
};

