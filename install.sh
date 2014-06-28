#!/bin/bash
# Builds and installs the web app

# Build an IPython profile containing startup (Python) scripts, and
# static content for front end.
STATIC_CONTENT_DIR=build/profile_default/static

# copy static files to build directory
echo [coLaboratory Install] Copying coLaboratory frontend
COLAB_HTML_DIR=$STATIC_CONTENT_DIR/v2
mkdir -p $COLAB_HTML_DIR
cp static/frontend/* $COLAB_HTML_DIR
mkdir $COLAB_HTML_DIR/img
cp static/frontend/img/* $COLAB_HTML_DIR/img

RAW_COLAB_CSS_DIR=$STATIC_CONTENT_DIR/v2/css
mkdir -p $RAW_COLAB_CSS_DIR
cp -r static/frontend/css/* $RAW_COLAB_CSS_DIR

RAW_COLAB_JS_DIR=$STATIC_CONTENT_DIR/v2/js/raw/colab
mkdir -p $RAW_COLAB_JS_DIR
cp -r static/frontend/js/* $RAW_COLAB_JS_DIR

# copy Google Closure library to build directory
echo [coLaboratory Install] Copying closure javascript
RAW_CLOSURE_JS_DIR=$STATIC_CONTENT_DIR/v2/js/raw/closure
mkdir -p $RAW_CLOSURE_JS_DIR/
cp -r closure-library/closure/goog/* $RAW_CLOSURE_JS_DIR

# Create deps.js
# NOTE right now we don't use the deps file, although it would be better to.
# we use colabdeps.js, which manually loads some dependencies.
#echo [coLaboratory Install] Creating deps file
#python closure-library/closure/bin/build/depswriter.py --root=closure-library/closure/goog --root=static/frontend/js/ > $STATIC_CONTENT_DIR/frontend/js/deps.js

# copy Google Closure css
echo [coLaboratory Install] Copying closure css
RAW_CLOSURE_CSS_DIR=$STATIC_CONTENT_DIR/v2/css/raw/closure
mkdir -p $RAW_CLOSURE_CSS_DIR
cp -r closure-library/closure/goog/css/* $RAW_CLOSURE_CSS_DIR

# copy extern files into build directory
echo [coLaboratory Install] Copying external libraries
cp -r extern/* $STATIC_CONTENT_DIR/

# patch IPython code
echo [coLaboratory Install] Patching IPython files
cp -r -f ipython_patch/* $STATIC_CONTENT_DIR/
