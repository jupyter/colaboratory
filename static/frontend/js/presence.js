/**
 *
 * @fileoverview Handle collaborative presence.
 * TODO(kayur): turn this into a component.
 */

goog.provide('colab.Presence');

goog.require('goog.array');
goog.require('goog.dom');


/**
 * Update collaborators list.
 */
colab.updateCollaborators = function() {
  var collaboratorsDiv = goog.dom.getElement('collaborators');
  var collaboratorsList = colab.globalRealtimeDoc.getCollaborators();

  colab.populateCollaboratorsDiv(collaboratorsDiv, collaboratorsList, 4);
};

/**
 * Create the portrait for a collaborator.
 * @param {gapi.drive.realtime.Collaborator} collaborator Collaborator info
 * @return {Element} Img element for the collaborator
 * @private
 */
colab.createCollaboratorImg_ = function(collaborator) {
  var imgSrc = collaborator.photoUrl == null ?
      'img/anon.jpeg' : 'https:' + collaborator.photoUrl;

  var isMe = collaborator.isMe &&
      collaborator.sessionId === colab.globalMe.sessionId &&
      collaborator.userId === colab.globalMe.userId;

  var collaboratorImg = goog.dom.createDom('img', {
    'class': 'collaborator-img',
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
 * @param {number} opt_numShown Maximum collaborators shown. Default 2.
 */
colab.populateCollaboratorsDiv = function(collaboratorsDiv,
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
      var collaboratorImg = colab.createCollaboratorImg_(collaborator);
      goog.dom.appendChild(collaboratorsDiv, collaboratorImg);
  }
  });

  // add overflow collaborators
  if (overflowCollaborators.length != 0) {
    var overflowText = '+' + (collaborators.length - numShown + 1).toString();
    var overflowDiv = goog.dom.createDom('div',
        {
          'class': 'collaborator-overflow',
          'title': overflowCollaborators.join('\n')
        },
        goog.dom.createDom('span', 'overflow-text', overflowText));
    goog.dom.appendChild(collaboratorsDiv, overflowDiv);
  }
};
