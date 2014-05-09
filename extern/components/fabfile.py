"""fabfile to prepare IPython notebook dependencies

via bower and bower-like process for non-bowerables
"""

import glob
import json
import os
import tempfile
import urllib2
import shutil

from io import BytesIO
from tarfile import TarFile
from zipfile import ZipFile

from fabric.api import local,lcd
from fabric.utils import abort

pjoin = os.path.join

here = os.path.dirname(__file__)

components_dir = here

def clean():
    for cfgfile in ("bower.json", "nonbower.json"):
        with open(cfgfile) as f:
            cfg = json.load(f)
        
        for name in cfg.get('dependencies', {}).keys():
            d = pjoin(components_dir, name)
            if os.path.exists(d):
                print("removing %s" % d)
                shutil.rmtree(d)

def dependencies():
    local("npm install -g bower")

def bower():
    """install components with bower"""
    with lcd(here):
        local('bower install')

def nonbower():
    if not os.path.exists(components_dir):
        components()
    
    with open("nonbower.json") as f:
        cfg = json.load(f)
    for name, repo in cfg.get('dependencies', {}).items():
        
        clone = "git clone"
        if '#' in repo:
            repo, tag = repo.split('#')
        else:
            tag = None
            clone += " --depth 1"
        
        with lcd(components_dir):
            
            local("{clone} {repo} {name}".format(**locals()))
            
            if tag:
                with lcd(pjoin(components_dir, name)):
                    local("git checkout -b {0} tags/{0}".format(tag))
        
        # remove the git tree, so we don't get submodules
        shutil.rmtree(pjoin(components_dir, name, '.git'))

def postprocess():
    with lcd(pjoin(components_dir, "bootstrap")):
        local("npm install")
        local("make bootstrap-css")
        local("make bootstrap-js")
    
    # add bootsrap packages to the PATH
    # (less.js needs uglify, which bootstrap just installed above)
    bins = glob.glob(pjoin(components_dir, "bootstrap", "node_modules", "*", "bin"))
    os.environ['PATH'] = os.pathsep.join(bins + [os.environ['PATH']])
    
    # build less
    shutil.rmtree(pjoin(components_dir, "less.js", "dist"))
    with lcd(pjoin(components_dir, "less.js")):
        local("make min")
    
    # build highlight.js
    with lcd(pjoin(components_dir, "highlight.js")):
        local("python tools/build.py")
    
    for toignore in glob.glob(pjoin(here, "*", ".gitignore")):
        os.unlink(toignore)

def update():
    clean()
    bower()
    nonbower()
    postprocess()
