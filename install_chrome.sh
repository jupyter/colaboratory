#!/bin/bash
# Builds and installs the Chrome app

# build the web app, to get static files
./install.sh

# make directory for Chrome app build
mkdir -p build_chrome

# copy static web content
cp -r build/profile_default/static build_chrome

# copy chrome app files, putting pnacl files in root
# as the folder structure is hard coded into the pnacl kernel code
# right now
cp chrome/* build_chrome
cp chrome/pnacl/* build_chrome