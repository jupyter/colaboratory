// Copyright 2013 Google Inc. All Rights Reserved.

/**
 * @fileoverview Code to create an output widget
 * @author kestert@google.com (Kester Tong)
 */

/**
 * @param {string} widgetId - unique id of this widget
 * @param {function} widgetClass - function that constructs the widget
 */
var createWidget = function(widgetId, widgetClass) {
  var selector = '#' + widgetId + ' .guiElement';
  var dataSelector = '#' + widgetId + ' .dataContainer';
  var metadataSelector = '#' + widgetId + ' .metadataContainer';

  var metadata = $.parseJSON($(metadataSelector).html());

  // load CSS files
  for (var i = 0; i < metadata.cssFiles.length; i++) {
    $('head').append("<link rel='stylesheet' type='text/cs' href='" +
        metadata.cssFiles[i] + "'/>");
  }

  var widget = new widgetClass(selector, dataSelector);
};
