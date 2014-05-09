var handleClientLoad;

var IPython = (function(IPython) {
  'use strict';

  /**
  * A subclass of Notebook that does file management with Google Drive.
  */
 var DriveNotebook = function(selector, options) {
    IPython.Notebook.apply(this, [selector, options]);
  };
  // TODO(sandler,kester): Switch to closure goog.inherit
  var tempCtor = function tempCtor() {};
  tempCtor.prototype = IPython.Notebook.prototype;
  DriveNotebook.prototype = new tempCtor();

  // Class level constant
  DriveNotebook.prototype.GOOGLE_DRIVE_SENTINEL = 'GOOGLEDRIVE';

  DriveNotebook.prototype.share_notebook_dialog = function() {
     var notebook = this;
    gapi.load('drive-share', function() {
      var shareClient = IPython.DriveUtil.getShareClient();
      shareClient.setItemIds([notebook.notebook_id]);
      shareClient.showSettingsDialog();
      IPython.DriveUtil.validateSharingDialog(
          'https://docs.google.com/a/google.com/file/d/' +
          notebook.notebook_id);

    });
  };

  DriveNotebook.prototype.set_notebook_name = function(name) {
    this.notebook_name = name;
    this.has_name = true;
  };

  DriveNotebook.prototype.load_notebook = function(notebook_id) {
    if (!this.parse_notebook_id(notebook_id)) {
      alert('Could not parse notebook id as Google Drive request');
      return;
    }
    var doAction = $.proxy(this.do_action, this);
    IPython.DriveUtil.loadDriveApi(doAction);
  };

  DriveNotebook.prototype.save_notebook = function() {
    if (!this.has_name && this._checkpoint_after_save) {
      // If  a user selects "Cancel" we will not save the notebook
      // but it is to be expected.
      IPython.save_widget.rename_notebook();
      return;
    }
    var that = this;
    IPython.DriveUtil.authenticateWithDrive(function(resp) {
      var request = gapi.client.request({
        'path': '/drive/v2/files/' + that.notebook_id,
        'method': 'GET'
      });

      request.execute(function(reply) {
        if (resp.error) {
            console.log('Unable to execute file open request', resp);
            that.load_notebook_error({status: 400}, undefined,
                JSON.stringify(resp.error));
            return;
        }
        if (reply.modifiedDate > that._drive_modified_date) {
          var confirm_message = ('Another user has modified this' +
              ' document while you were editing. ' +
              'Really save to drive?');
          if (!confirm(confirm_message)) {
            return;
          }
        }

        var notebook_json = that.toJSON();
        notebook_json.metadata.name = that.notebook_name;
        notebook_json.nbformat = that.nbformat;
        notebook_json.nbformat_minor = that.nbformat_minor;

        var metadata = {
          'title': notebook_json.metadata.name,
          'mimeType': that.contentType()
        };

        var body = that.multipartBody(
            metadata, that.convert_to_file_format(notebook_json));

        // The Notebook class saves and then checkpoints immediately
        // aftetr if _checkpoint_after_save is True.  For Google Drive
        // checkpoings are pinned revisions, and it is easier to set
        // the revision to be pinned when creating it.  Therefore we
        // do this here, and set the flag to be False so that no
        // checkpointing is done after the save.
        var pinned = that._checkpoint_after_save;
        that._checkpoint_after_save = false;

        var requestBody = {
          'path': '/upload/drive/v2/files/' + that.notebook_id,
          'method': 'PUT',
          'params': {
            'uploadType': 'multipart',
            'fileId': that.notebook_id,
            'pinned': pinned
          },
          'headers': {
            'Content-Type': 'multipart/mixed; boundary="' +
                that.multipartBoundary() + '"'
          },
          'body': body
        };

        var request = gapi.client.request(requestBody);
        var start = new Date().getTime();

        request.execute(function(data) {
          if (!data || data.error) {
            that.save_notebook_error(data.error);
            console.log('Error saving:', data);
            console.log('Request body:', requestBody);
            if (pinned) {
              alert(' Failed to save the notebook! Most likely a drive issue.' +
                    ' Please inspect console for any messages. You should ' +
                    ' download your content locally');
            }
            return;
          }
          that._drive_modified_date = data.modifiedDate;
          that.save_notebook_success(start);

          // Overwrites the UUID property, which is used by the v2 notebook
          // to detect when the file is overwritten.
          var key = 'UUID';
          var path = '/drive/v2/files/' + that.notebook_id + '/properties/' +
              key;
          var body = {'key': key, 'value': '', 'visibility': 'PUBLIC'};
          var request = gapi.client.request({
            'method': 'PUT',
            'path': path,
            'params': {'visibility': 'PUBLIC'},
            'body': JSON.stringify(body)
          });
          request.execute(function() {});
        });
      });
    });
  };

  /**
   * Override checkpoint related functions
   */

  DriveNotebook.prototype.create_checkpoint = function() {};
  DriveNotebook.prototype.restore_checkpoint = function(checkpoint) {};
  DriveNotebook.prototype.delete_checkpoint = function(checkpoint) {};

  /**
   * Creates a new drive notebook in a given folder.
   * If folder is none, creates notebook in default root folder
   */
  DriveNotebook.prototype.create_notebook = function(optName, optFolderId) {
    var name = 'Untitled.ipynb';
    this.has_name = false;
    if (optName) {
      name = optName;
      this.has_name = true;
    }
    var parents = [];
    if (optFolderId) {
      parents = [{
          'kind': 'drive#parentReference',
          'id': optFolderId
       }];
    }
    var nb = {
      'metadata': {},
      'nbformat': 3,
      'nbformat_minor': 0,
      'worksheets': []
    };
    nb.metadata.name = name;

    var metadata = {
      'parents': parents,
      'title': name,
      'description': 'IP[y] file',
      'mimeType': this.contentType()
    };
    var body = this.multipartBody(metadata,
                                  this.convert_to_file_format(nb));

    var request = gapi.client.request({
      'path': '/upload/drive/v2/files',
      'method': 'POST',
      'params': {'uploadType': 'multipart'},
      'headers': {
        'Content-Type': 'multipart/mixed; boundary="' +
            this.multipartBoundary() + '"'
      },
      'body': body
    });
    var notebook = this;
    request.execute(function(file) {
      if (!file || file.error) {
        console.log('Error: ', file.error);
        console.log('Detailed error:', (file.error.errors || [''])[0]);
        alert('Unable to create a notebook, see console for more details');
        return;
      }
      notebook.notebook_id = file.id;
      notebook._drive_modified_date = file.modifiedDate;
      // TODO(sandler): Use standard library, and maybe move to
      // load_notebook_success
      window.location.replace('#notebook_id=' + file.id);
      notebook.load_notebook_success(nb);
    });
  };


  DriveNotebook.prototype.do_action = function() {
    console.log('Action: ' + this._action);
    var that = this;
    IPython.DriveUtil.authenticateWithDrive(function(resp) {
      that.user = resp.user;
      if (that._action == 'open') {
        var request = gapi.client.request({
            'path' : '/drive/v2/files/' + that._document_id,
            'method': 'GET'
        });

        request.execute(function(resp) {
          if (resp.error) {
            console.log('Unable to execute file open request', resp);
            that.load_notebook_error({status: 400}, undefined,
                JSON.stringify(resp.error));
            return;
          }
          var myToken = gapi.auth.getToken();
          var myXHR = new XMLHttpRequest();
          var title = resp.title;
          that._drive_modified_date = resp.modifiedDate;
          myXHR.open('GET', resp.downloadUrl, true);
          myXHR.setRequestHeader('Authorization',
                                  'Bearer ' + myToken.access_token);
          myXHR.onreadystatechange = function(theProgressEvent) {
            if (myXHR.readyState == 4) {
              if (myXHR.status == 200) {
                var nb = that.convert_from_file_format(myXHR.response);
                nb.metadata.name = title;
                that.has_name = true;
                that.notebook_id = that._document_id;
                that.load_notebook_success(nb);
              }
            }
          };
          myXHR.send();
        });
      }

      if (that._action == 'create') {
        that.create_notebook(undefined, that._folder_id);
      }
    });
  };

  DriveNotebook.prototype.getDocumentIdFromHash = function() {
    // TODO(sandler): use proper hash handling routines.
    var match = window.location.hash.match(/notebook_id=([^&]+)/);
    if (match) {
      return match[1];
    }
  };

  DriveNotebook.prototype.parse_notebook_id = function(notebook_id) {
      var sentinel = this.GOOGLE_DRIVE_SENTINEL;
    var split_array = notebook_id.split(',');
    if (split_array.length != 5)
      return false;
    if (split_array[0] == sentinel &&
        split_array[1] == 'DOCUMENTID' &&
        split_array[3] == 'USERID') {
      this._document_id = split_array[2];
      this._user_id = split_array[4];
      this._action = 'open';
      return true;
    } else if (split_array[0] == sentinel &&
        split_array[1] == 'FOLDERID' &&
        split_array[3] == 'USERID') {
      this._folder_id = split_array[2];
      this._user_id = split_array[4];

      this._document_id = this.getDocumentIdFromHash();
      if (this._document_id) {
        this._action = 'open';
      } else {
        this._action = 'create';
      }
      return true;
    }
    return false;
  };

  /**
   * Utility methods to construct multipart uploads
   */

  DriveNotebook.prototype.multipartBoundary = function() {
    return '-------314159265358979323846';
  };

  DriveNotebook.prototype.contentType = function() {
    return 'application/ipynb';
  };

  DriveNotebook.prototype.multipartBody = function(metadata, data) {
    var delimiter = '\r\n--' + this.multipartBoundary() + '\r\n';
    var close_delim = '\r\n--' + this.multipartBoundary() + '--';
    return delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: ' + this.contentType() + ';\r\n' +
        '\r\n' +
        data +
        close_delim;
  };

  /**
   * Checkpointing
   */

  DriveNotebook.prototype.list_checkpoints = function() {
    // Assume that gapi is loaded and auth token has been
    // recieved.  Right now this function is only called from
    // load_notebook_success, and that function is only called
    // after these two conditions are met.

    var that = this;

    var request = gapi.client.request({
      'path' : '/drive/v2/files/' + that.notebook_id + '/revisions',
      'method': 'GET'
    });

    request.execute(function(resp) {
      var data = [];
      // Get all pinned revisions. NOTE: current revision
      // may not be pinned.
      for (var i = 0; i < resp.items.length; i++) {
        var revision = resp.items[i];
        if (revision.pinned) {
          data.push({
            'checkpoint_id': resp.items[i].id,
            'last_modified': resp.items[i].modifiedDate
          });
        }
      }
      that.list_checkpoints_success(JSON.stringify(data));
    });
  };

  /**
   * Utility method to convert from note file to notebook object
   * This is a rough approximation of the functionality of
   * IPython.nbformat.current.reads_json
   */

  DriveNotebook.prototype.convert_from_file_format = function(data) {
    var nb = $.parseJSON(data);

    var multiline_outputs = {
      'text': 0,
      'html': 0,
      'svg': 0,
      'latex': 0,
      'javascript': 0,
      'json': 0};

    // Implements functionality of IPython.nbformat.v3.rwbase.rejoin_lines
    for (var i = 0; i < nb.worksheets.length; i++) {
      var ws = nb.worksheets[i];
      for (var j = 0; j < ws.cells.length; j++) {
        var cell = ws.cells[j];
        if (cell.cell_type === 'code') {
          if ('input' in cell && Array.isArray(cell.input)) {
            cell.input = cell.input.join('');
          }
          for (var k = 0; k < cell.outputs.length; k++) {
            var output = cell.outputs[k];
            for (var key in multiline_outputs) {
              if (key in output && Array.isArray(output[key])) {
                output[key] = output[key].join('');
              }
            }
          }
        } else {
          for (var key in {'source': 0, 'rendered': 0}) {
            if (key in cell && Array.isArray(cell[key])) {
              cell[key] = cell[key].join('');
            }
          }
        }
      }
    }
    return nb;
  };

  DriveNotebook.prototype.convert_to_file_format = function(nb) {
    var data = JSON.stringify(nb);
    return data;
  };


  IPython.DriveNotebook = DriveNotebook;

  return IPython;
}(IPython));
