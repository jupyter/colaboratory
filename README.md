# Experimental IPython Frontend
This project contains an experimental IPython front end, which
integrates Google Drive's realtime API, and also features in-browser
execution using Chrome's Native Client technology.  It also features
a number of other new experimental features.

## Setup
First create a directory to install this repo, e.g.
```
mkdir ~/experimental_frontend
cd ~/experimental_frontend
```

then clone this repo
```
git clone --recursive https://github.com/ipython/colaboratory
```

## Installing the Web App
Run
```
cd colaboratory
./install_v2.sh
```
to install the Web App (this creates an IPython profile which uses
IPython to serve the static web content for the new front end)

NOTE: both the install and run scripts
must be run from the colaboratory directory, e.g. running ```colaboratory/install_v2.sh```
will not work.

Start IPython notebook:
```
./run.sh
```
This launches IPython using the profile created in the install step.

Navigate to ```http://127.0.0.1:8888/static/frontend/welcome.html``` in
browser.

## Installing the Chrome App
Run
```
cd colaboratory
./install_chrome.sh
```
This creates an unpacked Chrome App, in the ```build_chrome/``` directory.

NOTE: this script must be run from the colaboratory directory, e.g. running ```colaboratory/install_chrome.sh```
will not work.

NOTE: The file ```pydata_pnacl.tar``` is too big for GitHub, and must be manually copied from
naclports to ```chrome/pnacl/```.

To install this app in Chrome, follow the instructions for installing an unpacked extension
(extensions are apps for these purposes), at https://developer.chrome.com/extensions/getstarted#unpacked.
The extension is located in ```colaboratory/build_chrome/```.
