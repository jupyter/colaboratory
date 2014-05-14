# Copyright (c) 2014 Google Inc. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

"""A simple shell that uses the IPython messaging system."""

import json
import logging
import sys

import IPython
from IPython.core.interactiveshell import InteractiveShell, InteractiveShellABC
from IPython.utils.traitlets import Type, Dict, Instance
from IPython.core.displayhook import DisplayHook
from IPython.utils.jsonutil import json_clean, encode_images
from IPython.core.displaypub import DisplayPublisher
from IPython.config.configurable import Configurable

# module defined in shell.cc for communicating via pepper API
import ppmessage

def sendMessage(socket_name, msg_type, parent_header=None, content=None):
  if parent_header is None:
    parent_header = {}
  if content is None:
    content = {}
  msg = {
      'header': {'msg_type': msg_type},
      'parent_header': parent_header,
      'content': content
      }
  ppmessage._PostJSONMessage(socket_name, json.dumps(msg))

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
    sendMessage('iopub', 'stream', parent_header=self._parent_header,
                content={'name': self._stream_name, 'data': string})

  def writelines(self, sequence):
    for string in sequence:
      self.write(string)

# override sys.stdout and sys.stderr to broadcast on iopub
stdout_stream = MsgOutStream('stdout')
stderr_stream = MsgOutStream('stderr')
sys_stdout = sys.stdout
sys_stderr = sys.stderr
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
    sendMessage('iopub', 'pyout', parent_header=self.parent_header,
                content=self.content)
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
    sendMessage('iopub', 'display_data', content=json_clean(content),
                parent_header=self.parent_header)

  def clear_output(self, stdout=True, stderr=True, other=True):
    content = dict(stdout=stdout, stderr=stderr, other=other)

    if stdout:
      sys.stdout.write('\r')
    if stderr:
      sys.stderr.write('\r')

    self._flush_streams()
    sendMessage('iopub', 'clear_output', content=content,
                parent_header=self.parent_header)


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

execution_count = 1

shell = PepperKernel().shell

# Special message to indicate the NaCl kernel is ready.
sendMessage('iopub', 'status', content={'execution_state': 'nacl_ready'})

while 1:
  sendMessage('iopub', 'status', content={'execution_state': 'idle'})
  msg = json.loads(ppmessage._AcquireJSONMessageWait())
  sendMessage('iopub', 'status', content={'execution_state': 'busy'})

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
      sendMessage('iopub', 'pyerr', parent_header=request_header,
                  content={
                      'execution_count': execution_count,
                      'ename': type(ex).__name__,
                      'evalue': str(ex),
                      'traceback': []
                      }
                  )
    sendMessage('shell', 'execute_reply', parent_header=request_header,
                content=content)
  elif msg_type == 'complete_request':
    c = msg['content']
    try:
      cpos = int(c['cursor_pos'])
    except:
      cpos = len(c['text'])
      if cpos == 0:
        cpos = len(c['line'])
    txt, matches = shell.complete(c['text'], c['line'], cpos)
    sendMessage('shell', 'complete_reply',
                parent_header = request_header,
                content = {
                    'matches': matches,
                    'matched_text': txt,
                    'status': 'ok'
                    })
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
