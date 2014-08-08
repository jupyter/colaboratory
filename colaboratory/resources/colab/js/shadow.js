goog.provide('colab.Shadow');

goog.require('goog.dom');



/**
 * Add classes to given elements to produce quantum paper style drop shadow.
 * Populate this.shadow_ and set this.zIndex_.
 * To replicate behavior of polymer paper-shadow custom element, call this
 * before adding any children to passed element.
 *
 * @constructor
 * @param {Element|{length:number}} target shadow element or array-like list,
 * of elements, overflow will be set to visible
 * @param {number=} opt_z initial z-index of element at which to render shadow
 */
colab.Shadow = function(target, opt_z) {

  /** @private {Array.<{top: Element, bottom: Element}>} */
  this.shadow_ = [];

  /** @private @type {number} */
  this.zIndex_ = opt_z !== undefined ? opt_z : 1;

  //  create a singleton list if provided with a single target
  var list = target.length !== undefined ? target : [target];

  list.forEach(function(el) {
    var topEl = goog.dom.createDom('div');
    goog.dom.appendChild(el, topEl);
    var bottomEl = goog.dom.createDom('div');
    goog.dom.appendChild(el, bottomEl);

    this.shadow_.push({top: topEl, bottom: bottomEl});

    var last = this.shadow_.length - 1;
    for (var part in this.shadow_[last]) {
      goog.dom.classes.add(this.shadow_[last][part], 'paper-shadow-' + part +
          ' paper-shadow-' + part + '-z-' + this.zIndex_ +
          ' paper-shadow-animated');
    }
  }, this);
};


/**
 * Change the z-depth of an element with shadow.
 *
 * @param {number} z the target z-depth
 */
colab.Shadow.prototype.setZ = function(z) {
  var old = this.zIndex_;
  this.zIndex_ = z;

  this.shadow_.forEach(function(els) {
    for (var part in els) {
      goog.dom.classes.remove(els[part],
          'paper-shadow-' + part + '-z-' + old);
      goog.dom.classes.add(els[part],
          'paper-shadow-' + part + '-z-' + this.zIndex_);
      goog.style.setStyle(els[part], 'z-index', z);
    }
  }, this);
};
