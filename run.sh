#!/bin/bash
# Runs IPython notebook with custom profile
export FRONTENDMODULES=`pwd`/modules
export PYTHONPATH=$FRONTENDMODULES:$PYTHONPATH
export IPYTHONDIR=`pwd`/build

echo [coLaboratory Run Script] Running IPython Notebook with the following args $*
ipython notebook $*
