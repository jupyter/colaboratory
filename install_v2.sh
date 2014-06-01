#!/bin/bash
# Builds and installs the web app for IPython 2.0

./install.sh

BUILD_DIR=build/profile_default
STATIC_CONTENT_DIR=$BUILD_DIR/static

# copy IPython 2.0 override files
cp -r extern_2_1/* $STATIC_CONTENT_DIR/

