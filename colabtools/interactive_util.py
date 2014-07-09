"""Various utils for interactive widgets.
"""
import json
from IPython import display

BOOTSTRAP_JS = '/static/js/interactive_widgets.js'


# TODO(sandler): clean this code, Execute/Publish javascript should live
# in js module, and this should just contain higher level abstractions

def PublishHtml(x):
  display.display(display.HTML(x))


def PublishJavascript(x):
  """Publishes javascript that should persist between notebook saves."""
  PublishHtml("<script type='text/javascript'>%s</script>" % x)


class Javascript(display.Javascript):
  """ This class is equivalent to display.Javascript
     but allows to pass extra metadata to client side"""

  def WithMetadata(self, metadata):
    """Adds metadata to a given javascript object.

    Args:
      metadata: dictionary like object

    Returns:
      self for chaining.
    """
    if not hasattr(self, 'metadata'):
      self.metadata = {}
    self.metadata.update(metadata)
    return self

  def _repr_javascript_(self):
    """Augments standard javascript output with metadata."""
    result = super(Javascript, self)._repr_javascript_()
    if hasattr(self, 'metadata') and self.metadata:
      metadata = self.metadata
    else:
      metadata = {}
    orig_result = result
    if not isinstance(result, basestring):
      try:
        if len(result) > 1:
          metadata.update(result[1])
        result = result[0]
      except:
        pass  # do nothing

    if metadata:
      return result, metadata
    else:
      return orig_result


def ExecuteJavascript(x):
  """Executes javascript without affecting saved states.

  Use this for scripts that only makes sense execute when there is live
  kernel.

  Args:
     x: script to execute
  """
  display.display(Javascript(x).WithMetadata({'ephemeral': True}))


def _AllowInteractiveWidgets():
  """ When called re-enables interaction with python of interactive widgets.

  This is used, to decide if we should be trying to executing cells
  before user executed any cells. The main premise of this function
  is just to certify that python code is ready for execution, rather
  than do permission control.
  """
  # It is crucial to Execute rather than Publish, so we don't 'persist'
  # the state.
  ExecuteJavascript("""window.interactive_widgets_allowed = true; """)

_AllowInteractiveWidgets()


def GetObjectId(o):
  return object.__repr__(o).split()[3][1:-1]


class Listener(object):
  """Enables cells to 'listen' for updates.

   Example:
     cell[0]: listener = Listener()
     cell[1]: listener.register(); count += 1
     cell[2]: listener.register(); count += 1
     cell[3]: listener.update_all(); # will re-run cell 1 and 2
  """

  def __init__(self, persistent_id=''):
    """Constructor.

    Args:
      persistent_id: if provided, then listeners.registered() will receive
         notification even if the notebook is reloaded. Otherwise one needs
         to re-execute cells listener.register() every time the notebook is
         started.
    """
    _AllowInteractiveWidgets()
    if not persistent_id: persistent_id = GetObjectId(self)
    self.id = 'Lst' + persistent_id

  def register(self):
    """Registers current cell, to be re-executed upon call to update_all."""
    ExecuteJavascript('registerListener("%(id)s", executeCell);'
                      % {'id': self.id})

  def update_all(self):
    ExecuteJavascript('updateListener("%(id)s");' % {'id': self.id})


def SequentiallyLoadJavascript(files, selector='', closure=''):
  """Produces javascriprt to sequentially load all files.

  Example
     SequentiallyLoadJavascript(
        files=['jquery.js', 'jquery-deathstar.js'],
        selector='#msgid',
        closure='ActivateDeathStar()')

  Args:
     files: iterable of javascript urls. Will be loaded
     in the order they were received. If any file fails to load
     any consequent javascript will not execute (and neither will
     closure).
     selector: CSS selector for element to display "pending message".
     closure: will be run after all files have been loaded.

  Returns:
     the string with a valid javascript that accomplishes the loading.
  """

  # JSON produces valid javascript literals representing the array.
  selector_as_js_literal = json.dumps(selector)
  files_as_js_literal = json.dumps(files)

  # wrap closure in an anonymous function
  wrapped_closure = 'function(){%s}' % closure

  result = ('colab.util.sequentiallyLoadJavascript(%s, %s, %s)' %
            (files_as_js_literal, selector_as_js_literal, wrapped_closure))
  return result
