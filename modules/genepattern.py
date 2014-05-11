import urllib2
import base64
import json
import time
from contextlib import closing

# API for GenePattern server.

# This API contains:
#
# * Classes that correspond to resources on the server (files and jobs) and
#   (for jobs) store locally a copy the state associated with these resources.
#
# * Functions for uploading a file, and running a job, that make calls to the
#   server, and return resources.
#
# * A class, JobSpec, that encapsulates the data that specifies a request to
#   run a job on a GenePattern server.

class ServerData(object):
    """Wrapper for data needed to make server calls.
    
    Wraps the server url, username and password, and provides helper function
    to construct the authorization header."""
    
    def __init__(self, url, username, password):
        self.url = url;
        self.username = username
        self.password = password
        authString = base64.encodestring('%s:%s' % (self.username, self.password))[:-1] 
        self.authHeader = "Basic %s" % authString
        
    def authorizationHeader(self):
        return self.authHeader


_server_data = None


def SetServerData(server_data):
    global _server_data
    _server_data = server_data


class GPResource(object):
    """Base class for resources on a Gene Pattern server.
    
    Wraps references to resources on a Gene Pattern server, which are all
    defined by a URI.  Subclasses can implement custom logic appropriate for
    that resources such as downloading a file or info for a running or completed
    job."""
    
    def __init__(self, uri):
        self.uri = uri
        
class GPFile(GPResource):
    """A file on a Gene Pattern server.
    
    Wraps the URI of the file, and contains methods to download the file."""
    
    # TODO: fix this.
    def open(self, serverData=None):
        if serverData is None:
            serverData = _server_data
        request = urllib2.Request(self.uri)
        request.add_header('Authorization', serverData.authorizationHeader())
        request.add_header('User-Agent', 'GenePatternRest')
        return urllib2.urlopen(request)
    
    def read(self, serverData=None):
        if serverData is None:
            serverData = _server_data
        data = None
        with closing(self.open(serverData)) as f:
            data = f.read()
        return data
    
class GPJob(GPResource):
    """A running or completed job on a Gene Pattern server.
    
    Contains methods to get the info of the job, and to wait on a running job by
    polling the server until the job is completed."""
    
    def getInfo(self, serverData=None):
        if serverData is None:
            serverData = _server_data
        request = urllib2.Request(self.uri)
        request.add_header('Authorization', serverData.authorizationHeader())
        request.add_header('User-Agent', 'GenePatternRest')
        response = urllib2.urlopen(request)
        self.info = json.loads(response.read())

    def isFinished(self, serverData=None):
        # Jobs never go from finished to running, so first check if
        # the local info says the job is done.  If not, check with the server.
        done = False
        try:
            if self.info['status']['isFinished']:
                done = True
        except AttributeError:
            pass

        if not done:
            self.getInfo(serverData)

        return self.info['status']['isFinished'] 
        
    def getOutputFiles(self):
        return [GPFile(f['link']['href']) for f in self.info['outputFiles']]
    
    def waitUntilDone(self, serverData=None):
        if serverData is None:
            serverData = _server_data
        wait = 1
        while True:
            time.sleep(wait)
            self.getInfo(serverData)
            if self.info['status']['isFinished']:
                break
	    # implements a crude exponential backoff
            wait = min(wait*2, 60)

class JobSpec(object):
    """Data needed to make a request to perform a job on a Gene Pattern server
    
    Encapsulates the data needed to make a server call to run a job.  This
    includes the LSID of the job, and the parameters.  Helper methods set
    the LSID and parameters."""
    
    def __init__(self):
        self.params = [];
    
    def setLSID(self, lsid):
        self.lsid = lsid
        
    def setParameter(self, name, values):
        if not isinstance(values, list):
            values = [values]
        self.params.append({'name': name, 'values': values})
        
class GPCategory(object):
    """Enapsulates element of task category list.

    """

    def __init__(self, dto):
        self.dto = dto

    def getDTO(self):
        return self.dto

    def getName(self):
        return self.dto['name']

    def getDescription(self):
        return self.dto['description']

    def getTags(self):
        return self.dto['tags']

class GPTaskListElement(object):
    """Encapsulates element of task list.
    
    Note that only the Lsid is guaranteed to be unique
    across all elements of the task list.
    
    """

    def __init__(self, dto):
        self.dto = dto

    def getDTO(self):
        return self.dto

    def getName(self):
        return self.dto['name']
    
    def getLSID(self):
        return self.dto['lsid']

    def getDescription(self):
        """ Returns task description.

        If task has no description, throws GenePatternException.
        """
        
        if (not self.dto.has_key('description')):
            raise GenePatternException('no task description')
        return self.dto['description']

    def getTags(self):
        return self.dto['tags']

    def getDocumentationPath(self):
        """ Returns path to task documentation on GPServer.

        In order to retrieve, will need to construct full URL and use GPFile class.
        Throws GenePatternException if no document.
        """

        if (not self.dto.has_key('documentation')):
            raise GenePatternException('no task documentation')
        return self.dto['documentation']

    def getVersion(self):
        """ Returns string representation of module version.
        """
        return self.dto['version']

    def getCategories(self):
        return self.dto['categories']

    def getSuites(self):
        return self.dto['suites']

