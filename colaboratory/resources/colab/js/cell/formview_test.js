/**
 *
 * @fileoverview Description of this file.
 *
 */

goog.provide('colab.testing.FormViewTest');
goog.setTestOnly('colab.testing.FormViewTest');

goog.require('colab.cell.FormView');
goog.require('goog.testing.jsunit');



function setUpPage() {
  formView = new colab.cell.FormView(function(c, v) { });
  formView.render();
}

function tearDown() {
  formView.dispose();
}

function testTextFieldWidgetParsing() {
  formView.parseCode('x = 5 #@param');
  assertEquals(formView.getChildCount() , 1);

  var widget = formView.getChildAt(0);
  assertEquals(widget.name, 'x');
  assertEquals(widget.value, '5');
  assertEquals(widget.getElement().className, 'formview-textfield');
}

function testSliderWidgetParsing() {
  formView.parseCode('x = 5 #@param { type: "slider" }');
  assertEquals(formView.getChildCount() , 1);

  var widget = formView.getChildAt(0);
  assertEquals(widget.name, 'x');
  assertEquals(widget.value, '5');
  assertEquals(widget.getElement().className, 'formview-slider');
}

function testComboBoxWidgetParsing() {
  formView.parseCode('x = "a" #@param ["a", "b"]');
  assertEquals(formView.getChildCount() , 1);

  var widget = formView.getChildAt(0);
  assertEquals(widget.name, 'x');
  assertEquals(widget.value, '"a"');
  assertEquals(widget.getElement().className, 'formview-combobox');
}

function testTitleWidgetParsing() {
  formView.parseCode('#@title Sample Title');
  assertEquals(formView.getChildCount() , 1);

  var widget = formView.getChildAt(0);
  assertEquals(widget.titleText_, 'Sample Title');
  assertEquals(widget.getElement().className, 'formview-title');
}
