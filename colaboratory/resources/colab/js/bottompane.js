goog.provide('colab.BottomPane');

goog.require('goog.dom');
goog.require('goog.dom.classes');
goog.require('goog.events.EventType');
goog.require('goog.fx.Dragger');
goog.require('goog.style');
goog.require('goog.ui.Button');
goog.require('goog.ui.Component');



/**
 * Bottom Pane for colaboratory Notebook.
 *
 * @extends {goog.ui.Component}
 * @constructor
 */
colab.BottomPane = function() {
  goog.base(this);
  this.savedHeight = 0;
};
goog.inherits(colab.BottomPane, goog.ui.Component);


/** @inheritDoc */
colab.BottomPane.prototype.createDom = function() {
  var element = goog.dom.createDom('div', 'bottompane');

  goog.dom.appendChild(element, goog.dom.createDom('div', 'bottompane-handle'));
  goog.dom.appendChild(element, goog.dom.createDom('div',
      'bottompane-toolbar'));

  var contentElement = goog.dom.createDom('div', 'bottompane-content');
  goog.dom.appendChild(element, contentElement);

  this.setElementInternal(element);
};


/**
 * Resize bottom page content.
 * @param {number} height height in pixels
 */
colab.BottomPane.prototype.setHeight = function(height) {
  if (height) this.savedHeight = height;
  goog.style.setHeight(this.getContentElement(), height);
};


/**
 * Restores the panel to previous non-zero heigh
 */
colab.BottomPane.prototype.restore = function() {
  if (!this.savedHeight) {
    this.savedHeight = window.innerHeight / 4;
  }
  this.setHeight(this.savedHeight);
};

/**
 * Minimizes the panel
 */
colab.BottomPane.prototype.minimize = function() {
  this.setHeight(0);
};

/** @inheritDoc */
colab.BottomPane.prototype.getContentElement = function() {
  return this.getElementByClass('bottompane-content');
};


/** @inheritDoc */
colab.BottomPane.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  // add close button
  var toolbarDiv = this.getElementByClass('bottompane-toolbar');
  var closeButton = new goog.ui.Button('Close');
  this.addChild(closeButton);
  closeButton.render(toolbarDiv);

  // listen and minimize
  this.getHandler().listenWithScope(closeButton,
      goog.ui.Component.EventType.ACTION, function(e) { this.minimize(); },
      false, this);

  // add fx dragger to handle
  var handleEl = this.getElementByClass('bottompane-handle');
  this.getHandler().listenWithScope(handleEl, goog.events.EventType.MOUSEDOWN,
      function(clickEvent) {
        var d = new goog.fx.Dragger(handleEl);
        this.getHandler().listenWithScope(d, goog.fx.Dragger.EventType.DRAG,
            function(e) {
              this.setHeight(window.innerHeight - e.clientY);
              goog.dom.classes.add(document.body, 'bottompane-drag');
            }, false, this);
        this.getHandler().listen(d, goog.fx.Dragger.EventType.END, function(e) {
          goog.dom.classes.remove(document.body, 'bottompane-drag');
          d.dispose();
        });
        d.startDrag(clickEvent);
      }, false, this);
};
