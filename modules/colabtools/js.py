"""Wrapper for javascript.

Allows to call javascript from python as python
statements.

For example:

 import js

 js.JsGlobal.alert("hello world")
 js.JsGlobal.jQuery("#my-id").css("background", "green")
"""
import json
import uuid

from IPython import display

from colabtools import interactive_util

class JsException(Exception):
  pass

# just a unique object
VAR = object()

PERSISTENT = 0
EPHEMERAL = 1
DEFERRED = 2


def ValidJsIdentifier(x):
  """Returns True if x is valid javascript identifier."""
  # This is just an approximation
  if not x: return False
  nodash = x.replace('_', 'a')
  return nodash.isalnum() and nodash[0].isalpha()


class Js(object):
  """Base class to execute javascript as python functions.

  Basic usage is like this:

  JsGlobal = Js()

  # equivalent to alert("Hello World") on javascript console
  JsGlobal.alert("Hello world")

  JsGlobal.jQuery("#my-id").css("background", "green")
  # The result is Js() object, whose properties could be further accessed.
  # For example

  my_dom_el = JsGlobal.jQuery("#my-id")  # equivalent to my_dom_el = $("#my-id")
  my_dom_el.css("background", "black) # my_dom_el.css(...)

  # It could also be passed as parameter:
  JsGlobal.jQuery(my_dom_el)  # equivalent to $(my_dom_el), etc.

  # Also properties can be accessed normally:

  JsGlobal.console.log("hi") # equivalent to console.log("hi")
  JsGlobal.setTimeout(JsGlobal.alert, 3000) # setTimeout(alert, 3000)

  If the result of javascript computation is json-able function, one can access
  its value via a combination of PostValue() and GetValue(), though there
  is currently no way  to compute value synchronously. TODO(sandler): Fix.

  Potential other features currently missing:
     support for [.] operator and maybe "+" and "*". Blocking PostValue()
  """
  _context = None

  _keys_context = None

  def __init__(self, context=None, mode=PERSISTENT, js_src=None):
    """Constructor.

    Args:
      context: used internally for chaining
      mode: how to run javascript one of (PERSISTENT/EPHEMERAL/DEFERRED)
      js_src: used internally for chaining
    """
    self._keys_context = None
    self._context = context
    self._mode = mode
    self._js_src = [] if js_src is None else js_src
    self._run_js = GetRunJs(self, mode)

  def __repr__(self):
    return 'Js(%s)' % self._context

  def __call__(self, *args):
    """Sends args into into javascript call for this context.

    Args:
      *args: list of arguments to pass to a javascript function.
      if args == [VAR], instead creates a variable.

    Returns:
      A Js object that could be used in arguments or for
      further chaining.

    Raises:
      JsException:  if this object has no context
        (e.g. JsGlobal)
    """
    js = ''
    result = uuid.uuid1()
    if self._context is not None:
      context_js = self._JsContext()
    else:
      raise JsException('Can not call a function with empty context.')
    js = '%(result)s = %(js_repr)s;' % dict(
        result=self._JsContext(result),
        js_repr=self._JsRepr(context_js, args))
    self._run_js(js)
    return Js(result, mode=self._mode, js_src=self._js_src)

  def _join(self, context, name):
    if context: return context + '.' + name
    return name

  def __getattr__(self, name):
    """Returns a JS object pointing to context.name.

    The result could be used for chaining, as an argument
    or as a function.
    """
    # Don't try to evaluate special python functions.
    if name.startswith('__') and name.endswith('__'):
      raise AttributeError('%s not found' % name)
    return Js(self._join(self._JsContext(), name),
              mode=self._mode, js_src=self._js_src)

  def _JsContext(self, name=None):
    if name is None: name = self._context
    # Running in global context
    if name is None: return ''
    # Context is compound object
    if not isinstance(name, uuid.UUID): return name
    # Context is a global variable or artifitial uuid
    return 'window["%s"]' % name

  def GetScript(self):
    """Returns generated script for deferred mode"""
    return '\n'.join(self._js_src)

  def JsonRepr(self):
    """Returns JSON representation of itself."""
    return self._JsContext()

  def _JsRepr(self, name, args):
    if len(args) == 1 and args[0] == VAR: return name
    arg_json = json.dumps(args, cls=JsonEncoder)[1:-1]
    return '%s(%s)' %(name, arg_json)

  def LogValue(self):
    """Logs the value of this object on javascript console."""
    JsEphemeralGlobal.console(VAR).log(self)

  def PostValue(self):
    """Asynchronously posts value of this object, to python side.

    This value can later be retrieved using GetJsValue
    # TODO(sandler): This should allow for some waiting mechanisn.
    """
    py = 'js_cache["%s"]=' % (self._context)
    js = JsEphemeralGlobal.JSON(VAR).stringify(self)
    JsKernel.execute(JsEphemeralGlobal.addFunc(py, js))

  def GetJsValue(self):
    """Reads the value of this object if it was previously posted."""
    return js_cache.get(str(self._context), None)

  # pylint: disable=invalid-name
  def trait_names(self):
    """IPython expects this function, otherwise getattr() is called ."""
    return []

  # pylint: disable=invalid-name
  def _getAttributeNames(self):
    """Same as trait_names."""
    return self.__dir__()

  def __dir__(self):
    """Gets all properties of JS object.

    Currently is computed only once, so no live updates. Also computation
    is lazy so one needs to hit tab twice before getting the list.

    Returns:
      List of javascript properties defined for the current object.
    """
    rv = []
    if self._keys_context:
      for x in self._keys_context:
        rv.extend(js_cache.get(str(x), []))
      rv = [x for x in rv if ValidJsIdentifier(x)]

      # TODO(sandler) Should update the value instead of returning right away?
      return rv

    self._keys_context = []
    # First get properties defined in the object itself.
    # this works for modules and classes
    result = obj.getOwnPropertyNames(self)
    result.PostValue()
    # pylint: disable=protected-access
    self._keys_context.append(result._context)

    # Second get properties of the prototype.
    result = obj.getOwnPropertyNames(obj.getPrototypeOf(self))
    result.PostValue()
    # pylint: disable=protected-access
    self._keys_context.append(result._context)

    return rv


