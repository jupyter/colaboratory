# Copyright (c) 2014 Google Inc. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""A simple shell that uses the IPython messaging system."""

# Override platform information.
import platform
platform.system = lambda: "pnacl"
platform.release = lambda: "chrome"

import time
import json
import logging
import sys
import Queue
import thread

stdin_input = Queue.Queue()
shell_input = Queue.Queue()
stdin_output = Queue.Queue()
shell_output = Queue.Queue()
iopub_output = Queue.Queue()

sys_stdout = sys.stdout
sys_stderr = sys.stderr

def emit(s):
    print >> sys_stderr, "EMITTING: %s" % (s)
    time.sleep(1)

import IPython
from IPython.core.interactiveshell import InteractiveShell, InteractiveShellABC
from IPython.utils.traitlets import Type, Dict, Instance
from IPython.core.displayhook import DisplayHook
from IPython.utils import py3compat
from IPython.utils.py3compat import builtin_mod
from IPython.utils.jsonutil import json_clean, encode_images
from IPython.core.displaypub import DisplayPublisher
from IPython.config.configurable import Configurable

# module defined in shell.cc for communicating via pepper API
from pyppapi import nacl_instance

def CreateMessage(msg_type, parent_header=None, content=None):
  if parent_header is None:
    parent_header = {}
  if content is None:
    content = {}
  return {
      'header': {'msg_type': msg_type},
      'parent_header': parent_header,
      'content': content,
      'msg_type': msg_type,
  }

class MsgOutStream(object):
  """Class to overrides stderr and stdout."""

  def __init__(self, stream_name):
    self._stream_name = stream_name
    self._parent_header = {}

  def SetParentHeader(self, parent_header):
    self._parent_header = parent_header

  def close(self):
    pass

  def flush(self):
    pass

  def write(self, string):
    iopub_output.put(CreateMessage('stream', parent_header=self._parent_header,
                content={'name': self._stream_name, 'data': string}))

  def writelines(self, sequence):
    for string in sequence:
      self.write(string)

# override sys.stdout and sys.stderr to broadcast on iopub
stdout_stream = MsgOutStream('stdout')
stderr_stream = MsgOutStream('stderr')
sys.stdout = stdout_stream
sys.stderr = stderr_stream


class PepperShellDisplayHook(DisplayHook):
  parent_header = Dict({})

  def set_parent_header(self, parent_header):
    """Set the parent for outbound messages."""
    self.parent_header = parent_header

  def start_displayhook(self):
    self.content = {}

  def write_output_prompt(self):
    self.content['execution_count'] = self.prompt_count

  def write_format_data(self, format_dict, md_dict=None):
    self.content['data'] = encode_images(format_dict)
    self.content['metadata'] = md_dict

  def finish_displayhook(self):
    sys.stdout.flush()
    sys.stderr.flush()
    iopub_output.put(CreateMessage('pyout', parent_header=self.parent_header,
                content=self.content))
    self.content = None


class PepperDisplayPublisher(DisplayPublisher):
  parent_header = Dict({})

  def set_parent_header(self, parent_header):
    self.parent_header = parent_header

  def _flush_streams(self):
    """flush IO Streams prior to display"""
    sys.stdout.flush()
    sys.stderr.flush()

  def publish(self, source, data, metadata=None):
    self._flush_streams()
    if metadata is None:
      metadata = {}
    self._validate_data(source, data, metadata)
    content = {}
    content['source'] = source
    content['data'] = encode_images(data)
    content['metadata'] = metadata
    iopub_output.put(CreateMessage('display_data', content=json_clean(content),
                parent_header=self.parent_header))

  def clear_output(self, stdout=True, stderr=True, other=True):
    content = dict(stdout=stdout, stderr=stderr, other=other)

    if stdout:
      sys.stdout.write('\r')
    if stderr:
      sys.stderr.write('\r')

    self._flush_streams()
    iopub_output.put(CreateMessage('clear_output', content=content,
                parent_header=self.parent_header))


class PepperInteractiveShell(InteractiveShell):
    """A subclass of InteractiveShell for the Pepper Messagin API."""
    displayhook_class = Type(PepperShellDisplayHook)
    display_pub_class = Type(PepperDisplayPublisher)
    @staticmethod
    def enable_gui(gui):
        pass


InteractiveShellABC.register(PepperInteractiveShell)

class PepperKernel(Configurable):
    shell = Instance('IPython.core.interactiveshell.InteractiveShellABC')
    shell_class = Type(PepperInteractiveShell)

    def __init__(self):
        self.shell = self.shell_class.instance(parent=self)
        self.shell.run_cell("""
import os
matplotlib_config_dir = '/mplconfigdir'
os.environ['XDG_CONFIG_HOME'] = matplotlib_config_dir
os.environ['TMP'] = ''
import matplotlib
import matplotlib.cbook
""")

shell = PepperKernel().shell

# Taken from IPython 2.x branch, IPython/kernel/zmq/ipykernel.py
def _complete(msg):
  c = msg['content']
  try:
    cpos = int(c['cursor_pos'])
  except:
    # If we don't get something that we can convert to an integer, at
    # least attempt the completion guessing the cursor is at the end of
    # the text, if there's any, and otherwise of the line
    cpos = len(c['text'])
    if cpos==0:
      cpos = len(c['line'])
  return shell.complete(c['text'], c['line'], cpos)

# Special message to indicate the NaCl kernel is ready.
iopub_output.put(CreateMessage('status', content={'execution_state': 'nacl_ready'}))


def _no_raw_input(self):
  """Raise StdinNotImplentedError if active frontend doesn't support
  stdin."""
  raise StdinNotImplementedError("raw_input was called, but this "
                                 "frontend does not support stdin.")

