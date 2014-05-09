#!/bin/bash
# Builds and installs the web app

# copy static files to build directory
cp -r static build/

# copy Google Closure library to build directory
cp -r ../closure-library/closure/goog/* build/static/frontend/js/

# Create deps.js
../closure-library/closure/bin/build/depswriter.py --root=../closure-library/closure/goog --root=static/frontend/js/ > build/static/frontend/js/deps.js

