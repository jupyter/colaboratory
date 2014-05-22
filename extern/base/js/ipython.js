/**
 * Interface for IPython library.  This is needed to be compatible with
 * both IPython 1.1 and IPython 2.0.  Note this file does not encapsulate
 * all JavaScript dependencies on IPython, only the ones that are
 * siginficantly different between IPython 1.1 and 2.0.
 *
 * This file contains the interface for IPython 1.1.  The install script
 * copies the correct version of this copy of this file to ipython.js in
 * the install directory.
 */

var IPythonInterface = {};

IPythonInterface.version = "1.1";

IPythonInterface.createCallbacks = function(reply, set_next_input,
                                            input, clear_output, output){
    return {
        'execute_reply': reply,
	'set_next_input': set_next_input,
	'input_request': input,
	'clear_output': clear_output,
	'output': output
    };
};

IPythonInterface.KERNEL_STARTED_EVENT = 'websocket_open.Kernel';

IPythonInterface.KERNEL_URL_KEY = 'base_url';
