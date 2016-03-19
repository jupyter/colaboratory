/**
 *
 * @fileoverview Subclass of IPython.Kernel which uses a PNaCl based kernel.
 *
 * This only works when running inside a webview in the Chrome App.  The Chrome
 * App contains the code that creates the PNaCl kernel embed element, and
 * messages to the kernel are relayed via the Chrome App.  The postMessage
 * function is used to communicate with the Chrome App that contains the webview
 * that this code is running in.
 */
goog.provide('colab.PNaClKernel');

goog.require('colab.app');



/**
 * A subclass of IPython.Kernel that uses
 * @constructor
 * @extends {IPython.Kernel}
 */
colab.PNaClKernel = function() {
  goog.base(this, '');
};
goog.inherits(colab.PNaClKernel, IPython.Kernel);


/**
 * Starts the PNaCl IPython Kernel
 * @override
 */
colab.PNaClKernel.prototype.start = function() {
  var that = this;

  colab.app.postMessage('start_kernel');

  colab.app.addMessageListener('kernel_message', function(msgType, content) {
    that.handleMessage_(content);
  });

  // Create 'fake' shell channel that sends data using postmessage.
  /**
   * @param name Name of channel
   * @return {WebSocket} a fake websocket object
   */
  var create_channel = function(name) {
    return /** @type {websocket} */ ({
      'send': function(msg) {
        colab.app.postMessage('kernel_message', {
          'stream': name,
          'json': msg
        });
      }
    });
  };
  this.shell_channel = create_channel('shell');
  this.stdin_channel = create_channel('stdin');
};


/**
 * Kills the kernel
 * @override
 */
colab.PNaClKernel.prototype.kill = function() {
  colab.app.postMessage('kill_kernel');
};


/**
 * Restarts the kernel
 * @override
 */
colab.PNaClKernel.prototype.restart = function() {
  colab.app.postMessage('restart_kernel');
};


/**
 * Does nothing as shell channels are just custom objects
 * @override
 */
colab.PNaClKernel.prototype.stop_channels = function() {
  this.stdin_channel = null;
  this.shell_channel = null;
};


/**
 * Handles a message from the PNaCl kernel or parent App.
 *
 * @param {Object} message
 * @private
 */
colab.PNaClKernel.prototype.handleMessage_ = function(message) {
  var that = this;
  var tty_prefix = 'tty';

  if (message.type === 'message') {
    var data = message.data;
    if (typeof data == 'string' || data instanceof String) {
      console.log('nacl>' + data.substring(tty_prefix.length));
    } else if (data.stream == 'iopub') {
      that._handle_iopub_message({data: data.json});
    } else if (data.stream == 'shell') {
      that._handle_shell_reply({data: data.json});
    } else if (data.stream == 'stdin') {
      that._handle_input_request({data: data.json});
    }
  } else if (message.type === 'progress') {
    if (!that.running) {
      var progress = Math.round(100 * message.loaded / message.total);
      if (isNaN(progress)) { progress = 0; }
      $([IPython.events]).trigger('pnacl_loading.Kernel',
                                  {kernel: that, progress: progress});
    }
  } else if (message.type === 'loadend') {
    $([IPython.events]).trigger('pnacl_loadend.Kernel',
                                {kernel: that});
  } else if (message.type === 'crash') {
    that.running = false;
    $([IPython.events]).trigger('status_dead.Kernel', {kernel: that});
  }
};
