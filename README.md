# Experimental IPython Frontend
This project contains an experimental IPython front end, which
integrates Google Drive's realtime API, and also features in-browser
execution using Chrome's Native Client technology.  It also features
a number of other new experimental features.

## Installation
First create a directory to install this repo, e.g.
```
mkdir ~/experimental_frontend
cd ~/experimental_frontend
```

then clone this repo
```
git clone -b v2 https://github.com/google/colaboratory
```

then clone the Google Closure library repo,
```
git clone https://code.google.com/p/closure-library/
```
 
Set build tools to executable
```
chmod +x closure-library/closure/bin/build/*
chmod +x colaboratory/*.sh
```

Install files in build directory.  If using virtualenv, you may need to set
the environment variable ```IPYTHON_PROFILE_PATH``` to point to the profile that will have
v2 installed in.  By default, this is ```~/.ipython/profile_default```.
```
cd colaboratory
./install
```

Start IPython notebook.
```
ipython notebook
```

TODO: fix startup page so it goes to welcome.

TODO: fix redirects if needed.

TODO: remmove all references to colab/colaboratory from codebase, including this file.