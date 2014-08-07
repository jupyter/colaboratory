/**
 *
 * @fileoverview Handle collaborative presence.
 * TODO(kayur): turn this into a component.
 */

goog.provide('colab.presence');

goog.require('colab.Global');
goog.require('goog.array');
goog.require('goog.dom');


/**
 * Update collaborators list.
 */
colab.presence.updateCollaborators = function() {
  var collaboratorsDiv = goog.dom.getElement('collaborators');
  var collaboratorsList = colab.Global.getInstance().notebookModel.getDocument()
      .getCollaborators();

  colab.presence.populateCollaboratorsDiv(collaboratorsDiv,
      collaboratorsList, 4);
};


/**
 * Update collaborators list.
 * @param {gapi.drive.realtime.BaseModelEvent} ev
 */
colab.presence.collaboratorLeft = function(ev) {
  var event = /** @type {gapi.drive.realtime.CollaboratorLeftEvent} */ (ev);
  colab.presence.updateCollaborators();
  colab.Global.getInstance().notebook.removeCollaborator(event.collaborator);
};


/**
 * Create the portrait for a collaborator.
 * @param {gapi.drive.realtime.Collaborator} collaborator Collaborator info
 * @return {Element} Img element for the collaborator
 * @private
 */
colab.presence.createCollaboratorImg_ = function(collaborator) {
  var imgSrc = collaborator.photoUrl == null ?
      'img/anon.jpeg' : colab.drive.urlWithHttpsProtocol(collaborator.photoUrl);

  var isMe = collaborator.isMe &&
      collaborator.sessionId === colab.Global.getInstance().me.sessionId &&
      collaborator.userId === colab.Global.getInstance().me.userId;

  var collaboratorImg = goog.dom.createDom('img', {
    'class': 'collaborator collaborator-img',
    'style': 'background-color:' + collaborator.color,
    'src': imgSrc,
    'title': collaborator.displayName + (isMe ? ' (Me)' : ''),
    'alt': collaborator.displayName
  });

  return collaboratorImg;
};


/**
 * Create div with the list of collaborators. If there are more than the
 * number that can be shown. We show n-1 portraits, and collapse the rest into
 * an overflow element.
 *
 * @param {Element} collaboratorsDiv Container for collaborators
 * @param {Array.<gapi.drive.realtime.Collaborator>} collaborators
 * @param {number=} opt_numShown Maximum collaborators shown. Default 2.
 */
colab.presence.populateCollaboratorsDiv = function(collaboratorsDiv,
    collaborators, opt_numShown) {
  var numShown = opt_numShown || 2;

  // clear dom
  goog.dom.removeChildren(collaboratorsDiv);

  // add overflow collaborators
  var overflowCollaborators = [];
  goog.array.forEach(collaborators, function(collaborator, index) {

    // if there are more than the number we can show (show n-1) and
    // have the last element be an overflow element.
    if (numShown < collaborators.length && index >= (numShown - 1)) {
      overflowCollaborators.push(collaborator.displayName);
    } else {
      var collaboratorImg = colab.presence.createCollaboratorImg_(collaborator);
      goog.dom.appendChild(collaboratorsDiv, collaboratorImg);
    }
  });

  // add overflow collaborators
  if (overflowCollaborators.length != 0) {
    var overflowText = '+' + (collaborators.length - numShown + 1).toString();
    var overflowDiv = goog.dom.createDom('div',
        {
          'class': 'collaborator collaborator-overflow',
          'title': overflowCollaborators.join('\n')
        },
        goog.dom.createDom('span', 'overflow-text', overflowText));
    goog.dom.appendChild(collaboratorsDiv, overflowDiv);
  }
};
