import os
import errno
import IPython.html
import shutil

COLAB_ROOT_PATH = os.path.dirname(os.path.realpath(__file__))

def MakeDirectoryIfNotExist(path):
  try:
    os.makedirs(path)
  except OSError as exception:
    if exception.errno != errno.EEXIST:
      raise

def CopyTreeRecursively(src, dest):
  """Roughly equivalent to cp -r src/* dest"""
  MakeDirectoryIfNotExist(dest)
  for entry in os.listdir(src):
    s = os.path.join(src, entry)
    d = os.path.join(dest, entry)
    if os.path.isdir(s):
      CopyTreeRecursively(s, d)
    else:
      shutil.copy(s, d)

def BundleStatic(dest):
  # prepare the destination directory
  MakeDirectoryIfNotExist(dest)

  for d in ['colab', 'extern', 'ipython', 'closure', 'welcome', 'notebook']:
    try:
      shutil.rmtree(os.path.join(dest, d))
    except OSError as exception:
      if exception.errno != errno.ENOENT:
        raise

  ipython_static = IPython.html.DEFAULT_STATIC_FILES_PATH
  colab_resources = os.path.join(COLAB_ROOT_PATH, 'colaboratory', 'resources')
  colab_static = os.path.join(COLAB_ROOT_PATH, 'static')
  closure = os.path.join(colab_resources, 'closure-library', 'closure', 'goog')

  # TODO: run git submodule init && git submodule update in COLAB_ROOT_PATH

  # stage the /, /welcome/, and /notebook/ URLs
  CopyTreeRecursively(colab_static, os.path.join(dest, 'static'))

  for name in ['welcome', 'notebook']:
    s = os.path.join(colab_resources, 'colab', name + os.extsep + 'html');
    d = os.path.join(dest, name, 'index' + os.extsep + 'html');
    MakeDirectoryIfNotExist(os.path.join(dest, name))
    shutil.copy(s, d)

if __name__ == '__main__':
  BundleStatic(os.path.join(COLAB_ROOT_PATH, 'build'))
