goog.provide('colab.drive.Permissions');



/**
 * Class representing permissions of a document
 *
 * @param {boolean} editable Document is editable.
 * @param {boolean} commentable Document allows commenting
 * @constructor
 */
colab.drive.Permissions = function(editable, commentable) {
  /** @private {boolean} */
  this.editable_ = editable;

  /** @private {boolean} */
  this.commentable_ = commentable;
};


/**
 * @return {boolean} true if notebook can be edited
 */
colab.drive.Permissions.prototype.isEditable = function() {
  return this.editable_;
};


/**
 * @return {boolean} true if notebook can be commented on
 */
colab.drive.Permissions.prototype.isCommentable = function() {
  return this.commentable_;
};
