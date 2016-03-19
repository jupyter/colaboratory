#!/usr/bin/env python

import os
import errno
import IPython.html
import shutil
import urllib

from install_lib import COLAB_ROOT_PATH
from install_lib import pjoin
from install_lib import CopyTreeRecursively
from install_lib import MakeDirectoryIfNotExist
from install_lib import RemoveDirectoryIfExist
from install_lib import RemoveFileIfExist
from install_lib import RemoveFileOrDirectoryIfExist

def BundleStatic(colab_root, dest):
  # prepare the destination directory
  MakeDirectoryIfNotExist(dest)

  for d in ['colab', 'extern', 'ipython', 'closure', 'welcome', 'notebook']:
    RemoveDirectoryIfExist(pjoin(dest, d))

  ipython_static = IPython.html.DEFAULT_STATIC_FILES_PATH
  colab_resources = pjoin(colab_root, 'colaboratory', 'resources')
  colab_static = pjoin(colab_root, 'static')
  closure = pjoin(colab_resources, 'closure-library', 'closure', 'goog')

  # TODO: run git submodule init && git submodule update in COLAB_ROOT_PATH

  # stage the /, /welcome/, and /notebook/ URLs
  CopyTreeRecursively(colab_static, pjoin(dest, 'static'))
  for name in ['welcome', 'notebook']:
    s = pjoin(colab_resources, 'colab', name + os.extsep + 'html');
    d = pjoin(dest, name, 'index' + os.extsep + 'html');
    MakeDirectoryIfNotExist(pjoin(dest, name))
    shutil.copy(s, d)

  # stage the basic colab and extern directories
  CopyTreeRecursively(pjoin(colab_resources, 'colab'), pjoin(dest, 'colab'))
  CopyTreeRecursively(pjoin(colab_resources, 'extern'), pjoin(dest, 'extern'))

  # stage IPython's static files, then clobber them with patched versions
  CopyTreeRecursively(ipython_static, pjoin(dest, 'ipython'))
  RemoveFileOrDirectoryIfExist(pjoin(dest, 'ipython', 'components', '.git'))
  CopyTreeRecursively(pjoin(colab_resources, 'ipython_patch'), pjoin(dest, 'ipython'))

  # stage closure from the submodule
  CopyTreeRecursively(closure, pjoin(dest, 'closure'))


if __name__ == '__main__':
  import sys
  if len(sys.argv) < 2:
    dest = pjoin(COLAB_ROOT_PATH, 'build')
  else:
    dest = sys.argv[1]
  BundleStatic(COLAB_ROOT_PATH, dest)
