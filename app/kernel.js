var embed;
var webview = null;
var serverAddress = 'http://127.0.0.1:8000';
var serverPath = '/static/index.html';

window.addEventListener('message', function(message) {
    console.log(message);

    if (message.sender !== webview || message.origin !== serverAddress) {
        return;
    }

    if (message.data === 'start_kernel') {
        createNaclElement();
    } else if (message.data === 'restart_kernel') {
        // TODO: handle this message
    } else if (message.data && message.data.json) {
        embed.postMessage(message.data);
    }
});

var createNaclElement = function() {
    var tty_prefix = 'tty';

    embed = document.createElement('object');
    embed.width = 0;
    embed.height = 0;
    embed.data = 'python.nmf';
    embed.type = 'application/x-pnacl';

    function addParam(name, value) {
    var param = document.createElement('param');
    param.name = name;
    param.value = value;
    embed.appendChild(param);
    }

    addParam('PS_TTY_PREFIX', tty_prefix);
    addParam('PS_TTY_RESIZE', 'tty_resize');
    addParam('PS_STDIN', '/dev/tty');
    addParam('PS_STDOUT', '/dev/tty');
    addParam('PS_STDERR', '/dev/tty');
    addParam('PS_VERBOSITY', '2');
    addParam('PS_EXIT_MESSAGE', 'exited');
    addParam('TERM', 'xterm-256color');
    addParam('NACL_DATA_URL', '/');

    // Returns an anonymous function that takes an event
    // of a given type, and transmits it to the webview.
    // the transmitted message copies the fields specified in
    // eventFields, and also has a type field given by eventType.
    function eventHandler(eventType, eventFields) {
        return function(event) {
            var message = {};
            message.type = eventType;
            for(var i = 0; i < eventFields.length; i++) {
                var field = eventFields[i];
                message[field] = event[field];
            }
	    webview.contentWindow.postMessage(message, serverAddress);
	};
    }

    var eventTypes = {'message': ['data'],
                      'progress': ['loaded', 'total'],
                      'loadend': [],
                      'crash': []};
    for (eventType in eventTypes) {
        embed.addEventListener(eventType,
			       eventHandler(eventType, eventTypes[eventType]));
    }
    document.body.appendChild(embed);
};