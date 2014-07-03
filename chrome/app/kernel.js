/**
 * Singleton object to handle PNaCl kernel.
 *
 * @constructor
 * @param {Function} sendMessage function to post message to webview
 */
Kernel = function(sendMessage) {
  /** @private {Element} Embed element for the PNaCl kernel */
  this.embed_ = null;

  /** @private {Function} callback to post messages */
  this.sendMessage_ = sendMessage;
};


/**
 * Starts the kernel
 */
Kernel.prototype.start = function() {
  var that = this;
  var tty_prefix = 'tty';

  this.embed_ = document.createElement('object');
  this.embed_.width = 0;
  this.embed_.height = 0;
  this.embed_.data = '/pnacl/kernel.nmf';
  this.embed_.type = 'application/x-pnacl';

  function addParam(embed, name, value) {
    var param = document.createElement('param');
    param.name = name;
    param.value = value;
    that.embed_.appendChild(param);
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
  addParam('ZEROPY_PACKAGE', 'zeropy_20140520.tar.gz')

  var eventTypes = {'message': ['data'],
                    'progress': ['loaded', 'total'],
                    'loadend': [],
                    'crash': []};

  for (type in eventTypes) {
    (function(type) {
      that.embed_.addEventListener(type, function(event) {
        var message = {'type': type};
        var fields = eventTypes[type];
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          message[field] = event[field];
        }
        that.sendMessage_(message);
      });
    })(type);
  }

  document.body.appendChild(this.embed_);
};


/**
 * Starts the kernel
 */
Kernel.prototype.restart = function() {
  // TODO(kestert): handle this
};

/**
 * Handle a message for the kernel
 * @param {Object} message Message for the kernel.
 */
Kernel.prototype.handleMessage = function(message) {
  this.embed_.postMessage(message);
};
