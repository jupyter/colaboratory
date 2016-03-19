import subprocess
import sys

from install_lib import COLAB_ROOT_PATH
from install_lib import pjoin

RESOURCES_DIR = pjoin(COLAB_ROOT_PATH, 'colaboratory', 'resources')

CLOSURE_DIR = pjoin(RESOURCES_DIR, 'closure-library')

CALC_DEPS_FILE = pjoin(CLOSURE_DIR, 'closure', 'bin', 'calcdeps.py')

GOOG_ROOT = CLOSURE_DIR
COLAB_ROOT = pjoin(RESOURCES_DIR, 'colab')

OUTPUT_FILE = pjoin(COLAB_ROOT, 'js', 'colab.dep')

subprocess.call([
	'python',
	CALC_DEPS_FILE,
	'--dep',
	GOOG_ROOT,
	'--path',
	COLAB_ROOT,
	'--output_mode',
	'deps',
	'--output_file',
	OUTPUT_FILE])

subprocess.call([
	'sed',
	'-i', '',
	's/\.\.\/\.\.\/\.\./\.\./g',
	OUTPUT_FILE])

