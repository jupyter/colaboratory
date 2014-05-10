#!/bin/bash
# Runs IPython notebook with custom profile
export FRONTENDMODULES=`pwd`/modules
export PYTHONPATH=$FRONTENDMODULES:$PYTHONPATH
export IPYTHONDIR=`pwd`/build
ipython notebook