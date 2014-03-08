# Colaboratory Notebook

The Colaboratory Notebook is a packaging of the IPython Notebook, which adds in-browser execution using Chromes PNaCl platform, and a new front end which is integraged with Google Drive's realtime API, allowing for real time collaboration.

It is designed for ease of use and one-click installation.  Users can create a notebook, run code using the pre-installed IPython Kernel, which comes with Scientific Python libraries, and share this notebook with collaborators on Google Drive.

The Colaboratory Notebook is an open source project, and originated from the combination of the ZeroPy project of Matthew Turk, and the Colaboratory team at Google.

## Architecture

The Colaboratory Notebook is a Chrome Packaged App (CPA) that uses the Google Drive APIs for file management, and PNaCl to run a port of the IPython kernel inside the app window.  There is no need to install and run a separate kernel, although this is possible.

For technical reasons, the app does not contain the front-end UI JavaScript/HTML, but instead wraps these in a webview container.  Communication with the webview is done using postMessage.

## Development

During development, the developer should run a local server to serve the contents of the webview on localhost.  We provide a python script to serve at 127.0.0.1:8000.
```Shell
server/serve.py
```

To install the extension during development, go to the Chrome Extensions manager, enable developer mode, and click "Load Unpacked Extension".  Then select the directory "app".

To use the app, launch a window to install the App on Google Drive.  Then open files from drive, and save them from inside the app.  You may also need to go to "Manage Apps" and select "Use by Default" for the Colaboratory App.
