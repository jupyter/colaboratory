#!/bin/bash
# Builds and installs the web app

# Build an IPython profile containing startup (Python) scripts, and
# static content for front end.
BUILD_DIR=build/profile_default

STATIC_CONTENT_DIR=$BUILD_DIR/static

echo [coLaboratory Install] Making build directories
mkdir -p $BUILD_DIR/
mkdir -p $STATIC_CONTENT_DIR/

# copy static files to build directory
echo [coLaboratory Install] Copying coLaboratory frontend 
cp -r static/* $STATIC_CONTENT_DIR/

# copy Google Closure library to build directory
echo [coLaboratory Install] Copying closure javascript
cp -r closure-library/closure/goog/* $STATIC_CONTENT_DIR/frontend/js/

# Create deps.js
echo [coLaboratory Install] Creating deps file
python closure-library/closure/bin/build/depswriter.py --root=closure-library/closure/goog --root=static/frontend/js/ > $STATIC_CONTENT_DIR/frontend/js/deps.js

# copy Google Closure css
echo [coLaboratory Install] Copying closure css
mkdir -p $STATIC_CONTENT_DIR/frontend/css
cp -r closure-library/closure/goog/css/* $STATIC_CONTENT_DIR/frontend/css/

# copy extern files into build directory
echo [coLaboratory Install] Copying external libraries
cp -r extern/* $STATIC_CONTENT_DIR/
