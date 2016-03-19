import errno
import os
import shutil

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

def RemoveFileIfExist(path):
  try:
    os.remove(path)
  except OSError as exception:
    if exception.errno != errno.ENOENT:
      raise

def RemoveFileOrDirectoryIfExist(path):
  try:
    RemoveDirectoryIfExist(path)
  except OSError as exception:
    if exception.errno == errno.ENOTDIR:
      RemoveFileIfExist(path)
    else:
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
