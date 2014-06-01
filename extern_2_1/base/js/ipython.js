/**
 * Interface for IPython library.  This is needed to be compatible with
 * both IPython 1.1 and IPython 2.1.  Note this file does not encapsulate
 * all JavaScript dependencies on IPython, only the ones that are
 * siginficantly different between IPython 1.1 and 2.1.
 *
 * This file contains the interface for IPython 2.1.  The install script
 * copies the correct version of this copy of this file to ipython.js in
 * the install directory.
 */

var IPythonInterface = {};

IPythonInterface.version = "2.1"

IPythonInterface.createCallbacks = function(reply, set_next_input,
                                            input, clear_output, output){
    return {
        'shell' : {
            'reply': reply,
            'payload': {'set_next_input': set_next_input}
        },
        'input' : input,
        'iopub' : {
            'clear_output': clear_output,
            'output': output
        }
    };
}

IPythonInterface.KERNEL_STARTED_EVENT = 'status_started.Kernel';

IPythonInterface.KERNEL_URL_KEY = 'kernel_service_url';
