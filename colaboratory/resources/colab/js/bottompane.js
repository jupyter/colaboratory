goog.provide('colab.BottomPane');

goog.require('colab.Global');
goog.require('goog.array');
goog.require('goog.dom');
goog.require('goog.dom.TagName');
goog.require('goog.dom.ViewportSizeMonitor');
goog.require('goog.dom.classes');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.fx.Dragger');
goog.require('goog.object');
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

  /** @private {number} */
  this.currentHeight_ = 0;

  /** @private {number} */
  this.restoreHeight_ = 0;

  /** @private {Element} */
  this.tabBar_ = null;

  /** @private {Object.<string,Element>} */
  this.tabs_ = {};

  /** @private {Array.<string>} */
  this.tabNames_ = [];

  /** @private {Array.<string>} */
  this.INIT_TAB_NAMES_ = [];

  /** @private {number} */
  this.numTabs_ = 0;

  /** @private {number} */
  this.tabBarHeight_ = 0;

  /** @private {number} */
  this.handleHeight_ = 0;

  /** @private {number} */
  this.ANIMATE_TIME_ = 100;
};
goog.inherits(colab.BottomPane, goog.ui.Component);


/** @override */
colab.BottomPane.prototype.createDom = function() {
  var element = goog.dom.createDom(goog.dom.TagName.DIV, 'bottompane');

  var handle = goog.dom.createDom(goog.dom.TagName.DIV,
      'bottompane-handle');
  goog.dom.appendChild(element, handle);
  var contentElement = goog.dom.createDom(goog.dom.TagName.DIV,
      'bottompane-content');
  goog.dom.appendChild(element, contentElement);
  this.tabBar_ = goog.dom.createDom(goog.dom.TagName.DIV,
      'goog-tab-bar goog-tab-bar-top');
  goog.dom.appendChild(contentElement, this.tabBar_);

  goog.array.forEach(this.INIT_TAB_NAMES_, this.addTab, this);
  goog.dom.appendChild(this.tabBar_, goog.dom.createDom(goog.dom.TagName.DIV,
      'bottompane-toolbar'));

  var tabContent = goog.dom.createDom(goog.dom.TagName.DIV, 'tab-content');
  goog.dom.appendChild(contentElement, tabContent);

  this.setElementInternal(element);
};


/**
 * Adds a tab.
 * @param {string} name to display
 */
colab.BottomPane.prototype.addTab = function(name) {
  if (this.hasTab(name)) throw 'Tried to create already existing tab ' + name;

  var tab = goog.dom.createDom(goog.dom.TagName.DIV,
      'goog-tab tab-' + this.numTabs_);
  goog.dom.setTextContent(tab, name);
  goog.dom.appendChild(this.tabBar_, tab);

  var content = goog.dom.createDom(goog.dom.TagName.DIV, 'goog-tab-content');
  this.tabs_[name] = content;

  goog.events.listen(tab, goog.events.EventType.CLICK, function(e) {
    var el = e.target;
    this.selectTab(el.innerHTML);
  }, false, this);

  this.tabNames_.push(name);
  this.numTabs_++;
};


/**
 * Checks if a tab has already been created.
 * @param {string} name of queried tab
 * @return {boolean} whether the tab exists
 */
colab.BottomPane.prototype.hasTab = function(name) {
  return goog.object.containsKey(this.tabs_, name);
};


/**
 * Sets the content of tab with given name.
 * @param {string} name of tab to modify
 * @param {Element} content to display in tab
 */
colab.BottomPane.prototype.setTabContent = function(name, content) {
  if (!(this.hasTab(name))) throw 'Tried to modify non-existent tab ' + name;

  var el = this.tabs_[name];
  goog.dom.removeChildren(el);
  goog.dom.appendChild(el, content);
};


/**
 * Force selects a tab in the UI.
 * @param {string} name name of tab to select
 */
colab.BottomPane.prototype.selectTab = function(name) {
  if (!(this.hasTab(name))) throw 'Tried to highlight non-existent tab ' + name;

  var old = this.getElementByClass('goog-tab-selected');
  if (old) goog.dom.classes.remove(old, 'goog-tab-selected');

  var tabNum = this.tabNames_.indexOf(name);
  var show = this.getElementByClass('tab-' + tabNum);
  goog.dom.classes.add(show, 'goog-tab-selected');

  var el = this.getElementByClass('tab-content');
  goog.dom.removeChildren(el);
  goog.dom.appendChild(el, this.tabs_[name]);
};