def InsertElement(tag, js_context=None):
  if not js_context:
    js_context = JsGlobal
  dom_id = 'id-%s' % uuid.uuid1()
  display.display(display.HTML('<%(tag)s id="%(id)s"></%(tag)s>'
                               % {'tag': tag, 'id': dom_id}))
  return js_context.jQuery('#' + dom_id)


def RunInContext(js, javascript_files, mode=PERSISTENT):
  """Loads javascript_files and then runs given javascript object.

  The javascript needs to be created in DEFERRED mode.

  Args:
    js: Js object
    javascript_files: list of urls for javascript
    mode: How to run this javascript.
  """
  if not js._js_src:
    print 'js is not deffered computation, it has already run!'
    return
  script = interactive_util.SequentiallyLoadJavascript(
      javascript_files, closure=js.GetScript())
  run_js = GetRunJs(None, mode)
  run_js(script)


class JsonEncoder(json.JSONEncoder):
  """Provides json enconding for Js objects."""

  def __init__(self, *args, **kwargs):
    json.JSONEncoder.__init__(self, *args, **kwargs)
    self._replacement_map = {}

  def default(self, o):
    if isinstance(o, Js):
      key = uuid.uuid4().hex
      self._replacement_map[key] = o.JsonRepr()
      return key
    else:
      return json.JSONEncoder.default(self, o)

  def encode(self, o):
    result = json.JSONEncoder.encode(self, o)
    for k, v in self._replacement_map.iteritems():
      result = result.replace('"%s"' % (k,), v)
    return result


def GetRunJs(me, mode):
  if mode == EPHEMERAL:
    return interactive_util.ExecuteJavascript
  elif mode == PERSISTENT:
    return interactive_util.PublishJavascript
  else:
    return lambda x: me._js_src.append(x)


json_encoder = JsonEncoder()
js_cache = {}


# Convenient constants
# Global context. (E.g. JsGlobal.console(VAR), accesses console
# Useful to publish javascript that produces visible output.
#
# pylint: disable=invalid-name
JsGlobal = Js()


# Ephemeral global, executing in this context will not result in
# javascript being published and hence won't persist between
# saves. Useful for real-time communication between frontend
# and backend.
# pylint: disable=invalid-name
JsEphemeralGlobal = Js(mode=EPHEMERAL)


# Other, often used variables
# pylint: disable=invalid-name
JsWindow = JsGlobal.window(VAR)


# Ipython specific, ephemeral for now, since those require interaction with
# kernel normally
# pylint: disable=invalid-name
JsIPython = JsEphemeralGlobal.IPython
JsNotebook = JsIPython.notebook
JsKernel = JsNotebook.kernel

# Javascript Object
obj = JsEphemeralGlobal.Object