def _raw_input(prompt, parent_header):
    # Flush output before making the request.
    sys.stderr.flush()
    sys.stdout.flush()
    # flush the stdin socket, to purge stale replies
    while True:
        try:
            stdin_input.get_nowait()
        except Queue.Empty:
            break

    # Send the input request.
    content = json_clean(dict(prompt=prompt))
    stdin_output.put(CreateMessage('input_request', content=content,
      parent_header=parent_header))

    # Await a response.
    while True:
        try:
            reply = stdin_input.get()
        except Exception:
            print "Invalid Message"
        except KeyboardInterrupt:
            # re-raise KeyboardInterrupt, to truncate traceback
            raise KeyboardInterrupt
        else:
            break
    try:
        value = py3compat.unicode_to_str(reply['content']['value'])
    except:
        print "Got bad raw_input reply: "
        print reply
        value = ''
    if value == '\x04':
        # EOF
        raise EOFError
    return value

def main_loop():
  execution_count = 1
  while 1:
    iopub_output.put(CreateMessage('status', content={'execution_state': 'idle'}))
    msg = shell_input.get()
    iopub_output.put(CreateMessage('status', content={'execution_state': 'busy'}))

    if not 'header' in msg:
      continue
    request_header = msg['header']
    if not 'msg_type' in request_header:
      continue
    msg_type = request_header['msg_type']
    if msg_type == 'execute_request':
      try:
        content = msg[u'content']
        code = content[u'code']
        silent = content[u'silent']
        store_history = content.get(u'store_history', not silent)
      except:
        self.log.error("Got bad msg: ")
        self.log.error("%s", msg)
        continue

      # Replace raw_input. Note that is not sufficient to replace
      # raw_input in the user namespace.
      if content.get('allow_stdin', False):
        raw_input = lambda prompt='': _raw_input(prompt, request_header)
        input = lambda prompt='': eval(raw_input(prompt))
      else:
        raw_input = input = lambda prompt='' : _no_raw_input()

      if py3compat.PY3:
        _sys_raw_input = builtin_mod.input
        builtin_mod.input = raw_input
      else:
        _sys_raw_input = builtin_mod.raw_input
        _sys_eval_input = builtin_mod.input
        builtin_mod.raw_input = raw_input
        builtin_mod.input = input

      # Let output streams know which message the output is for
      stdout_stream.SetParentHeader(request_header)
      stderr_stream.SetParentHeader(request_header)
      shell.displayhook.set_parent_header(request_header)
      shell.display_pub.set_parent_header(request_header)

      status = 'ok'
      content = {}
      try:
        shell.run_cell(msg['content']['code'],
                       store_history=store_history,
                       silent=silent)
      except Exception, ex:
        status = 'error'
        logging.exception('Exception occured while running cell')
      finally:
        # Restore raw_input.
        if py3compat.PY3:
          builtin_mod.input = _sys_raw_input
        else:
          builtin_mod.raw_input = _sys_raw_input
          builtin_mod.input = _sys_eval_input

      content = {'status': status,
               'execution_count': execution_count}

      if status == 'ok':
        content['payload'] = []
        content['user_variables'] = {}
        content['user_expressions'] = {}
      elif status == 'error':
        content['ename'] = type(ex).__name__
        content['evalue'] = str(ex)
        content['traceback'] = []

      execution_count += 1
      if status == 'error':
        iopub_output.put(CreateMessage('pyerr', parent_header=request_header,
                    content={
                        'execution_count': execution_count,
                        'ename': type(ex).__name__,
                        'evalue': str(ex),
                        'traceback': []
                        }
                    ))
      shell_output.put(CreateMessage('execute_reply', parent_header=request_header,
                  content=content))
    elif msg_type == 'complete_request':
      # Taken from IPython 2.x branch, IPython/kernel/zmq/ipykernel.py
      txt, matches = _complete(msg)
      matches = {'matches' : matches,
                 'matched_text' : txt,
                 'status' : 'ok'}
      matches = json_clean(matches)
      shell_output.put(CreateMessage('complete_reply',
                  parent_header = request_header,
                  content = matches))
    elif msg_type == 'object_info_request':
      # Taken from IPython 2.x branch, IPython/kernel/zmq/ipykernel.py
      content = msg['content']
      object_info = shell.object_inspect(content['oname'],
                      detail_level = content.get('detail_level', 0))
      # Before we send this object over, we scrub it for JSON usage
      oinfo = json_clean(object_info)
      shell_output.put(CreateMessage('object_info_reply',
                  parent_header = request_header,
                  content = oinfo))
    elif msg_type == 'restart':
      # break out of this loop, ending this program.
      # The main event loop in shell.cc will then
      # run this program again.
      break
    elif msg_type == 'kill':
      # Raise an exception so that the function
      # running this script will return -1, resulting
      # in no restart of this script.
      raise RuntimeError

thread.start_new_thread(main_loop, ())

def deal_message(msg):
  channel = msg['stream']
  content = json.loads(msg['json'])

  queues = {'shell': shell_input, 'stdin': stdin_input}
  queue = queues[channel]

  queue.put(content)

def send_message(stream, msg):
  nacl_instance.send_raw_object({
    'stream': stream,
    'json': json.dumps(msg)
  })

while 1:
  msg = nacl_instance.wait_for_message(timeout=1, sleeptime=10000)
  try:
    deal_message(msg)
  except:
    pass

  output_streams = [
    (stdin_output, 'stdin'),
    (shell_output, 'shell'),
    (iopub_output, 'iopub')
  ]
  for msg_queue, stream in output_streams:
    msg = None
    try:
      msg = msg_queue.get_nowait()
      send_message(stream, msg)
    except Queue.Empty:
      pass
