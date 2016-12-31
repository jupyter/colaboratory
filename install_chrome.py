import argparse
import errno
import json
import os
import pkgutil
import shutil
import subprocess
import sys
import urllib

import IPython.html

from bundle_static import BundleStatic
from install_lib import COLAB_ROOT_PATH
from install_lib import pjoin
from install_lib import CopyTreeRecursively
from install_lib import MakeDirectoryIfNotExist
from install_lib import RemoveDirectoryIfExist
from install_lib import RemoveFileIfExist
from install_lib import RemoveFileOrDirectoryIfExist

parser = argparse.ArgumentParser(description='Installs the Chrome App.')
parser.add_argument('--release',
                    default=False,
                    action='store_true',
                    help='Create release version')

args = parser.parse_args()

# Chrome App IDs for release and debug versions.
# These are used to determine allowed origins in JavaScript message passing
DEBUG_APP_ID = 'dmaaimdkehikanjidckkheggnaecfgbg'
RELEASE_APP_ID = 'pianggobfjcgeihlmfhfgkfalopndooo'

RELEASE_CLIENT_ID = "911569945122-0tcrnl8lnu5b0ccgpp92al27pplahn5a.apps.googleusercontent.com"

RELEASE = "20140805"
base_url = "http://yt-project.org/files/colaboratory/%s/" % RELEASE
NACL_PEXE_FILE_URL = base_url + "kernel.pexe"
NACL_TAR_FILE_URL = base_url + "pnacl_data.tar.gz"


def UpdateTarFile(tar_file, colabtools_src_dir, tmp_dir):
  """Updates the tar resources file.

  Untar/zip's the resources file, adds colabtools to the site-packages,
  and rezip/tar's the file.

  args:
    tar_file: the filename of the .tar.gz file
    colabtools_src_dir: source directory of colabtools (should end in /colabtools)
    tmp_dir: temporary directory to unzip tar file contents to.  Cleanup
        of this directory is the responsibility of the caller.
  """

  with open(os.devnull, 'w') as devnull:
    if subprocess.call(['tar', '-zxvf', tar_file, '-C', tmp_dir],
      stdout=devnull, stderr=devnull):
      raise RuntimeError('Failed to extract tar file')

  packages_dest_dir = pjoin(tmp_dir, 'lib', 'python2.7', 'site-packages');

  def InstallPackageToChromeApp(package_src, package_path):
    dest = pjoin(packages_dest_dir, package_path)
    RemoveFileOrDirectoryIfExist(dest)
    MakeDirectoryIfNotExist(dest)
    CopyTreeRecursively(package_src, dest)

  def PathForPackage(package_name):
    package = pkgutil.get_loader(package_name)
    return package.filename

  packages = [
    (colabtools_src_dir, 'colabtools'),
    (PathForPackage('httplib2'), 'httplib2'),
    (PathForPackage('apiclient'), 'apiclient'),
    (PathForPackage('oauth2client'), 'oauth2client')
  ]

  for package_src, package_path in packages:
    InstallPackageToChromeApp(package_src, package_path)

  # Overwrite original tar file
  with open(os.devnull, 'w') as devnull:
    if subprocess.call(['tar', '-zcvf', tar_file, '-C', tmp_dir, '.'],
      stdout=devnull, stderr=devnull):
      raise RuntimeError('Failed to update tar file')


def InstallChrome(release, colab_root, dest):
  """Installs the Chrome App.

  args:
    release: Whether to produce release version.
    colab_root: root directory of colaboratory source
    dest: destination directory for build
  """
  
  # stage static files
  app_id = DEBUG_APP_ID
  if release:
    app_id = RELEASE_APP_ID
  extra_template_args={
    'app_mode': True,
    'app_origin': 'chrome-extension://' + app_id
  }
  BundleStatic(colab_root, dest, extra_template_args=extra_template_args)

  # copy chrome app files, putting pnacl files in root
  # as the folder structure is hard coded into the pnacl kernel code
  # right now
  CopyTreeRecursively(pjoin(colab_root, 'chrome'), dest)
  CopyTreeRecursively(pjoin(colab_root, 'chrome', 'pnacl'), dest)

  # Download .pexe and .tar.gz files.  Later these will be pulled
  # from the naclports continuous builder
  pexe_file = pjoin(dest, 'pnacl', 'kernel.pexe')
  tar_file = pjoin(dest, 'pnacl_data.tar.gz')
  url_opener = urllib.URLopener()
  if not os.path.isfile(pexe_file):
    print 'Downloading ' + NACL_PEXE_FILE_URL
    url_opener.retrieve(NACL_PEXE_FILE_URL, pexe_file)
  if not os.path.isfile(tar_file):
    print 'Downloading ' + NACL_TAR_FILE_URL
    url_opener.retrieve(NACL_TAR_FILE_URL, tar_file)

  tmp_resources_dir = pjoin(dest, 'tmp_pnacl_resources')
  colabtools_src_dir = pjoin(colab_root, 'colabtools')
  MakeDirectoryIfNotExist(tmp_resources_dir)
  UpdateTarFile(tar_file, colabtools_src_dir, tmp_resources_dir)
  RemoveFileOrDirectoryIfExist(tmp_resources_dir)


  if release:
    # In release mode, we must change client IDS
    manfiest_file = pjoin(dest, 'manifest.json')
    manifest = {}
    with open(manfiest_file, 'r') as f:
      manifest = json.loads(f.read())

    # Delete "key" entry, because published app's don't
    # use private keys to determine to Chrome App ID.
    del manifest['key']

    # Change the Client ID to the release client ID
    manifest['oauth2']['client_id'] = RELEASE_CLIENT_ID

    # Pretty-print to same manifest file.
    with open(manfiest_file, 'w') as f:
      f.write(json.dumps(manifest, indent=2, separators=(',', ': ')))


if __name__ == '__main__':
  InstallChrome(args.release, COLAB_ROOT_PATH, pjoin(COLAB_ROOT_PATH, 'build_chrome'))