class GPTask(GPResource):
    """Describes a GenePattern task (module or pipeline).

    The constructor retrieves data transfer object (DTO) describing task from GenePattern server.
    The DTO contains general task information (LSID, Category, Description, Version comment),
    a parameter list and a list of initial values.  Class includes getters for each of these
    components.

    """
    
    def __init__(self, lsid, serverData=None):
        if serverData is None:
            serverData = _server_data
        GPResource.__init__(self, lsid)
        request = urllib2.Request(serverData.url + 'rest/RunTask/load?lsid=' + lsid)
        request.add_header('Authorization', serverData.authorizationHeader())
        request.add_header('User-Agent', 'GenePatternRest')
        response = urllib2.urlopen(request)
        self.dto = json.loads(response.read())

    def getDTO(self):
        return self.dto

    def getLSID(self):
        return self.dto['module']['LSID']

    def getName(self):
        return self.dto['module']['name']

    # note that in v3.7.0 only support single category per task.
    # will introduce support for multiple catories per task in v3.8.0.
    # will need to introduce getCategories() for 3.8.0
    def getCategory(self):
        return self.dto['module']['taskType']

    def getDescription(self):
        """ Returns task description.

        If task has no description, throws GenePatternException.
        """
        
        if (not self.dto['module'].has_key('description')):
            raise GenePatternException('no task description')
        return self.dto['module']['description']

    def getVersionComment(self):
        return self.dto['module']['version']

    def getParameters(self):
        return self.dto['parameters']

    def getInitialValues(self):
        return self.dto['initialValues']

class GPTaskParameter(object):
    """Encapsulates single parameter information.

    The constructor's input parameter is the data transfer object
    associated with a single task parameter (i.e., element from list
    returned by GPTask.getParameters)
    """
    
    def __init__(self, dto):
        self.dto = dto
        
    def getDTO(self):
        return self.dto

    def getName(self):
        return self.dto['name']

    def isOptional(self):
        if ((self.dto.has_key('optional') and bool(self.dto['optional'].strip())) and
            (self.dto.has_key('minValue') and self.dto['minValue'] == 0)):
            return True
        else:
            return False

    def getDescription(self):
        return self.dto['description']

    def getType(self):
        """ returns either 'File' or 'String'.

        The type attribute (e.g., java.io.File, java.lang.Integer, java.lang.Float),
        which might give a hint as to what string should represent,
        is not enforced and not employed consistently across all tasks, so we ignore.

        """

        if (self.dto.has_key('TYPE') and self.dto.has_key('MODE')):
            TYPE = self.dto['TYPE']
            MODE = self.dto['MODE']
            if (TYPE == 'FILE' and MODE == 'IN'):
                return 'File'
        return 'String'

    def isPassword(self):
        """Indicates whether password flag associated with string parameter.

        If string parameter flagged as password, UI should not display
        parameter value on input field (e.g., mask out with asterisks).

        """

        if (self.dto.has_key('type') and self.dto['type'] == 'PASSWORD'):
            return True
        else:
            return False

    def allowMultiple(self):
        # note that maxValue means "max number of values", and is an integer, not a string
        if ((not self.dto.has_key('maxValue')) or
            (self.dto['maxValue'] > 1)):
            return True
        else:
            return False

    def getDefaultValue(self):
        if (self.dto.has_key('default_value') and
            bool(self.dto['default_value'].strip())):
            return self.dto['default_value']
        else:
            return None

    # returns boolean
    def isChoiceParameter(self):
        return self.dto.has_key('choiceInfo')

    # returns a message field, which indicates whether choices statically
    # or dynamically defined, and flag indicating whether a dynamic file
    # selection loading error occurred.
    def getChoiceStatus(self):
        if (not self.dto.has_key('choiceInfo')):
            raise GenePatternException('not a choice parameter')

        status = self.dto['choiceInfo']['status']
        return (status['message'], status['flag'])

    # the default selection from a choice menu
    def getChoiceSelectedValue(self):
        if (not self.dto.has_key('choiceInfo')):
            raise GenePatternException('not a choice parameter')
        return self.dto['choiceInfo']['selectedValue']

    def choiceAllowCustomValue(self):
        """Returns boolean indicating whether choice parameter supports custom value.

        If choice parameter supports custom value, user can provide parameter value
        other than those provided in choice list.
        """
        if (not self.dto.has_key('choiceInfo')):
            raise GenePatternException('not a choice parameter')
        return bool(BooleanString(self.dto['choiceInfo']['choiceAllowCustom']))

    def getChoices(self):
        """ returns a list of dictionary objects, one dictionary object per choice.

        Each object has two keys defined: 'value', 'label'.
        The 'label' entry is what should be displayed on the UI, the 'value' entry
        is what is written into JobSpec.

        """

        if (not self.dto.has_key('choiceInfo')):
            raise GenePatternException('not a choice parameter')
        return self.dto['choiceInfo']['choices']

    # only pipeline prompt-when-run parameters
    # can have alternate names and alternate descriptions
    def getAltName(self):
        if (self.dto.has_key('altName') and
            bool(self.dto['altName'].strip())):
            return self.dto['altName']
        else:
            return None

    def getAltDescription(self):
        if (self.dto.has_key('altDescription') and
            bool(self.dto['altDescription'].strip())):
            return self.dto['altDescription']
        else:
            return None

