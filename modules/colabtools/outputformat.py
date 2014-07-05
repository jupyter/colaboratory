"""Utility functions to change the way output is displayed.

This module exposes helper functions and magic functions that allow
to tweak the way output is formatted. For example, it allows to set
word wrapping, hide outputs of print statements, etc.

Example usage:

// Turns on word wrapping

%word_wrap on

// limits the height of the cell
%output_height 100
...
"""
# pylint: disable=unused-import
from colabtools import js
from IPython import get_ipython
from IPython.core.magic import register_line_magic


def parse_bool(b):
  """Parsers string boolean into boolean."""
  if not b: return False
  if b.lower() in ('false', 'off', 'no', '0'): return False
  return True


@register_line_magic
def word_wrap(line):
  """Sets wrapping for the output.

  Example usage:

     %word_wrap on

  Args:
    line: str, contains true/false or on/off or 1/0
  """
  w = parse_bool(line)
  js.JsGlobal.colab.output.setWordWrap(w)


# pylint unused-argument=disable


@register_line_magic
def output_height(line):
  """Sets the height of the output.

  Note, calling this function will prevent outputs from ever automatically
  resized. Example usage:
  %output_height 200

  Args:
    line: str
  """
  js.JsGlobal.colab.output.setOutputHeight(line)


@register_line_magic
def hide_all_output(unused_line):
  """Hides all output for this cell."""
  output_height(0)


@register_line_magic
def hide_result(unused_line):
  """Hides results of this cell computation (keeps print statements etc)."""
  js.JsGlobal.colab.output.setOutputVisibility('pyout', False)


@register_line_magic
def hide_display_data(unused_line):
  """Hides display results, e.g. any rich data, such as plots."""
  js.JsGlobal.colab.output.setOutputVisibility('display_data', False)


@register_line_magic
def hide_stream(unused_line):
  """Hides the streaming output in this cell (e.g. print statements)."""
  js.JsGlobal.colab.output.setOutputVisibility('stream', False)


@register_line_magic
def hide_pyerr(unused_line):
  """Hides error output (e.g. errors raised)."""
  js.JsGlobal.colab.output.setOutputVisibility('pyerr', False)