/**
 * Resize bottom page content.
 * @param {number=} opt_height height in pixels, or current height if undefined
 * @param {number=} opt_time animate transition in time milliseconds,
 * or no animation if not specified
 */
colab.BottomPane.prototype.setHeight = function(opt_height, opt_time) {
  var height = opt_height !== undefined ? opt_height : this.currentHeight_;

  // Bounds checking on height (0 - bottom of top floater)
  var maxHeight = goog.dom.getViewportSize().height - this.handleHeight_ -
      goog.dom.getElement('top-floater').offsetHeight;
  height = height > maxHeight ? maxHeight : height;
  height = height < 0 ? 0 : height;

  if (opt_time) {
    var stepFn = goog.bind(this.setHeight_, this);
    jQuery({'height': this.currentHeight_}).animate({'height': height}, {
      duration: opt_time,
      step: stepFn
    });
  } else {
    // hack because duration: 0 animation is not working instantly
    this.setHeight_(height);
  }
  this.currentHeight_ = height;
};


/**
 * Resizes page divs to match given pane height.
 * @param {number} height to resize bottom pane content (inc tab bar) to
 * @private
 */
colab.BottomPane.prototype.setHeight_ = function(height) {
  var allContent = this.getElementByClass('bottompane-content');
  var tabContent = this.getElementByClass('tab-content');

  goog.style.setHeight(allContent, height);
  goog.style.setHeight(tabContent, height - this.tabBarHeight_);
  colab.Global.getInstance().notebook.resize();
};


/**
 * Restores the panel to previous non-zero height.
 */
colab.BottomPane.prototype.restore = function() {
  if (!this.restoreHeight_) {
    this.restoreHeight_ = window.innerHeight / 4;
  }
  this.setHeight(this.restoreHeight_, this.ANIMATE_TIME_);
};


/**
 * Minimizes the panel.
 */
colab.BottomPane.prototype.minimize = function() {
  this.setHeight(0, this.ANIMATE_TIME_);
};


/**
 * Handles logic for drag events on the bottom pane handle. Only handles DRAG
 * and END event types.
 * @param {goog.events.Event} e Drag event generated by goog.fx.Dragger handler.
 * @private
 */
colab.BottomPane.prototype.handleDrag_ = function(e) {
  var dragY = window.innerHeight - e.clientY - (this.handleHeight_ / 2);
  if (e.type == goog.fx.Dragger.EventType.DRAG) {
    goog.dom.classes.add(document.body, 'bottompane-drag');
    this.setHeight(dragY > 0 ? dragY : 0);
  }
  if (e.type == goog.fx.Dragger.EventType.END) {

    // a double click on a closed bar will also generate a drag END event
    // so check that this.currentHeight_ is non-0
    if (this.currentHeight_) {
      if (dragY < this.tabBarHeight_) {
        this.minimize();
      } else {
        this.restoreHeight_ = dragY;
      }
    }
    goog.dom.classes.remove(document.body, 'bottompane-drag');
  }
};


/**
 * Handle window resize by adjusting the heights of bottompane and notebook
 * container. Called by parent notebook container.
 */
colab.BottomPane.prototype.onWindowResize = function() {
  this.setHeight(undefined /* use current height */,
      undefined /* no animation */);
};


/** @override */
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
  var d = new goog.fx.Dragger(handleEl);
  var DRAG_EVENTS = [goog.fx.Dragger.EventType.DRAG,
    goog.fx.Dragger.EventType.END];
  this.getHandler().listenWithScope(d, DRAG_EVENTS, this.handleDrag_,
      false, this);

  this.getHandler().listenWithScope(handleEl, goog.events.EventType.DBLCLICK,
      function(e) {
        if (this.currentHeight_) {
          this.minimize();
        } else {
          this.restore();
        }
      }, false, this);

  // Select the first tab by default, if it exists
  if (this.INIT_TAB_NAMES_.length) {
    this.selectTab(this.INIT_TAB_NAMES_[0]);
  }

  this.tabBarHeight_ = this.getElementByClass('goog-tab-bar').offsetHeight;
  this.handleHeight_ = this.getElementByClass('bottompane-handle').offsetHeight;

  this.minimize();
};
