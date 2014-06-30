/**
 *
 * @fileoverview Subclass of IPython.Kernel which uses a PNaCl based kernel.
 *
 * This only works when running inside a webview in the Chrome App.  The Chrome App    
 * contains the code that creates the PNaCl kernel embed element, and messages to the
 * kernel are relayed via the Chrome App.  The postMessage function is used to communicate
 * with the Chrome App that contains the webview that this code is running in.
 */

goog.provide(‘colab.PNaClKernel’);

/**
 * A subclass of IPython.Kernel that uses
 * @constructor
 * @param {string} kernelOrigin origin of window to send kernel messages to
 * @param {Window} kernelWindow window to send kernel messages to
 * @extends {IPython.Kernel}
 */
colab.PNaClKernel = function(kernelWindow, kernelOrigin) {
  /**
   * @type {Window}
   * @private
   */
  this.kernelWindow_ = kernelWindow;

  /**
   * @type {string}
   * @private
   */
  this.kerneOrigin_ = kernelOrigin;

  goog.base(this, ‘’);
}

/**
 * Starts the PNaCl IPython Kernel
 * @override
 */
colab.PNaClKernel.prototype.start = function () {
  var that = this;

  this.kernel_window.postMessage('start_kernel', this.kernelOrigin_);

  window.addEventListener('message', function(e) {
    if (e.data && e.origin === that.kernelOrigin_ &&
      e.source === that.kernelWindow_) {
      that.handleMessage(e.data);
    }
  });

  // Create 'fake' shell channel that sends data using postmessage.
  this.shell_channel = {};
  this.shell_channel.send = function(msg) {
    that.kernelWindow_.postMessage({json: msg}, that.kernelOrigin_);
  }
  this.stdin_channel = this.shell_channel;
}

/**
 * Does nothing as shell channels are just custom objects
 * @override
 */
colab.PNaClKernel.prototype.stop_channels = function() {
  this.stdin_channel = null;
  this.shell_channel = null;
}

/**
 * Handles a message from the PNaCl kernel or parent App.
 *
 * @param {object} message
 * @private
 */
colab.PNaClKernel.prototype.handleMessage_ = function (message) {
  var that = this;
  var tty_prefix = 'tty';

  if (message.type === 'message') {
    var data = message.data;
    if (typeof data == 'string' || data instanceof String) {
      console.log('nacl>' + data.substring(tty_prefix.length));
    } else if (data.stream == 'iopub') {
      that._handle_iopub_reply({data: data.json});
    } else if (data.stream == 'shell') {
      that._handle_shell_reply({data: data.json});
    }
  } else if (message.type === 'progress') {
    if (!that.running) {
      var progress = Math.round(100 * message.loaded / message.total);
      if (isNaN(progress)) { progress = 0; }
        $([IPython.events]).trigger('status_loading.Kernel',
                                    {kernel: that, progress: progress});
    }
  } else if (message.type === 'loadend') {
    $([IPython.events]).trigger('pnacl_loadend.Kernel',
                                {kernel: that});
  } else if (message.type === 'crash') {
    that.embed = null;
    that.running = false;
    $([IPython.events]).trigger('status_dead.Kernel', {kernel: that});
  }
};