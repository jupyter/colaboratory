/**
 *
 * @fileoverview Comments widget for notebook.  Handles realtime comments
 *
 */

goog.provide('colab.Comment');
goog.provide('colab.CommentsWidget');
goog.provide('colab.NewComment');

goog.require('goog.date');
goog.require('goog.date.DateTime');
goog.require('goog.date.relative');
goog.require('goog.dom');
goog.require('goog.dom.forms');
goog.require('goog.style');



/**
 * Creates a new comments widget object.
 * @param {colab.model.Notebook} notebook The Realtime Notebook model.
 * @constructor
 *
 * TODO (kestert): replace this with a more standard mechanism for listenining
 * for changes in the comments by other users.  This mechanism can only detect
 * changes coming from this client, and not, for example, from the Drive UI.
 *
 * TODO(kestert, kayur): When we change the sentinal add comments only
 *    functionality.
 */
colab.CommentsWidget = function(notebook) {
  /** @private {colab.drive.Permissions} Drive permissions */
  this.permissions_ = notebook.getPermissions();

  var that = this;
  this.comments = [];
  this.currentComment = null;
  /**
   * @type {gapi.client.drive.about.User}
   */
  this.user = null;
  this.activityBox = goog.dom.getElement('comments-box');
  this.commentSentinel = notebook.getCommentSentinel();

  this.commentSentinel.addEventListener(
      gapi.drive.realtime.EventType.VALUES_SET,
      function(event) {
        if (!event.isLocal)
          that.commentsUpdated(/** @type {string} */
              (that.commentSentinel.get(0)));
      });

  /** @private {string} */
  this.fileId_ = notebook.getFileId();

  var request = gapi.client.drive.about.get();
  request.execute(function(response) {
    var aboutResponse =
        /** @type {gapi.client.drive.about.AboutResponse} */ (response);
    that.user = aboutResponse.user;
    that.getCommentsList();
  });

  var commentsButton = goog.dom.getElement('comments');
  commentsButton.onclick = goog.bind(this.toggle, this);
};


/**
 * Gets the list of comments from the Google Drive API server, and then
 * redraws the comments list GUI.
 */
colab.CommentsWidget.prototype.getCommentsList = function() {
  var that = this;
  var request = gapi.client.drive.comments.list(
      /** @type {gapi.client.drive.comments.Request} */ ({
        fileId: this.fileId_ }));
  request.execute(function(response) {
    if (response.error) {
      console.log('Unable to execute drive list comments request', response);
      // TODO(kestert): display error message.
      return;
    }
    var comments = response.items || [];
    that.redrawCommentsList(comments);
  });
};


/**
 * Redraws the comments list GUI.
 * @param {Array} comments An array of comment-objects
 */
colab.CommentsWidget.prototype.redrawCommentsList = function(comments) {
  goog.dom.removeChildren(this.activityBox);

  // can only add comments if we are in edit mode.
  if (this.permissions_.isCommentable()) {
    if (!this.currentComment) {
      this.currentComment = new colab.NewComment(
          this.user.picture.url,
          goog.bind(this.insertComment, this));
    }
    goog.dom.appendChild(this.activityBox, this.currentComment.element);
  }

  this.comments = [];
  for (var i = 0; i < comments.length; i++) {
    var comment = new colab.Comment(comments[i]);
    this.comments.push(comment);
    goog.dom.appendChild(this.activityBox, comment.element);
  }
};


/**
 * Inserts a comment, then redraw the comments list UI once the comment
 * has been acknowledged by the server.
 * @param {string} content The text of the comment.
 */
colab.CommentsWidget.prototype.insertComment = function(content) {
  var that = this;
  var body = {'content': content};
  var request = gapi.client.drive.comments.insert({
    'fileId': this.fileId_,
    'resource': body
  });
  request.execute(function(response) {
    if (response.error) {
      console.log('Unable to execute drive insert comment request', response);
      // TODO(kestert): display error message.
      return;
    }

    that.currentComment = null;
    that.getCommentsList();
    that.touchCommentSentinel();
  });
};

/**
 * Toggles the visibility of the comments UI.
 */

colab.CommentsWidget.prototype.toggle = function() {
  goog.style.setElementShown(this.activityBox,
      !goog.style.isElementShown(this.activityBox));
};

/**
 * Updates the comment sentinel to contain the current timestamp, so that
 * other clients are signalled to reload their comments list.
 */

colab.CommentsWidget.prototype.touchCommentSentinel = function() {
  this.commentSentinel.set(0, new Date().toISOString());
};

/**
 * Callback for when the comment sentinal is updated by another client. Redraws
 * the comment list.
 * @param {string} timestamp the timestamp entered by the other client.
 */

