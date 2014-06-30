/**
 * @fileoverview Classes for paring code and creating interactive forms.
 * Currently limited to python.
 */

goog.provide('colab.cell.ComboBoxFormWidget');
goog.provide('colab.cell.FormView');
goog.provide('colab.cell.SliderFormWidget');
goog.provide('colab.cell.TextFieldFormWidget');
goog.provide('colab.cell.TitleFormWidget');

goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.events.EventType');
goog.require('goog.style');
goog.require('goog.ui.Button');
goog.require('goog.ui.ComboBox');
goog.require('goog.ui.Component');
goog.require('goog.ui.MenuItem');
goog.require('goog.ui.Slider');



/**
 * Class for the form view of the code cell. Creates a form view element
 * and manages it's visiblity.
 *
 * @param {function(string, string)} editorCallback Updates the edtior based on
 *     form changes.
 * @param {function()} runCallback Executes the code cell.
 * @extends {goog.ui.Component}
 * @constructor
 */
colab.cell.FormView = function(editorCallback, runCallback) {
  goog.base(this);

  /** @private {function(string, string)} Updates the edtior based on form
   *  changes. */
  this.editorCallback_ = editorCallback;

  /** @private {function()} */
  this.runCallback_ = runCallback;
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
  SLIDER: 'slider',
  TITLE: 'title'
};


/**
 * Parses the annotations in code comments to generate a form. Code is parsed
 * as follows. First, the entire block is segmented into lines. Then each line
 * is parsed to see if it matches any of the following patterns:
 *
 *   1. #@title <text> <params>
 *
 *      This annotation indicates a title widget. Title widgets are ususally
 *      created to hide boilerplate code or to provide more context for a form.
 *      Title widgets must be on the first line of the code block. The
 *      annotation "#@title Init Notebook" would generate a form with a run
 *      button, which can be used to execute code, and a div containing the
 *      text "Init Notebook."
 *
 *      Titles can also have parameters. For example the following:
 *      "#@title Init Notebook { run-button: "false", font-size: "10pt")
 *      changes the size of the font to 10pt and removes the run button.
 *
 *
 *   2. <var_name> = <var_value> #@param <params>
 *
 *      These annotation ares used to parameterize a notebook. There are three
 *      types of widgets currently supported. TextFeilds, ComboBoxes and
 *      Sliders. The default type is TextFeild, additional types can be
 *      defined through parameters. The following are examples of valid
 *      parameterizations.
 *
 *         x = 5 #@param -> generates a TextField
 *         x = 5 #@param { type: "slider" } -> generates a Slider
 *         x = 'a' #@param ['a', 'b', 'c'] -> generates a ComboBox
 *
 * For more information about parameters see examples notebooks at go/colab
 *
 * @param {string} code The content of the editor.
 */
colab.cell.FormView.prototype.parseCode = function(code) {
  // clear form and set to empty
  goog.array.forEach(this.removeChildren(true), function(child) {
    child.dispose();
  });

  // TODO(kayur): put regex as class constant.
  var lines = code.split(/[\r\n]+/);

  // if there aren't any lines to parse return
  if (!lines) {
    return;
  }

  // check for title
  var titleWidget = this.parseTitle_(lines[0]);
  if (titleWidget != null) {
    this.addChild(titleWidget, true);
  }

  // parse lines for variable widgets
  goog.array.forEach(lines, function(line) {
    var formWidget = this.parseLine_(line);
    if (formWidget != null) {
      this.addChild(formWidget, true);
    }
  }, this);
};


/**
 * Parses the params string and returns a JSON object. We try to make the
 * parameter easier to write and read by humans. This means turning single
 * quotes into double quotes and turning unquoted parameters into quoted
 * parameters.
 *
 * @param {string} paramsString Parameters in string form
 * @return {Object}
 * @private
 */
