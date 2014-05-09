var HtmlDisplayOutputWidget = function(selector, dataSelector) {
  $(selector).html($(dataSelector).html());
  console.log($(selector).html());
};