colab.CommentsWidget.prototype.commentsUpdated = function(timestamp) {
  this.getCommentsList();
};



/**
 * Creates a new comment object.
 * @constructor
 * @param {Object} comment The Google Drive comment object (of kind
 *     https://developers.google.com/drive/v2/reference/comments#resource)
 *
 */
colab.Comment = function(comment) {

  this.comment_ = comment;

  this.element = null;

  this.createElement();
};

/**
 * Creates the DOM element for the comment.
 */

colab.Comment.prototype.createElement = function() {
  this.element = goog.dom.createDom('div', {
    className: 'comments-comment'
  });

  var image = goog.dom.createDom('img', {
    className: 'comments-image',
    width: 48,
    height: 48,
    src: 'https:' + this.comment_['author']['picture']['url']
  });

  goog.dom.appendChild(this.element, image);

  var content = goog.dom.createDom('div', {
    className: 'comments-content'
  });
  goog.dom.appendChild(this.element, content);

  var commentDate = goog.dom.createDom('div', {
    className: 'comments-date'
  });
  var date = new goog.date.DateTime();
  goog.date.setIso8601DateTime(date, this.comment_['modifiedDate']);
  commentDate.innerHTML = goog.date.relative.getDateString(date);
  goog.dom.appendChild(content, commentDate);

  var authorName = goog.dom.createDom('div');
  authorName.innerHTML = this.comment_['author']['displayName'];
  goog.dom.appendChild(content, authorName);

  var text = goog.dom.createDom('div', {
    className: 'comments-text'
  });
  text.innerHTML = this.comment_['htmlContent'];
  goog.dom.appendChild(content, text);

};


/**
 * Creates a new 'new comment' object.
 *
 * @constructor
 * @param {string} userImageUrl the URL of the image to display the user's icon.
 * @param {Function} onComment callback function for when the user clicks
 *     'comment'.  This should take a string containing the comment text.
 *
 */

colab.NewComment = function(userImageUrl, onComment) {
  this.element = null;
  this.text = null;
  this.commentButton = null;
  this.cancelButton = null;
  this.createElement(userImageUrl);
  this.onComment = onComment;
};


/**
 * Draws the UI element for the 'new comment' object.
 * @param {string} userImageUrl the URL of the image of the authenticated user.
 */
colab.NewComment.prototype.createElement = function(userImageUrl) {
  var that = this;
  this.element = goog.dom.createDom('div', {
    className: 'comments-comment'
  });

  var image = goog.dom.createDom('img', {
    className: 'comments-image',
    width: 48,
    height: 48,
    src: userImageUrl
  });

  goog.dom.appendChild(this.element, image);

  var content = goog.dom.createDom('div', {
    className: 'comments-content'
  });
  goog.dom.appendChild(this.element, content);

  this.text = goog.dom.createDom('textarea', {
    type: 'text',
    className: 'comments-input',
    placeholder: 'Comment...'
  });
  this.text.onkeypress = goog.bind(this.onChange, this);
  goog.dom.appendChild(content, this.text);

  this.commentButton = goog.dom.createDom('button', {
    className: 'realtime-button',
    innerHTML: 'Comment'
  });
  this.commentButton.onclick = function() {
    goog.dom.forms.setDisabled(that.commentButton, true);
    goog.dom.forms.setDisabled(that.cancelButton, true);
    that.onComment(that.text.value);
  };
  goog.style.setElementShown(this.commentButton, false);
  goog.dom.appendChild(content, this.commentButton);

  this.cancelButton = goog.dom.createDom('button', {
    className: 'realtime-button comments-button',
    innerHTML: 'Cancel'
  });
  this.cancelButton.onclick = function() {
    that.text.value = '';
    that.fixHeight();
    goog.style.setElementShown(that.commentButton, false);
    goog.style.setElementShown(that.cancelButton, false);
  };
  goog.style.setElementShown(this.cancelButton, false);
  goog.dom.appendChild(content, this.cancelButton);

};

/**
 * Callback for user entering text in the textarea.
 *
 * Sets the height of the textarea to automatically contain the text, and
 * enables the comment and cancel buttons.
 */

colab.NewComment.prototype.onChange = function() {
  this.fixHeight();
  goog.style.setElementShown(this.commentButton, true);
  goog.style.setElementShown(this.cancelButton, true);
};

/**
 * Sets the height of the text area to contain exactly the text in it.
 */

colab.NewComment.prototype.fixHeight = function() {
  this.text.style.height = '1px';
  this.text.style.height = (12 + this.text.scrollHeight) + 'px';
};
