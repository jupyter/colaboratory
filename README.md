# CoLaboratory

This repo contains two related tools:

1. The CoLaboratory Chrome App.

2. CoLaboratory with Classic Jupyter Kernels.

Both of these create and store notebooks in Google Drive and allow for
collaborative editing of notebooks.  The difference is that the Chrome
App executes all code inside the Chrome browser using the
[PNaCl Sandbox](https://developer.chrome.com/native-client/nacl-and-pnacl)),
while coLaboratory Classic executes code via local Jupyter kernels
(such as the IPython kernel) that have complete access to the host
system and files.

## Setup
First clone this repo:
```
git clone --recursive https://github.com/ipython/colaboratory
```

## Installing CoLaboratory Classic Frontend for Local IPython Kernels
Run
```
cd colaboratory
pip install -r requirements.txt
```
to install the dependencies.

NOTE: This must be run from the colaboratory directory.

If you did not use the `--recursive` flag when cloning, you will get errors like:
```
[tornado.access] WARNING | 404 GET /static/closure/css/common.css
```
To fix this, run `git submodule init && git submodule update`.

Start IPython notebook:
```
python -m colaboratory
```
This launches the web application.

Navigate to ```http://127.0.0.1:8888/static/colab/welcome.html``` in your browser.

## Installing the CoLaboratory Chrome App
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

## Caveats/Requirements
### Chrome Browser Version
The Chrome App requires Chrome Beta (or Dev, Unstable or Canary), as it relies of bug fixes that are not available in the Stable channel yet.

### Loading Python Libraries
Currently there is no way to install new apps in the PNaCl kernel.

### The Collaboration Model
CoLaboratory's collaboration model is evolving. The current model is a single collaborative notebook with separate kernels. This can lead to a mismatch between a user's kernel state and the state of the notebook. 

To understand how a state mismatch can manifest, consider the scenario below. Bob and Sue are working on the same notebook at the same time. Both Bob and Sue will have their own kernel state. Bobs changes will change the notebook Sue sees, but Sue's state is unchanged. If sue tries to access the variable Bob created, she will get an error. 

![Collaboration Error](https://github.com/jupyter/colaboratory/raw/master/documentation/img/collaboration-error.png)
