#!/usr/bin/env python

from __future__ import print_function
import os, sys
import io

# Test IPython installation
try:
    import IPython
except ImportError:
    print("IPython not installed, please install IPython 2.2 and continue")
    sys.exit(1)

# Make sure the version of IPython > 2.2
ver = IPython.version_info
if ver[0] != 2 and ver[1] < 2:
    print("IPython 2.2 or higher is required, %s is installed" % IPython.__version__)
    sys.exit(1)
else:
    print("IPython version %s detected, continuing..." % IPython.__version__)

# Get the profile name from the user
from IPython.core.profileapp import list_profiles_in
from IPython.utils.path import get_ipython_dir

ipdir = get_ipython_dir()
profile_name = raw_input("Enter the name of the IPython profile to be used (default=colab): ")
profile_name = u'colab' if not profile_name else profile_name
profile_subdir = u'profile_' + profile_name
profile_dir = os.path.join(ipdir, profile_subdir)

# Create the profile if it doesn't already exist
profiles = list_profiles_in(ipdir)
if not profile_name in profiles:
    print("Creating IPython profile: %s" % profile_name)
    os.system('ipython profile create %s' % profile_name)
else:
    print("Using existing IPython profile %s" % profile_dir)

# Configure the profile
config_adds = u"""
c.NotebookApp.allow_origin = '*'
c.NotebookApp.certfile = u'%s/security/localhost.pem'
c.NotebookApp.open_browser = False
"""

print("Configuring the IPython profile...")
with io.open(os.path.join(profile_dir, u'ipython_notebook_config.py'), 'r') as f:
    content = f.read()
if not content.endswith(config_adds % profile_dir):
    content = content + config_adds % profile_dir
    with io.open(os.path.join(profile_dir, u'ipython_notebook_config.py'),'w') as f:
        f.write(content)

# Create the SSL cert
print("Creating an SSL certificate in the profile...")
security_dir = os.path.join(profile_dir, u'security')
der_file = os.path.join(security_dir, u'localhost.der')
pem_file = os.path.join(security_dir, u'localhost.pem')
os.system('openssl req -x509 -nodes -days 365 -newkey rsa:1024 -keyout %s -out %s' % (pem_file, pem_file))
os.system('openssl x509 -outform der -in %s -out %s' % (pem_file, der_file))

# Install and trust the cert with the OS
print("Installing and trusting SSL certificate (sudo required)...")
os.system('sudo security add-trusted-cert -d -r trustRoot -k "/Library/Keychains/System.keychain" "%s"' % der_file)

print("Next steps...")
print("Run the command `ipython notebook --profile=%s`" % profile_name)
print("Visit colaboratory.jupyter.org and continue the instructions")


