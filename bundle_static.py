import os
import errno
import IPython.html
import shutil
import urllib

COLAB_ROOT_PATH = os.path.dirname(os.path.realpath(__file__))

pjoin = os.path.join

def MakeDirectoryIfNotExist(path):
  try:
    os.makedirs(path)
  except OSError as exception:
    if exception.errno != errno.EEXIST:
      raise

def RemoveDirectoryIfExist(path):
  try:
    shutil.rmtree(path)
  except OSError as exception:
    if exception.errno != errno.ENOENT:
      raise

def CopyTreeRecursively(src, dest):
  """Roughly equivalent to cp -r src/* dest"""
  MakeDirectoryIfNotExist(dest)
  for entry in os.listdir(src):
    s = pjoin(src, entry)
    d = pjoin(dest, entry)
    if os.path.isdir(s):
      CopyTreeRecursively(s, d)
    else:
      shutil.copy(s, d)

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
  RemoveDirectoryIfExist(pjoin(dest, 'ipython', 'components', '.git'))
  CopyTreeRecursively(pjoin(colab_resources, 'ipython_patch'), pjoin(dest, 'ipython'))

  # stage closure from the submodule
  CopyTreeRecursively(closure, pjoin(dest, 'closure'))


if __name__ == '__main__':
  BundleStatic(COLAB_ROOT_PATH, pjoin(COLAB_ROOT_PATH, 'build'))

