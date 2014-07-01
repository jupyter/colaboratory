#!/bin/bash
# Builds and installs the Chrome app

set -e

# make directory for Chrome app build
STATIC=build_chrome/static
rm -rf $STATIC

COLAB_RESOURCES=colaboratory/resources

mkdir -p $STATIC
cp -r $COLAB_RESOURCES/colab/ $STATIC/colab/
cp -r $COLAB_RESOURCES/extern/ $STATIC/extern/

IPYTHON_STATIC=`python -c 'import IPython.html; print(IPython.html.DEFAULT_STATIC_FILES_PATH)'`
cp -r $IPYTHON_STATIC/ $STATIC/ipython/
cp -r $COLAB_RESOURCES/ipython_patch/ $STATIC/ipython/
cp -r $COLAB_RESOURCES/closure-library/closure/goog/ $STATIC/closure/

# copy chrome app files, putting pnacl files in root
# as the folder structure is hard coded into the pnacl kernel code
# right now
cp chrome/* build_chrome
cp chrome/pnacl/* build_chrome