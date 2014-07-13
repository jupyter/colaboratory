import argparse
import errno
import json
import os
import shutil
import sys

import IPython.html

from bundle_static import *

parser = argparse.ArgumentParser(description='Installs the Chrome App.')
parser.add_argument('--release',
                    default=False,
                    action='store_true',
                    help='Create release version')

args = parser.parse_args()

RELEASE_CLIENT_ID = "911569945122-0tcrnl8lnu5b0ccgpp92al27pplahn5a.apps.googleusercontent.com"

NACL_PEXE_FILE_URL = "http://yt-project.org/upload/kernel.pexe"
NACL_TAR_FILE_URL = "http://yt-project.org/upload/zeropy_20140520.tar.gz"



def InstallChrome(release, colab_root, dest):
  """Installs the Chrome App.

  args:
    release: Whether to produce release version.
    colab_root: root directory of colaboratory source
    dest: destination directory for build
  """
  
  # stage static files
  BundleStatic(colab_root, dest)

  # copy chrome app files, putting pnacl files in root
  # as the folder structure is hard coded into the pnacl kernel code
  # right now
  CopyTreeRecursively(pjoin(colab_root, 'chrome'), dest)
  CopyTreeRecursively(pjoin(colab_root, 'chrome', 'pnacl'), dest)

  # Download .pexe and .tar.gz files.  Later these will be pulled
  # from the naclports continuous builder
  pexe_file = pjoin(dest, 'pnacl', 'kernel.pexe')
  tar_file = pjoin(dest, 'zeropy_20140520.tar.gz')
  url_opener = urllib.URLopener()
  if not os.path.isfile(pexe_file):
    print 'Downloading ' + NACL_PEXE_FILE_URL
    url_opener.retrieve(NACL_PEXE_FILE_URL, pexe_file)
  if not os.path.isfile(tar_file):
    print 'Downloading ' + NACL_TAR_FILE_URL
    url_opener.retrieve(NACL_TAR_FILE_URL, tar_file)

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
