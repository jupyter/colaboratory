#!/usr/bin/env python

import os
import errno
import IPython.html
import shutil
import urllib

from jinja2 import Environment
from jinja2 import FileSystemLoader

from install_lib import COLAB_ROOT_PATH
from install_lib import pjoin
from install_lib import CopyTreeRecursively
from install_lib import MakeDirectoryIfNotExist
from install_lib import RemoveDirectoryIfExist
from install_lib import RemoveFileIfExist
from install_lib import RemoveFileOrDirectoryIfExist

def BundleStatic(colab_root, dest, extra_template_args=None):
  # Use the following default arguments for
  template_args = {
    'raw': '1',
    'app_mode': False
  }
  if extra_template_args is not None:
    template_args.update(extra_template_args)

  # prepare the destination directory
  MakeDirectoryIfNotExist(dest)

  for d in ['colab', 'extern', 'ipython', 'closure', 'welcome', 'notebook']:
    RemoveDirectoryIfExist(pjoin(dest, d))

  ipython_static = IPython.html.DEFAULT_STATIC_FILES_PATH
  colab_resources = pjoin(colab_root, 'colaboratory', 'resources')
  colab_static = pjoin(colab_root, 'static')
  closure = pjoin(colab_resources, 'closure-library', 'closure', 'goog')

  # TODO: run git submodule init && git submodule update in COLAB_ROOT_PATH

  # stage the basic colab and extern directories
  CopyTreeRecursively(pjoin(colab_resources, 'colab'), pjoin(dest, 'colab'))
  CopyTreeRecursively(pjoin(colab_resources, 'extern'), pjoin(dest, 'extern'))

  # stage IPython's static files, then clobber them with patched versions
  CopyTreeRecursively(ipython_static, pjoin(dest, 'ipython'))
  RemoveFileOrDirectoryIfExist(pjoin(dest, 'ipython', 'components', '.git'))
  CopyTreeRecursively(pjoin(colab_resources, 'ipython_patch'), pjoin(dest, 'ipython'))

  # stage closure from the submodule
  CopyTreeRecursively(closure, pjoin(dest, 'closure'))

  # instantiate templates and stage the /, /welcome/, and /notebook/ URLs
  template_path = os.path.join(colab_resources, "colab")
  env = Environment(loader=FileSystemLoader(template_path))

  CopyTreeRecursively(colab_static, pjoin(dest, 'static'))
  for name in ['welcome', 'notebook']:
    template = env.get_template(name + os.extsep + 'html');

    for d in [pjoin(dest, name, 'index' + os.extsep + 'html'), pjoin(dest, 'colab', name + os.extsep + 'html')]:
      path, filename = os.path.split(d)
      MakeDirectoryIfNotExist(path)
      with open(d, 'w') as f:
        f.write(template.render(template_args))


if __name__ == '__main__':
  import sys
  if len(sys.argv) < 2:
    dest = pjoin(COLAB_ROOT_PATH, 'build')
  else:
    dest = sys.argv[1]
  BundleStatic(COLAB_ROOT_PATH, dest)