colab.cell.FormView.prototype.parseParams_ = function(paramsString) {
  try {
     var relaxed = paramsString.replace(/'/g, '"');
     relaxed = relaxed.replace(/(['"])?([a-zA-Z0-9_\-]+)(['"])?:/g, '"$2": ');
     return /** @type {?Object} */ (JSON.parse(relaxed));
  } catch (e) {
    return null;
  }
};


/**
 * Parses line and returns title element. Format is as follows:
 *     #@title <title>
 *
 * @param {string} line Line of code
 * @return {?goog.ui.Component} Title element
 * @private
 */
colab.cell.FormView.prototype.parseTitle_ = function(line) {
  var matches = /^#@title\s(.*)/.exec(line);
  if (!matches) {
    return null;
  }

  // check to see if there are any parameters
  var paramsMatches = /(.*)(\{.*)/.exec(matches[1]);
  var titleText = '';
  var params = {};
  if (!paramsMatches) {
    titleText = matches[1].trim();
  } else {
    titleText = paramsMatches[1];
    params = this.parseParams_(paramsMatches[2]) || {};
  }

  return new colab.cell.TitleFormWidget(titleText, params, this.runCallback_);
};


/**
 * Parses a line in the code cell to generate an element
 *
 * @param {string} line
 * @return {?goog.ui.Component} Form element
 * @private
 */
colab.cell.FormView.prototype.parseLine_ = function(line) {
  // TODO(kayur): move to be part part of class
  var matches = /(\w+)\s*=(.*)#\s*@param(.*)/.exec(line);
  if (!matches) {
    return null;
  }

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
  return colab.cell.newFormWidget_(name, value, params, this.editorCallback_);
};


/**
 * Factory method that creates the proper type of widget for a parameter
 * based on the parsing the code.
 *
 * @param {string} name Parameter name
 * @param {string} value Parameter value
 * @param {Object} params Widget parameters. Supports 'type' value. These
 *     parameters come from external sources, so they should never accessed
 *     as properties, only as keys.
 * @param {function(string, string)} callback Function for updating the editor
 * @return {goog.ui.Component} a field widget
 * @private
 */
colab.cell.newFormWidget_ = function(name, value, params, callback) {
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
 *     field change. First parameter will be 'name' the second 'value'.
 *
 * @extends {goog.ui.Component}
 */
colab.cell.TextFieldFormWidget = function(name, value, callback) {
  goog.base(this);

  this.name_ = name;
  /** @private {string} */
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
 *     combobox change.
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
 *     slider change.
 * @extends {goog.ui.Component}
 */
colab.cell.SliderFormWidget = function(name, value, params, callback) {
  goog.base(this);

  this.name_ = name;
  this.value_ = value;
  this.params_ = params;
  this.max = this.params_['max'];
  this.min = this.params_['min'];
  this.step = this.params_['step'];
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


/**
 * Class for creating a Title widget. Titles are text with a run button.
 *
 * @constructor
 * @param {string} titleText Parameter name
 * @param {Object} params TextBox parameters
 * @param {function()} callback Call back for running code.
 * @extends {goog.ui.Component}
 */
colab.cell.TitleFormWidget = function(titleText, params, callback) {
  goog.base(this);

  this.titleText_ = titleText;
  this.callback_ = callback;
  this.params_ = params;
};
goog.inherits(colab.cell.TitleFormWidget, goog.ui.Component);


/** @inheritDoc */
colab.cell.TitleFormWidget.prototype.createDom = function() {
  var element = goog.dom.createDom('div', 'formview-title');

  var label = goog.dom.createDom('div', 'formview-title-text',
      this.titleText_);
  goog.dom.appendChild(element, label);

  // set title style
  var elementStyles = ['font-size', 'font-weight'];
  goog.array.forEach(elementStyles, function(style) {
    if (this.params_[style]) {
      goog.style.setStyle(label, style, this.params_[style]);
    }
  }, this);

  this.setElementInternal(element);
};


/** @inheritDoc */
colab.cell.TitleFormWidget.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // add run button
  if (this.params_['run-button'] != 'false') {
    var button = new goog.ui.Button('Run');
    this.addChild(button, true);
    this.getHandler().listenWithScope(button,
        goog.ui.Component.EventType.ACTION,
        function(e) { this.callback_(); }, false, this);
  }
};
