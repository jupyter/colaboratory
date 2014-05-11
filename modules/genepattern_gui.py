from json import dumps
from base64 import b64encode

from genepattern import *

def GetModuleList(_):
    from collections import defaultdict
    tasklist = getTaskList()
    moduleList = defaultdict(list)
    for t in tasklist:
        name = t['name']
        lsid = t['lsid']
        for category in t['categories']:
            moduleList[category].append((name, lsid))
    return moduleList
    
def GetModuleCellCode(lsid):
    # TODO: remove this once working lsid's are given by GetModuleList
    #lsid = 'urn:lsid:broad.mit.edu:cancer.software.genepattern.module.analysis:00072'
    code = ''
    try:
        task = GPTask(lsid)
        params = task.getParameters()
        form_code = ''
        execution_code = ''
        execution_code += 'job_spec = JobSpec()\n'
        execution_code += 'job_spec.setLSID(%s)\n' % json.dumps(lsid)
        for param in params:
            param_name = param['name']
            variable_name = param_name.replace('.', '_')
            variable_value = param['default_value']
            form_code += '%s = %s # @param\n' % (variable_name, json.dumps(variable_value))
            execution_code += 'job_spec.setParameter(%s, %s)\n' % (json.dumps(param_name), variable_name)
        execution_code += 'job = runJob(job_spec)'
        code = form_code + execution_code
    except:
        code = '# Error in function GetModuleCellCode() for LSID %s' % lsid
    return code
