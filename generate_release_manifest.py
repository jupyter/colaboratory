"""Updates a manifest file for release mode"""

import json
import sys

RELEASE_CLIENT_ID = "911569945122-0tcrnl8lnu5b0ccgpp92al27pplahn5a.apps.googleusercontent.com"

manifest = {}
with open(sys.argv[1]) as f:
	manifest = json.loads(f.read())

# Delete "key" entry, because published app's don't
# use private keys to determine to Chrome App ID.
del manifest['key']

# Change the Client ID to the release client ID
manifest['oauth2']['client_id'] = RELEASE_CLIENT_ID

with open(sys.argv[1], 'w') as f:
	f.write(json.dumps(manifest, indent=2, separators=(',', ': ')))