class GenePatternException(Exception):
    def __init__(self, value):
        self.value = value

    def __str__(self):
        return repr(self.value)

class BooleanString(str):
    def __nonzero__(self):
        return self.lower() in ('on', 'yes', 'true')
    

def uploadFile(filename, filepath, serverData=None):
    """Upload a file to a server
    
    Attempts to upload a local file with path filepath, to the server, where it
    will be named filename.
    
    Args:
        filename: The name that the uploaded file will be called on the server.
        filepath: The path of the local file to upload.
        serverData: ServerData object used to make the server call.
    
    Returns:
        A GPFile object that wraps the URI of the uploaded file, or None if the
        upload fails.
    """
    if serverData is None:
        serverData = _server_data
    request = urllib2.Request(serverData.url + 'rest/v1/data/upload/job_input?name=' + filename)
    request.add_header('Authorization', serverData.authorizationHeader())
    request.add_header('User-Agent', 'GenePatternRest')
    data = open(filepath, 'rb').read()
        
    try:
        response = urllib2.urlopen(request, data)
    except IOError, e:
        print "authentication failed"
        return None

    if response.getcode() != 201:
        print "file upload failed, status code = %i" % response.getcode()
        return None
            
    return GPFile(response.info().getheader('Location'))

def runJob(jobspec, serverData=None, waitUntilDone=True):
    """Runs a job defined by jobspec, optionally non-blocking.
    
    Takes a JobSpec object that defines a request to run a job, and makes the
    request to the server.  By default blocks until the job is finished by
    polling the server, but can also run asynchronously.
    
    Args:
        jobspec: A JobSpec object that contains the data defining the job to be
            run.
        serverData: ServerData object used to make the server call.
        waitUntilDone: Whether to wait until the job is finished before
            returning.
    
    Returns:
        a GPJob object that refers to the running job on the server.  If called
        synchronously, this object will contain the info associated with the
        completed job.  Otherwise, it will just wrap the URI of the running job.
    """
    
    if serverData is None:
        serverData = _server_data
    # names should be a list of names,
    # values should be a list of **lists** of values
    jsonString = json.dumps({'lsid': jobspec.lsid, 'params': jobspec.params})
    request = urllib2.Request(serverData.url + 'rest/v1/jobs')
    request.add_header('Authorization', serverData.authorizationHeader())
    request.add_header('Content-Type', 'application/json')
    request.add_header('User-Agent', 'GenePatternRest')
    response = urllib2.urlopen(request, jsonString)
    if response.getcode() != 201:
        print " job POST failed, status code = %i" % response.getcode()
        return None
    job = GPJob(response.info().getheader('Location'))
    if waitUntilDone:
        job.waitUntilDone(serverData)
    return job

def getTaskListOld(serverData=_server_data):

    """Get list of tasks (modules and pipelines) installed on GenePattern server.

    Args:
        serverData: ServerData object used to make the server call.

    Returns:
        A list of dictionary objects, one per task
    """
    f = open('all.json', 'r')
    taskList = json.loads(f.read())
    f.close()
    return taskList

def getTaskList(serverData=None):
    if serverData is None:
       serverData = _server_data

    request = urllib2.Request(serverData.url + 'rest/v1/tasks/all.json')
    request.add_header('Authorization', serverData.authorizationHeader())
    request.add_header('User-Agent', 'GenePatternRest')
    response = urllib2.urlopen(request)
    categoryAndTaskLists = json.loads(response.read())
    return categoryAndTaskLists['all_modules']
        
    
