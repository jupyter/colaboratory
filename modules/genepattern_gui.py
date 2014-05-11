import json

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
    code = ''
    try:
        task = GPTask(lsid)
        params = task.getParameters()
        form_code = ''
        execution_code = ''
        execution_code += 'job_spec = JobSpec()\n'
        execution_code += 'job_spec.setLSID(%s)\n' % json.dumps(lsid)
        for param in params:
            paramObj = GPTaskParameter(param)
            param_name = paramObj.getName()
            variable_name = param_name.replace('.', '_')
            variable_value = paramObj.getDefaultValue()
            params = {}
            params['type'] = 'text'
            params['description'] = paramObj.getDescription()
            if (paramObj.isOptional()):
                params['isOptional'] = 1
            if (paramObj.isPassword()):
                params['isPassword'] = 1
            if (paramObj.isChoiceParameter()):
                params['type'] = 'combo'
                params['selectedValue'] = paramObj.getChoiceSelectedValue()
                params['data'] = [[c['value'], c['label']] for c in paramObj.getChoices()]
                # TODO: set variable_value here, according to selectedKey
            variable_value_form_code = json.dumps(variable_value)
            if variable_value is None:
                variable_value_form_code = "None"
            else:
                variable_value_form_code = json.dumps(variable_value)
            form_code += '%s = %s # @param %s\n' % (variable_name, variable_value_form_code, json.dumps(params))
            if (paramObj.isOptional()):
                execution_code += 'if %s is not None:\n    job_spec.setParameter(%s, %s)\n' % (variable_name, json.dumps(param_name), variable_name)
            else:
                execution_code += 'job_spec.setParameter(%s, %s)\n' % (json.dumps(param_name), variable_name)
        execution_code += 'job = runJob(job_spec)'
        code = form_code + execution_code
    except:
        code = '# Error in function GetModuleCellCode() for LSID %s' % lsid
    return code
