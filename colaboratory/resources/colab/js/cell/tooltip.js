goog.provide('colab.tooltip.Tooltip');

goog.require('goog.dom');
goog.require('goog.ui.Tooltip');



/**
 * Tooltip is a simple tooltip class specialized for CodeMirror
 * code completion tooltips. TODO(sandler): Make this goog.ui.Component maybe?
 *
 * @constructor
 */
colab.tooltip.Tooltip = function() {
  this.elementCreated_ = false;
};


/**
 * Creates dom for this tooltip
 *
 * @suppress {visibility} (For hidePopupElement())
 */
colab.tooltip.Tooltip.prototype.initialize = function() {
  if (this.elementCreated_) return;
  this.tooltipEl = goog.dom.createDom('div', 'colab-tooltip');
  this.text = goog.dom.createDom('div', 'tooltiptext');
  this.arrow = goog.dom.createDom('div', 'pretooltiparrow');
  this.tooltipEl.style.setProperty('z-index', '1000');
  this.tooltipEl.style.setProperty('min-width', '100px');
  this.tooltipEl.appendChild(this.arrow);
  this.tooltipEl.appendChild(this.text);
  var tooltip = new goog.ui.Tooltip();
  this.tooltip = tooltip;
  tooltip.className = 'colab-tooltip';
  tooltip.setElement(this.tooltipEl);
  tooltip.hidePopupElement();
  document.body.appendChild(this.tooltipEl);
  this.elementCreated_ = true;
  this.shown_ = false;
};


/**
 * Shows tooltip with given text, at gixen x, y coordinate, with arrowPoint
 * in relative coordinates.
 * @param {number} x - x coordinate in pixels
 * @param {number} y - y coordinate in pixels
 * @param {number} arrowPoint - relative coordinate of the pointy end
 * (0 - to the left)
  @param {string} text to print.
 */
colab.tooltip.Tooltip.prototype.show = function(x, y, arrowPoint, text) {
  this.tooltip.showPopupElement(document.body);
  this.shown_ = true;
  var el = this.tooltip.getElement();
  el.style.setProperty('left', x + 'px');
  el.style.setProperty('top', y + 'px');
  this.arrow.style.setProperty('left', arrowPoint + 'px');
  this.text.innerHTML = IPython.utils.fixConsole(text);
};


/**
 * Shows tooltip at the cursor coordinates of the COdeMirror editor
 * @param {CodeMirror} editor
 * @param {string} text
 */
colab.tooltip.Tooltip.prototype.showAtCursor = function(editor, text)  {
  var lineCoords = editor.cursorCoords(false);
  var charCoords = editor.cursorCoords(true);
  var left = Math.max(lineCoords.left - 70, 30);
  this.left = left;
  this.show(left, charCoords.bottom + 10,
      charCoords.left - left - 30, text);
};


/**
 * @return {boolean} true iff the tooltip is currently shown.
 */
colab.tooltip.Tooltip.prototype.visible = function() {
  return this.shown_;
};


/**
 * Starts tooltip continously following cursor in CodeMirror editor
 * @param {CodeMirror} editor
 */
colab.tooltip.Tooltip.prototype.startFollowingCursor = function(editor) {
  // Clear previous, since the editor might have changed.
  if (this.positionUpdateTask) {
    clearInterval(this.positionUpdateTask);
    this.positionUpdateTask = null;
  }
  this.positionUpdateTask = setInterval(
      goog.bind(this.followCursor, this, editor), 300);
};


/**
 * Realigns (in animated fashion) tooltip so that it is next to the current
 * position.
 *
 * @param {CodeMirror} editor
 */
colab.tooltip.Tooltip.prototype.followCursor = function(editor) {
  if (!this.visible()) return;
  var charCoords = editor.cursorCoords(true);
  var newPos = charCoords.left - this.left - 30;
  var maxShift = this.tooltipEl.getBoundingClientRect().width - 30;

  if (newPos < 0) {
    this.left += newPos - maxShift / 2;
    newPos = maxShift / 2;
  }

  if (maxShift < 0) { return; }
  while (newPos > maxShift) {
    this.left += maxShift;
    newPos -= maxShift;
  }

  jQuery(this.tooltipEl).animate({
    left: this.left,
    top: charCoords.bottom + 10 }, 200);
  jQuery(this.arrow).animate({'left' : newPos}, 200);
};


/**
 * Hides tooltip
 * @suppress {visibility} (for hidePopupElement)
 */
colab.tooltip.Tooltip.prototype.hide = function() {
  if (this.positionUpdateTask) {
    clearInterval(this.positionUpdateTask);
    this.positionUpdateTask = null;
  }
  this.tooltip.hidePopupElement();
  this.shown_ = false;
};
