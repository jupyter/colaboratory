/**
 *
 * @fileoverview Class to handler PNaCl kernel
 *
 * This provides a class for constructing a PNaCl kernel and
 * relaying it's messages to a webview.
 */

var colab = colab || {};

/**
 * Singleton object to handle PNaCl kernel.
 *
 * @constructor
 * @param {colab.Webview} webview Webview interface used to communicate
 */
colab.Kernel = function(webview) {
  /**
   * Embed element for the PNaCl kernel
   * @type {Element}
   * @private
   */
  this.embed_ = null;

  /**
   * Listeners for embed messages
   * @type {Array.<Function>}
   * @private
   */
  this.embedListeners_ = [];

  /**
   * @type {Webview}
   * @private
   */
  this.webview_ = webview;

  this.addWebviewListeners_();
};

/**
 * Adds listeners for messages from webview
 * @private
 */
colab.Kernel.prototype.addWebviewListeners_ = function() {
  var that = this;
  this.webview_.addMessageListener('start_kernel', function(msgType, content) {
    that.start_();
  });

  this.webview_.addMessageListener('restart_kernel', function(msgType, content) {
    that.restart_();
  });

  this.webview_.addMessageListener('kill_kernel', function(msgType, content) {
    that.kill_();
  });

  this.webview_.addMessageListener('pick_file', function(msgType, content) {
    that.pickFile_();
  });

  this.webview_.addMessageListener('kernel_message', function(msgType, content) {
    if (that.embed_) {
      that.embed_.postMessage({json: content});
    }
  });

}

/**
 * Starts the kernel
 * @private
 */
colab.Kernel.prototype.start_ = function() {
  var that = this;
  var tty_prefix = 'tty';

  this.embed_ = document.createElement('object');
  this.embed_.width = 0;
  this.embed_.height = 0;
  this.embed_.data = '/pnacl/kernel.nmf';
  this.embed_.type = 'application/x-pnacl';

  function addParam(name, value) {
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
  addParam('PNACL_PACKAGE', 'pnacl_data.tar.gz')
  addParam('HTTPFS_OPTS', 'cache_content=true,' + 
                          'cache_stat=true,' +
                          'allow_cross_origin_requests=true,' +
                          'allow_credentials=false');

  var eventTypes = {'message': ['data'],
                    'progress': ['loaded', 'total'],
                    'loadend': [],
                    'crash': []};

  for (type in eventTypes) {
    var listener = (function(type) {
      return function(event) {
        var message = {'type': type};
        var fields = eventTypes[type];
        for (var i = 0; i < fields.length; i++) {
          var field = fields[i];
          message[field] = event[field];
        }
        that.webview_.postMessage('kernel_message', message);
      }
    })(type);
    that.embedListeners_.push(listener);
    that.embed_.addEventListener(type, listener);
  }

  document.body.appendChild(this.embed_);
};

/**
 * Restarts the kernel
 */
colab.Kernel.prototype.restart_ = function() {
  this.kill_();
  this.start_();
};

/**
 * Restarts the kernel
 */
colab.Kernel.prototype.kill_ = function() {
  if (!this.embed_) {
    return;
  }

  for (var i = 0; i < this.embedListeners_.length; i++) {
    this.embed_.removeEventListener(this.embedListeners_[i]);
  }
  this.embed_.embedListeners_ = [];

  document.body.removeChild(this.embed_);

  this.embed_ = null;

  this.webview_.postMessage('kernel_message', {'type': 'crash'});
};

/**
 * Picks a directory and passes that to the kernel to mount
 */
colab.Kernel.prototype.pickFile_ = function() {
  var that = this;

  if (!this.embed_) {
    return;
  }

  chrome.fileSystem.chooseEntry({type: 'openDirectory'}, function(theEntry) {
    if (!theEntry) {
      return;
    }
    that.embed_.postMessage({'filesystem_name': theEntry.fullPath,
                             'filesystem_resource': theEntry.filesystem});
  });
}
