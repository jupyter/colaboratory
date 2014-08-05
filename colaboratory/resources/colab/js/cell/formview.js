goog.provide('colab.cell.FormView');
goog.provide('colab.cell.FormsParams');

goog.require('colab.cell.ComboBoxFormWidget');
goog.require('colab.cell.SliderFormWidget');
goog.require('colab.cell.TextFieldFormWidget');
goog.require('colab.cell.TitleFormWidget');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.dom.classes');
goog.require('goog.style');
goog.require('goog.ui.Component');



/**
 * Class for the form view of the code cell. Creates a form view element
 * and manages it's visiblity.
 *
 * TOOD(colab-team): Move from callbacks to events. Have widgets and formview
 *     generate and emit events.
 *
 * @final @constructor @extends {goog.ui.Component}
 */
colab.cell.FormView = function() {
  goog.base(this);
};
goog.inherits(colab.cell.FormView, goog.ui.Component);


/** @override */
colab.cell.FormView.prototype.createDom = function() {
  this.setElementInternal(goog.dom.createDom(goog.dom.TagName.DIV, 'formview'));
};


/**
 * Sets toggles class that sets expaned mode. Exapnded means the form should
 * take up all of the space in the CodeCell.
 * @param {boolean} value Expanded if true.
 */
colab.cell.FormView.prototype.setExpanded = function(value) {
  goog.dom.classes.enable(this.getElement(), 'formview-full', value);
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
 *     This annotation indicates a title widget. Title widgets are usually
 *     created to hide boilerplate code or to provide more context for a form.
 *     Title widgets must be on the first line of the code block. The
 *     annotation "#@title Init Notebook" would generate a form with a run
 *     button, which can be used to execute code, and a div containing the
 *     text "Init Notebook."
 *
 *     Titles can also have parameters. For example the following:
 *     "#@title Init Notebook { run-button: "false", font-size: "10pt")
 *     changes the size of the font to 10pt and removes the run button.
 *
 *   2. <var_name> = <var_value> #@param <params>
 *
 *     These annotation ares used to parameterize a notebook. There are three
 *     types of widgets currently supported. TextFeilds, ComboBoxes and
 *     Sliders. The default type is TextFeild, additional types can be
 *     defined through parameters. The following are examples of valid
 *     parameterizations.
 *
 *       x = 5 #@param -> generates a TextField
 *       x = 5 #@param { type: "slider" } -> generates a Slider
 *       x = 'a' #@param ['a', 'b', 'c'] -> generates a ComboBox
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


/** @typedef {{type: colab.cell.FormView.WidgetType}} */
colab.cell.FormsParams;


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
 * Parses line and returns title element.
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

  return new colab.cell.TitleFormWidget(titleText,
      /** @type {colab.cell.TitleParams} */ (params));
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
  return colab.cell.newFormWidget_(name, value,
      /** @type {colab.cell.FormsParams} */ (params));
};


/**
 * Private factory method that creates the proper type of widget for a parameter
 * based on the parsing the code.
 *
 * @param {string} name Parameter name
 * @param {string} value Parameter value
 * @param {colab.cell.FormsParams} params Widget parameters. Supports 'type'
 *     value. These parameters come from external sources, so they should never
 *     accessed as properties, only as keys.
 * @return {goog.ui.Component} a field widget
 * @private
 */
colab.cell.newFormWidget_ = function(name, value, params) {
  switch (params['type'])
  {
    case colab.cell.FormView.WidgetType.SLIDER:
      return new colab.cell.SliderFormWidget(name, value,
          /** @type {colab.cell.SliderParams} */ (params));
    case colab.cell.FormView.WidgetType.COMBOBOX:
      return new colab.cell.ComboBoxFormWidget(name, value,
          /** @type {colab.cell.ComboBoxParams} */ (params));
    case colab.cell.FormView.WidgetType.TEXT:
      return new colab.cell.TextFieldFormWidget(name, value);
    default:
      console.error('Can not load unknown form view: ', params['type']);
      return new colab.cell.TextFieldFormWidget(name, value);
  }
};
