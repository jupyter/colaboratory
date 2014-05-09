//----------------------------------------------------------------------------
//  Distributed under the terms of the BSD License.  The full license is in
//  the file COPYING, distributed as part of this software.
//----------------------------------------------------------------------------

//============================================================================
// Comment
//============================================================================

var IPython = (function (IPython) {
    "use strict";

    var CommentWidget = function (cell, container_selector) {
        this.cell = cell;
        this.container = $(container_selector);
        this.load_templates();

        var widget_html = this.comment_widget_template(cell);
        this.element = $(widget_html);
        this.comment_list = this.element.find('.comment_list').first();
        this.comment_input_area = this.element.find('.comment_input_area').first();
        this.comment_input_area.hide();
        this.comment_textarea = this.comment_input_area.find('.comment_textarea').first();
        this.comment_attachment_area = this.element.find(".comment_attachment_area").first();
        // TODO(madadam): Temporarily hiding the attachment area for the demo.
        // Replace or delete it later.
        this.comment_attachment_area.hide();
        this.reply_head = null;

        this.bind_events();
    };

    CommentWidget.prototype.get_widget_elements = function() {
        return this.container.children("div.comment_widget");
    }

    // TODO(madadam): This is called multiple times per cell creation, why?
    // might have to do with cell inheritance? superclass metadata.cell_id
    // different from drivenotebook-created code cell?
    CommentWidget.prototype.insert_widget = function(
        element, index, container) {
        var num_comments = this.get_widget_elements().length;
        if (num_comments == 0) {
          // First cell, insert into the container at the top.
          container.append(element);
        } else if (index == 0) {
          // Inserting above the first cell.
          var first_element = this.get_widget_elements().eq(0);
          if (first_element !== undefined) {
            first_element.before(element);
          }
        } else {
          // Append after the previous cell's widget.
          var element_before = this.get_widget_elements().eq(index - 1);
          if (element_before !== undefined) {
            element_before.after(element);
          } else {
            console.log('No widget before?');
            console.log(this);
          }
        }
    }

    CommentWidget.prototype.insert_comment = function(comment_obj){
        if (comment_obj.parent_comment_id!==null){
            var parent_comment = this.get_comment_by_id(comment_obj.parent_comment_id);
            if (parent_comment!==null){
                comment_obj.parent_username = parent_comment.username;
            }
        }
        var comment_html = this.comment_cell_template(comment_obj);
        var comment = $(comment_html);
        var comment_attachment_list = comment.find('.comment_attachment_list').first();
        if(comment_obj.attachment_cells){
            for(var i=0; i<comment_obj.attachment_cells.length; i++){
                var cell = comment_obj.attachment_cells[i];
                var attachment_cell = $(this.comment_attachment_cell_template(cell));
                attachment_cell.data('cell', cell);
                attachment_cell.appendTo(comment_attachment_list);
            }
        }
        comment.data('comment', comment_obj);
        this.comment_list.append(comment);
    }

    CommentWidget.prototype.get_comment_by_id = function(id) {
        var comment_element = this.comment_list.children().filter(
            function(index) {
              return ($(this).data('comment').comment_id === id);
            });
        if (comment_element.length > 0) {
            return comment_element.first().data('comment');
        }
        return null;
    }

    // Toggle the widget's "is_selected" status.  Some elements of the widget
    // may be hidden when unselected.
    CommentWidget.prototype.set_selected = function(is_selected) {
        if (is_selected) {
          this.element.addClass("selected");
          this.comment_input_area.show();
        } else {
          this.element.removeClass("selected");
          this.comment_input_area.hide();
        }
    }

    CommentWidget.prototype.load_templates = function() {
        this.comment_widget_template = function(cell) {
          var html =
            '<div class="comment_widget">' +
            '  <div class="comment_list">' +
            '  </div>' +
            '  <div class="comment_input_area">' +
            '      <textarea class="comment_textarea" rows="3"></textarea>' +
            '      <div class="comment_attachment_area well well-small">' +
            '      </div>' +
            '      <button class="comment_button btn btn-primary"' +
            '>Comment</button>' +
            '  </div>' +
            '</div>';
          return html;
        };
        this.comment_cell_template = function(data){
            var html = '<div class="comment" id="comment'+data.comment_id+'">' +
                '  <div class="user_avatar" style="background-image:url(' +
                data.user_icon_url + ');"></div>' +
                '  <div class="content">' +
                '    <div class="comment_title">' +
                '      <span class="user_name">' + data.username + '</span><span class="comment_time">' + new Date(data.time).format("yyyy-mm-dd hh:MM TT") + '</span>' +
                '      <span class="reply_button"><i class="icon-reply"></i> reply</span>' +
                '    </div>' +
                '    <div class="comment_text">';
            if (data.parent_username){
                html+='<a class="label label-info comment_reply" href="#comment'+data.parent_comment_id+'"><i class="icon-mail-forward"></i>' + data.parent_username+ '</a> ';
            }
            html += data.text +
                '    </div>';

            if(data.attachment_cells){
                html+='<div class="comment_attachment_list"></div>';
            }
            html+='</div>';
            return html;
        };
        this.comment_attachment_cell_template = function(cell){
            return '<div class="comment_attachment_cell label" draggable="true"><i class="icon icon-paper-clip"></i> '+cell.cell_type+' cell</div>';
        }
        this.reply_head_template = function(data){
            return '<div class="comment_reply_to" class="label label-info"><i class="remove-mark icon icon-remove"></i> '+data.name+'</div>';
        };
        this.attachment_cell_template = function(cell){
            return '<div class="attachment_cell label" data-cell-id="'+cell.metadata.cell_id+'"><i class="icon icon-paper-clip"></i> '+cell.cell_type+' cell<i class="remove-mark icon icon-remove"></div>';
        };
        this.modal_template = function(){
            return '<div id="attachment_cell_modal" class="modal hide" tabindex="-1" role="dialog" aria-hidden="true">' +
                '<div class="modal-header">' +
                '   <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>' +
                '   <h3>Viewing Cell in Comment</h3>' +
                '</div>' +
                '<div class="modal-body">' +
                '</div>' +
                '</div>';
        }
    }


    CommentWidget.prototype.bind_events = function () {
        var that = this;
        // TODO(madadam): Cut-n-paste loses comments, investigate.
        $([IPython.events]).on('create.Cell', function (event, data) {
            if (data.cell.metadata.cell_id !== that.cell.metadata.cell_id) {
                return;
            }
            var index = data.index;
            that.insert_widget(that.element, index, that.container);
        });
        $([IPython.events]).on('delete.Cell', function (event, data) {
            if (data.cell.metadata.cell_id !== that.cell.metadata.cell_id) {
                return;
            }
            that.element.remove();
        });

        this.element.on('click', '.reply_button', $.proxy(this.reply_comment, this));
        this.element.on('click', '.comment_button', $.proxy(this.comment, this));
        this.element.on('click', '.comment_reply_to', $.proxy(this.remove_reply_head, this));
        this.element.on('click', '.comment_reply', $.proxy(this.comment_highlight_parent, this));
        this.element.on('mouseup', '.comment_attachment_cell', $.proxy(this.display_attachment_cell, this));
        this.comment_attachment_area.on('dragenter', $.proxy(this.cell_dragenter, this));
        this.comment_attachment_area.on('dragover', $.proxy(this.cell_dragover, this));
        this.comment_attachment_area.on('dragleave', $.proxy(this.cell_dragleave, this))
        this.comment_attachment_area.on('drop', $.proxy(this.cell_drop, this))
        this.comment_attachment_area.on('click', '.attachment_cell > .remove-mark', $.proxy(this.comment_attachment_remove, this));
        this.comment_textarea.on('keydown', $.proxy(this.comment_submit, this));
    };

    CommentWidget.prototype.display_attachment_cell = function (e) {
        var cell_data = $(e.target).data('cell');
        if (!cell_data.hasOwnProperty('outputs')){// Firebase does not store the attribute when the array is empty, creating it here.
            cell_data.outputs = [];
        }
        var cell;
        if (cell_data.cell_type === 'code') {
            cell = new IPython.CodeCell();
            cell.set_input_prompt();
        } else if (cell_data.cell_type === 'markdown') {
            cell = new IPython.MarkdownCell();
        } else if (cell_data.cell_type === 'raw') {
            cell = new IPython.RawCell();
        } else if (cell_data.cell_type === 'heading') {
            cell = new IPython.HeadingCell();
        }
        cell.cm_config.readOnly = true;
        cell.fromJSON(cell_data);
        $('#attachment_cell_modal').remove();
        var modal_html = this.modal_template();
        var modal = $(modal_html);
        modal.find('.modal-body').append(cell.element);
        modal.on('shown', function(){
            cell.code_mirror.refresh();
        });
        modal.modal();
    };

    CommentWidget.prototype.comment_attachment_remove = function (e) {
        $(e.currentTarget).closest('.attachment_cell').remove();
    };

    CommentWidget.prototype.cell_dragenter = function(e){
        this.comment_attachment_area.addClass('dragover');
    }

    CommentWidget.prototype.cell_dragover= function(e){
        this.comment_attachment_area.addClass('dragover');
        e.preventDefault();
    }

    CommentWidget.prototype.cell_dragleave = function(e){
        this.comment_attachment_area.removeClass('dragover');
    }

    CommentWidget.prototype.cell_drop= function(e){
        var oe = e.originalEvent;
        var cell_data = IPython.notebook.current_dragging_cell.toJSON();
        var attachment_cell_html = this.attachment_cell_template(cell_data);
        var attachment_cell = $(attachment_cell_html);
        attachment_cell.data('cell', cell_data);
        this.comment_attachment_area.append(attachment_cell);
        this.comment_attachment_area.removeClass('dragover');
        return false;
    }

    CommentWidget.prototype.comment_submit = function(e){
        if ((e.keyCode == 10 || e.keyCode == 13) && (e.ctrlKey || e.metaKey)){
            this.comment(e);
            return false;
        }

    };

    CommentWidget.prototype.comment_highlight_parent = function(event){
        var comment = $(event.currentTarget).closest('.comment');
        var comment_obj = comment.data('comment');
        var comment_parent = $("#comment"+ comment_obj.parent_comment_id);
        $('.comment').removeClass("highlight");
        comment_parent.addClass("highlight");
    };


    CommentWidget.prototype.comment = function(event){
        var text = this.comment_textarea.val();
        if(text!==""){

            var user = {};
            if (IPython.notebook.user !== undefined) {
              user = IPython.notebook.user;
            } else {
              // Not a Drive notebook, no user available.  Fake one.
              user.displayName = 'Test User';
              user.picture = {
                  url: 'https://www.gravatar.com/avatar/' +
                           '123123?d=identicon&amp;s=60',
              };
            }
            var data = {
                username: user.displayName,
                user_icon_url: user.picture.url,
                cell_id: IPython.notebook.get_selected_cell().get_id(),
                text: text,
                time: Date.now()
            }
            if(this.reply_head){
                var comment_obj = this.reply_head.data('parent_comment');
                data.parent_comment_id = comment_obj.comment_id;
            }
            var attachment_cells = this.comment_attachment_area.find(".attachment_cell");
            attachment_cells = attachment_cells.map(function (index, element) {
                return  $(element).data('cell');
            });
            data.attachment_cells= $.makeArray(attachment_cells);
            console.log(data.attachment_cells);
            attachment_cells.remove();
            IPython.firebase.submitComment(data);
            this.comment_textarea.val('');
            this.remove_reply_head();
        }
    }

    CommentWidget.prototype.reply_comment = function(event){
        var comment = $(event.currentTarget).closest('.comment');

        var comment_obj = comment.data('comment');
        var reply_head_html  = this.reply_head_template({name: comment_obj.username});
        this.remove_reply_head();

        this.reply_head = $(reply_head_html);
        this.reply_head.data('parent_comment', comment_obj);
        this.reply_head.appendTo(this.comment_input_area);
        $('.comment').removeClass("comment_highlight");
        comment.addClass("comment_highlight");
        this.comment_textarea.css('text-indent', this.reply_head.outerWidth()+2);
        this.comment_textarea.focus();
    }

    CommentWidget.prototype.remove_reply_head = function(){
        if(this.reply_head !== null){
            this.reply_head.remove();
            this.reply_head = null;
            $('.comment').removeClass("comment_highlight");
        }
        this.comment_textarea.css('text-indent', 0);
    }

    IPython.CommentWidget = CommentWidget;

    return IPython;

}(IPython));

