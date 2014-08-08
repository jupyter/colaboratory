goog.provide('colab.SvgButton');

goog.require('goog.dom');
goog.require('goog.events');
goog.require('goog.events.EventType');
goog.require('goog.ui.ToolbarButton');



/**
 * A toolbar button that contains an SVG image as its content.
 *
 * @constructor
 * @param {string} link the location of the image file to display. Hovering
 * depends on the existence of images at both link.svg and link-hover.svg
 * @param {string} title tooltip to display on hover.
 * @extends {goog.ui.ToolbarButton}
 */
colab.SvgButton = function(link, title) {
  // TOOD(colab-team): Fix urls for links to be absolute in google version.
  link = '/colab/' + link;

  var el = goog.dom.createDom('img', {
      'src': link + '.svg',
      'title': title,
      'class': 'button-svg'
    });

  /** @private @type {Element} */
  this.imageElement_ = el;

  /** @private @type {string} */
  this.imagePath_ = link;

  /** @private @type {boolean} */
  this.isHovered_ = false;

  /** @private @type {string} */
  this.title_ = title;

  goog.ui.ToolbarButton.call(this, el);
};
goog.inherits(colab.SvgButton, goog.ui.ToolbarButton);


/**
 * @param {string} link
 * @param {string} title new tooltip to display
 */
colab.SvgButton.prototype.setImage = function(link, title) {
  this.imagePath_ = link;
  this.title_ = title;
  this.displayTitle_();
  this.displayImage_();
};


/** @private */
colab.SvgButton.prototype.displayTitle_ = function() {
  this.getElement().setAttribute('title', this.title_);
};


/** @private Display the image stored in this.imagePath_. */
colab.SvgButton.prototype.displayImage_ = function() {
  var link = this.imagePath_;
  if (this.isHovered_) {
    this.imageElement_.setAttribute('src', link + '-hover.svg');
  } else {
    this.imageElement_.setAttribute('src', link + '.svg');
  }
};


/** @override */
colab.SvgButton.prototype.enterDocument = function() {
  goog.base(this, 'enterDocument');

  this.displayTitle_();

  this.getHandler().listen(this.getElement(), goog.events.EventType.MOUSEENTER,
      function(e) {
        this.isHovered_ = true;
        this.displayImage_();
      });

  this.getHandler().listen(this.getElement(), goog.events.EventType.MOUSELEAVE,
      function(e) {
        this.isHovered_ = false;
        this.displayImage_();
      });
};
