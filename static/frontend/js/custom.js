// Custom javascript

// Calls a function with given name, with a given
// JSON-able object as an argument, and calls callback with
// the result (also a JSON-able object).  Base-64
// might seem like overkill, but it is actually necessary
// because of IPython's use of repr().
var callKernelFunction = function(fname, arg, callback) {
  var direct_callback = function(msg) {
    var s = msg.user_expressions.result.data['text/plain'];
    callback(JSON.parse(atob(s.substr(1, s.length - 2))));
  };
  // Use lamda expression in order to avoid polluting user's namespace.
  // using buildin modules base64 and json without importing them into
  // the user's name spaces, reuquires the use of __import__
  var eval_function = '(lambda f, arg: __import__(\'base64\').b64encode(__import__(\'json\').dumps(f(arg))))'
  var expression = eval_function + '(' + fname + ',' + JSON.stringify(arg) + ')';
  
  colab.globalKernel.execute(
    '',
    {'execute_reply': direct_callback},
    {'user_expressions': {'result': expression}});
};
