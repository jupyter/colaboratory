//----------------------------------------------------------------------------
//  Distributed under the terms of the BSD License.  The full license is in
//  the file COPYING, distributed as part of this software.
//----------------------------------------------------------------------------

var IPython = (function (IPython) {
    "use strict";

    var Fbase = function(){};

    Fbase.prototype.loadFirebase = function(){
        $.ajax({
            // SECURITY NOTE:  Loading this file from an external CDN presents
            // a possible security vulnerability, in that whoever controls the
            // CDN can introduce arbitrary script.  If this code is deployed
            // widely (either internally or externally), we'll need to host our
            // own copy of this file and have it reviewed by security team.
            url: "https://cdn.firebase.com/v0/firebase.js",
            dataType: "script",
            cache: true,
            success: $.proxy(this.initFirebase, this)
        });
    }

    Fbase.prototype.initFirebase = function(){
        // TODO(madadam): Make this configurable via app settings.
        this.baseURI = 'https://ipython-colab-test.firebaseio.com';
        this.myDataRef = new Firebase(this.baseURI);

        var that = this;
        console.log("initializing firebase");

        // Init all existing cells.
        var initAllCells = function(){
            var cells = IPython.notebook.get_cells();
            $.each(cells, function(index, cell){
                var cellId = cell.get_id();
                that.initCellComments(cellId);
            });
        }

        $([IPython.events]).on('select.Cell', function(cell){

        });

        // Listen for creation events to init new cells.
        // TODO(madadam): Listen for deletion events and delete corresponding
        // firebase data.
        $([IPython.events]).on('create.Cell', function(event, data){
            that.initCellComments(data.cell.metadata.cell_id);
        });

        if(IPython.notebook.session === null){
            $([IPython.events]).on('notebook_loaded.Notebook', initAllCells)
        } else{
            initAllCells()
        }
    }

    Fbase.prototype.initCellComments = function(cellId){
        var url = this.baseURI + "/cells/" + cellId + "/comments/";
        var cellCommentsDataRef = new Firebase(url);

        var that = this;
        cellCommentsDataRef.on('child_added', function(snapshot){
            var comment = snapshot.val();
            comment.comment_id = snapshot.name();
            that.updateCellComments(comment);
        });
    }

    Fbase.prototype.submitComment = function(comment_obj){
        var cellId = comment_obj.cell_id;
        var url = this.baseURI + '/cells/' + cellId + "/comments/";
        var commentListRef = new Firebase(url);

        // Generate a reference to a new location with push
        var newPushRef = commentListRef.push();

        newPushRef.set(comment_obj);

        console.log(newPushRef.name());
    }


    Fbase.prototype.updateCellComments = function(comment){
        var parentCell = IPython.notebook.get_cell_by_id(comment.cell_id);
        if(parentCell){
            if (parentCell.hasOwnProperty("comment_widget")){
              parentCell.comment_widget.insert_comment(comment);
            }
        }
    }

    Fbase.prototype.submitQuiz= function(quiz_obj){
        // Separate the attributes for now to be explicit
        var cellId = quiz_obj.cell_id;
        var userId = quiz_obj.userId;
        var quizId = cellId; // Re-assign this explicitly for now to be explicit

        // Partition the quizzes by user id so that Firebase can handle permissions separately
        var url = this.baseURI + '/quizzes/' + quizId + "/" + userId + "/submissions/";
        var quizSubmissionsRef = new Firebase(url);

        // Generate a reference to a new location with push
        var newPushRef = quizSubmissionRef.push();

        newPushRef.set(quiz_obj);

        console.log(newPushRef.name());
    }

    IPython.Fbase = Fbase;
    return IPython

}(IPython));
