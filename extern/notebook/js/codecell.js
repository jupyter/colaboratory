//----------------------------------------------------------------------------
//  Copyright (C) 2008-2011  The IPython Development Team
//
//  Distributed under the terms of the BSD License.  The full license is in
//  the file COPYING, distributed as part of this software.
//----------------------------------------------------------------------------

//============================================================================
// CodeCell
//============================================================================
/**
 * An extendable module that provide base functionnality to create cell for notebook.
 * @module IPython
 * @namespace IPython
 * @submodule CodeCell
 */


/* local util for codemirror */
var posEq = function(a, b) {return a.line == b.line && a.ch == b.ch;}

/**
 *
 * function to delete until previous non blanking space character
 * or first multiple of 4 tabstop.
 * @private
 */
CodeMirror.commands.delSpaceToPrevTabStop = function(cm){
    var from = cm.getCursor(true), to = cm.getCursor(false), sel = !posEq(from, to);
    if (!posEq(from, to)) {cm.replaceRange("", from, to); return}
    var cur = cm.getCursor(), line = cm.getLine(cur.line);
    var tabsize = cm.getOption('tabSize');
    var chToPrevTabStop = cur.ch-(Math.ceil(cur.ch/tabsize)-1)*tabsize;
    var from = {ch:cur.ch-chToPrevTabStop,line:cur.line}
    var select = cm.getRange(from,cur)
    if( select.match(/^\ +$/) != null){
        cm.replaceRange("",from,cur)
    } else {
        cm.deleteH(-1,"char")
    }
};


var IPython = (function (IPython) {
    "use strict";

    var utils = IPython.utils;
    var key   = IPython.utils.keycodes;

    /**
     * Class for creating a text field in the from view. A text field
     * is the default value for a paramter.
     *
     * @constructor
     * @param {string} name
     * @param {string} value
     * @param {function} callback
     */
    var TextFieldElement = function(name, value, callback)
    {
        this.name = name
        this.value = value

        this.element = $('<div></div>')
            .css('margin', '5px 0px 3px 10px')

        var label = $('<div></div>')
            .text(name.concat(': '))
            .css('display', 'inline')
        this.element.append(label)

        var text = $('<input></input>')
            .attr('id', name)
            .attr('value', value)
            .css('height', '15px')
            .css('width', 'auto')
            .on('input', function () {
                callback(this.id, this.value)
            })

        this.element.append(text);
    }

    /**
     * Class for creating a combo box in the form view. The domain of the combo
     * box is specified in the domain variable.
     *
     * @constructor
     * @param {string} name
     * @param {string} value
     * @param {list} domain
     * @param {function} callback
     */
    var ComboBoxElement = function(name, value, domain, callback)
    {
        this.name = name
        this.value = value

        this.element = $('<div></div>')
            .css('margin', '5px 0px 3px 10px')

        var label = $('<div></div>')
            .text(name.concat(': '))
            .css('display', 'inline')
        this.element.append(label)

        var combo = $('<select></select>')
        for (var i in domain)
        {
            var item = $('<option>' + domain[i] + '</option>')
            item.attr('value', '"'+domain[i]+'"')

            if (value == '"'+domain[i]+'"') {
                item.attr('selected', 'selected')
            }

            combo.append(item)
        }

        combo.attr('id', name)
            .css('width', 'auto')
            .css('height', '18px')
            .css('margin-top','1px')
            .css('margin-bottom', '0px')
            .css('padding', '0px')
            .css('font-size', '87%')
            .css('display','inline-block')
            .on('change', function () {
                callback(this.id, this.value)
            })

        this.element.append(combo);
    }

    /**
     * Class for creating a slider elmenet in the form view. The min, max, and
     * step values of slider are specified in the json params object.
     *
     * @constructor
     * @param {string} name
     * @param {string} value
     * @param {json} params
     * @param {function} callback
     */
    var SliderElement = function(name, value, params, callback)
    {
        this.name = name
        this.value = value

        this.element = $('<div></div>')
            .css('margin', '10px 10px 3px 10px')

        var label = $('<div></div>')
            .text(name + ':')
            .css('display', 'inline')
        this.element.append(label)

        var value_label = $('<div></div>')
            .text(' [' + value + ']')
            .css('display', 'inline')

        var slider = $('<div></div>').slider({
            value: value,
            min: params.min,
            max: params.max,
            step: params.step,
            slide: function(value_label) {
                return function( event, ui ) {
                    value_label.text('  [' + ui.value + ']')
                    callback(this.id, ui.value)
                }
            }(value_label)
        });

        slider.attr('id', name)
            .css('width', '100px')
            .css('margin', '0px 10px 0px 10px')
            .css('display', 'inline-block')

        this.element.append(slider);
        this.element.append(value_label)
    }

    /**
     * Class for the form view of the code cell. Creates a form view element
     * and manages it's visiblity.
     *
     * @constructor
     */
    var FormView = function () {

        // set up form
        this.form = $('<div></div>');
        this.form.css('margin', '0px 0px')
        this.form.css('border', '1px solid lightgrey')
        this.form.css('padding', '3px')
        this.form.css('width', '30%')
        this.form.css('background', '#EEEEEE')

        this.hidden = false
        this.form.css('visibility', 'collapse')
    }

    /**
     * Creates the proper type of element based on the parsing the code.
     *
     * @method create_element
     * @param {string} name
     * @param {string} value
     * @param {json} params
     * @param {function} callback
     */
    FormView.prototype.create_element = function(name, value, params, callback)
    {
        switch (params.type)
        {
          case "slider":
            return new SliderElement(name, value, params, callback);
          case "combo":
            return new ComboBoxElement(name, value, params.domain, callback);
          case "text":
          // default is a text field. in the future we might return an error
          default:
            return new TextFieldElement(name, value, callback);
        }
    }

    /**
     * Parses the code in the code cell to generate form.
     *
     * @method parse_code
     * @param {CodeCell} cc
     */
    FormView.prototype.parse_code = function(cc)
    {
        // split into lines for parsing parameters
        var lines = cc.get_text().match(/[^\r\n]+/g);

        // clear and collapse form
        this.form.empty()
        this.form.css('visibility', 'collapse')

        // hack: make sure the view control is visible
        cc.show_view_control()
        cc.view_control.css('visibility', 'collapse')

        var content = $('<div></div>')
        if (lines) {
            for (var i in lines) {
                var line = lines[i]
                var form_element = this.parse_line(line, cc)
                if (form_element != null)
                {
                  content.append(form_element.element)
                  content.append($('<p/>'))
                }
            }
            this.form.append(content)
        }
    }


    /**
     * Parses a line in the code cell to generate an element
     *
     * @method parse_line_
     * @param {string} line
     * @param {CodeCell} cc
     */
    FormView.prototype.parse_line = function(line, cc)
    {
        var matches = /(\w+)\s*=(.*)#\s*@param(.*)/.exec(line)
        if (matches) {
            // make sure form is visible
            if (!this.hidden) {
                this.form.css('visibility', 'visible')
            }
            cc.view_control.css('visibility', 'visible')

            // callback for changes
            var callback = function (cm) {
                return function (name, value) {
                    var t = cm.getValue()
                    var re = new RegExp("(" + name + "\\s*=).*(#\\s*@param.*)")
                    cm.setValue(t.replace(re, "$1 " + value + " $2"))
                }
            }(cc.code_mirror);

            // grab name value and params
            var name = matches[1]
            var value = matches[2].trim()
            var params = null
            try {
                params = JSON.parse(matches[3].replace(/([\S]+)\:/g,'"$1":'))
            } catch(e) {
                params = null
            }

            // infer type
            if (params == null)
            {
                params = { type: "text" }
            }
            else if (params instanceof Array)
            {
                var domain = params
                params = { type: "combo", domain: domain}
            }
            else if (!"type" in params)
            {
                params.type = "text"
            }

            return this.create_element(name, value, params, callback)
        }
        return null
    }


    /**
     * A Cell conceived to write code.
     *
     * The kernel doesn't have to be set at creation time, in that case
     * it will be null and set_kernel has to be called later.
     * @class CodeCell
     * @extends IPython.Cell
     *
     * @constructor
     * @param {Object|null} kernel
     * @param {object|undefined} [options]
     *      @param [options.cm_config] {object} config to pass to CodeMirror
     */
    var CodeCell = function (kernel, options) {
        this.kernel = kernel || null;
        this.code_mirror = null;
        this.input_prompt_number = null;
        this.collapsed = false;
        this.cell_type = "code";
        this.code_vbox = null
        this.form_view = new FormView()
        this.view_control = this.create_view_control()


        var cm_overwrite_options  = {
            onKeyEvent: $.proxy(this.handle_codemirror_keyevent,this)
        };

        options = this.mergeopt(CodeCell, options, {cm_config:cm_overwrite_options});

        IPython.Cell.apply(this,[options]);

        var that = this;
        this.element.focusout(
            function() { that.auto_highlight(); }
        );
    };

    CodeCell.options_default = {
        cm_config : {
            extraKeys: {
                "Tab" :  "indentMore",
                "Shift-Tab" : "indentLess",
                "Backspace" : "delSpaceToPrevTabStop",
                "Cmd-/" : "toggleComment",
                "Ctrl-/" : "toggleComment"
            },
            mode: 'ipython',
            theme: 'ipython',
            matchBrackets: true
        }
    };

    CodeCell.prototype = Object.create(IPython.Cell.prototype);

    /**
     * @method auto_highlight
     */
    CodeCell.prototype.auto_highlight = function () {
        this._auto_highlight(IPython.config.cell_magic_highlight)
    };

    /**
     * Creates form control.
     *
     * @method create_view_control
     */
    CodeCell.prototype.create_view_control = function()
    {
        // create control
        var control = $("<select></select>")
            .css('width', 'auto')
            .css('height', '18px')
            .css('margin-right','3px')
            .css('margin-bottom', '0px')
            .css('padding', '0px')
            .css('font-size', '87%')
            .css('display','inline-block')

        control.append('<option value=both>both</option>')
        control.append('<option value=code>code</option>')
        control.append('<option value=form>form</option>')
        control.on('change', function(cc) {
            return function() {
                if (this.value == 'code') {
                    cc.code_vbox.css('visibility', 'visible')

                    cc.form_view.form.css('visibility', 'collapse')
                    cc.form_view.form.removeClass('vbox box-flex1')
                    cc.form_view.hidden = true
                }
                else if (this.value == 'both') {
                    cc.code_vbox.css('visibility', 'visible')

                    cc.form_view.form.css('width', '30%')
                    cc.form_view.form.removeClass('vbox box-flex1')
                    cc.form_view.form.css('visibility', 'visible')
                    cc.form_view.hidden = false
                }
                else if (this.value == 'form') {
                    cc.code_vbox.css('visibility', 'collapse')

                    cc.form_view.form.addClass('vbox box-flex1')
                    cc.form_view.form.css('visibility', 'visible')
                    cc.form_view.hidden = false
                }
            }
        }(this))
        return control
    }

    /**
     * Adds view control to CellToolBar.
     *
     * @method show_view_control
     */
    CodeCell.prototype.show_view_control = function ()
    {
        this.celltoolbar.show()
        this.view_control.css('visibility', 'visible')
        var toolbar = this.celltoolbar.element.find('.celltoolbar').append(this.view_control)
    }

    /** @method create_element */
    CodeCell.prototype.create_element = function () {
        IPython.Cell.prototype.create_element.apply(this, arguments);

        var cell =  $('<div></div>').addClass('cell border-box-sizing code_cell');
        cell.attr('tabindex','2');

        this.celltoolbar = new IPython.CellToolbar(this);

        var input = $('<div></div>').addClass('input');

        // vbox for toolbar and code/form hbox
        var vbox = $('<div/>').addClass('vbox box-flex1')
        input.append($('<div/>').addClass('prompt input_prompt'));
        vbox.append(this.celltoolbar.element);

        // hbox that holds both code/form
        var hbox = $('<div/>').addClass('hbox box-flex1')

        // add code view
        this.code_vbox = $('<div/>').addClass('vbox box-flex1')
        var input_area = $('<div/>').addClass('input_area');
        this.code_mirror = CodeMirror(input_area.get(0), this.cm_config);
        $(this.code_mirror.getInputField()).attr("spellcheck", "false");
        this.code_vbox.append(input_area)
        hbox.append(this.code_vbox);

        // add form view
        hbox.append(this.form_view.form);

        vbox.append(hbox)
        input.append(vbox);

        var output = $('<div></div>');
        cell.append(input).append(output);
        this.element = cell;
        this.output_area = new IPython.OutputArea(output, true);

        // construct a completer only if class exist
        // otherwise no print view
        if (IPython.Completer !== undefined)
        {
            this.completer = new IPython.Completer(this);
        }
    };

    /**
     *  This method gets called in CodeMirror's onKeyDown/onKeyPress
     *  handlers and is used to provide custom key handling. Its return
     *  value is used to determine if CodeMirror should ignore the event:
     *  true = ignore, false = don't ignore.
     *  @method handle_codemirror_keyevent
     */
    CodeCell.prototype.handle_codemirror_keyevent = function (editor, event) {

        var that = this;
        // whatever key is pressed, first, cancel the tooltip request before
        // they are sent, and remove tooltip if any, except for tab again
        if (event.type === 'keydown' && event.which != key.TAB ) {
            IPython.tooltip.remove_and_cancel_tooltip();
        };

        var cur = editor.getCursor();
        if (event.keyCode === key.ENTER){
            this.auto_highlight();
        }

        if (event.keyCode === key.ENTER && (event.shiftKey || event.ctrlKey)) {
            // Always ignore shift-enter in CodeMirror as we handle it.
            return true;
        } else if (event.which === 40 && event.type === 'keypress' && IPython.tooltip.time_before_tooltip >= 0) {
            // triger on keypress (!) otherwise inconsistent event.which depending on plateform
            // browser and keyboard layout !
            // Pressing '(' , request tooltip, don't forget to reappend it
            // The second argument says to hide the tooltip if the docstring 
            // is actually empty
            IPython.tooltip.pending(that, true);
        } else if (event.which === key.UPARROW && event.type === 'keydown') {
            // If we are not at the top, let CM handle the up arrow and
            // prevent the global keydown handler from handling it.
            if (!that.at_top()) {
                event.stop();
                return false;
            } else {
                return true;
            };
        } else if (event.which === key.ESC) {
            IPython.tooltip.remove_and_cancel_tooltip(true);
            return true;
        } else if (event.which === key.DOWNARROW && event.type === 'keydown') {
            // If we are not at the bottom, let CM handle the down arrow and
            // prevent the global keydown handler from handling it.
            if (!that.at_bottom()) {
                event.stop();
                return false;
            } else {
                return true;
            };
        } else if (event.keyCode === key.TAB && event.type == 'keydown' && event.shiftKey) {
                if (editor.somethingSelected()){
                    var anchor = editor.getCursor("anchor");
                    var head = editor.getCursor("head");
                    if( anchor.line != head.line){
                        return false;
                    }
                }
                IPython.tooltip.request(that);
                event.stop();
                return true;
        } else if (event.keyCode === key.TAB && event.type == 'keydown') {
            // Tab completion.
            //Do not trim here because of tooltip
            if (editor.somethingSelected()){return false}
            var pre_cursor = editor.getRange({line:cur.line,ch:0},cur);
            if (pre_cursor.trim() === "") {
                // Don't autocomplete if the part of the line before the cursor
                // is empty.  In this case, let CodeMirror handle indentation.
                return false;
            } else if ((pre_cursor.substr(-1) === "("|| pre_cursor.substr(-1) === " ") && IPython.config.tooltip_on_tab ) {
                IPython.tooltip.request(that);
                // Prevent the event from bubbling up.
                event.stop();
                // Prevent CodeMirror from handling the tab.
                return true;
            } else {
                event.stop();
                this.completer.startCompletion();
                return true;
            };
        } else {
            // keypress/keyup also trigger on TAB press, and we don't want to
            // use those to disable tab completion.
            this.form_view.parse_code(this)

            return false;
        };
        return false;
    };


    // Kernel related calls.

    CodeCell.prototype.set_kernel = function (kernel) {
        this.kernel = kernel;
    }

    /**
     * Execute current code cell to the kernel
     * @method execute
     */
    CodeCell.prototype.execute = function () {
        this.output_area.clear_output(true, true, true);
        this.set_input_prompt('*');
        this.element.addClass("running");
        var callbacks = {
            'execute_reply': $.proxy(this._handle_execute_reply, this),
            'output': $.proxy(this.output_area.handle_output, this.output_area),
            'clear_output': $.proxy(this.output_area.handle_clear_output, this.output_area),
            'set_next_input': $.proxy(this._handle_set_next_input, this),
            'input_request': $.proxy(this._handle_input_request, this)
        };
        var msg_id = this.kernel.execute(this.get_text(), callbacks, {silent: false, store_history: true});
    };

    /**
     * @method _handle_execute_reply
     * @private
     */
    CodeCell.prototype._handle_execute_reply = function (content) {
        this.set_input_prompt(content.execution_count);
        this.element.removeClass("running");
        $([IPython.events]).trigger('set_dirty.Notebook', {value: true});
    }

    /**
     * @method _handle_set_next_input
     * @private
     */
    CodeCell.prototype._handle_set_next_input = function (text) {
        var data = {'cell': this, 'text': text}
        $([IPython.events]).trigger('set_next_input.Notebook', data);
    }
    
    /**
     * @method _handle_input_request
     * @private
     */
    CodeCell.prototype._handle_input_request = function (content) {
        this.output_area.append_raw_input(content);
    }


    // Basic cell manipulation.

    CodeCell.prototype.select = function () {
        IPython.Cell.prototype.select.apply(this);
        this.code_mirror.refresh();
        this.code_mirror.focus();
        this.auto_highlight();
        // We used to need an additional refresh() after the focus, but
        // it appears that this has been fixed in CM. This bug would show
        // up on FF when a newly loaded markdown cell was edited.
    };


    CodeCell.prototype.select_all = function () {
        var start = {line: 0, ch: 0};
        var nlines = this.code_mirror.lineCount();
        var last_line = this.code_mirror.getLine(nlines-1);
        var end = {line: nlines-1, ch: last_line.length};
        this.code_mirror.setSelection(start, end);
    };


    CodeCell.prototype.collapse = function () {
        this.collapsed = true;
        this.output_area.collapse();
    };


    CodeCell.prototype.expand = function () {
        this.collapsed = false;
        this.output_area.expand();
    };


    CodeCell.prototype.toggle_output = function () {
        this.collapsed = Boolean(1 - this.collapsed);
        this.output_area.toggle_output();
    };


    CodeCell.prototype.toggle_output_scroll = function () {
    this.output_area.toggle_scroll();
    };


    CodeCell.input_prompt_classical = function (prompt_value, lines_number) {
        var ns = prompt_value || "&nbsp;";
        return 'In&nbsp;[' + ns + ']:'
    };

    CodeCell.input_prompt_continuation = function (prompt_value, lines_number) {
        var html = [CodeCell.input_prompt_classical(prompt_value, lines_number)];
        for(var i=1; i < lines_number; i++){html.push(['...:'])};
        return html.join('</br>')
    };

    CodeCell.input_prompt_function = CodeCell.input_prompt_classical;


    CodeCell.prototype.set_input_prompt = function (number) {
        var nline = 1
        if( this.code_mirror != undefined) {
           nline = this.code_mirror.lineCount();
        }
        this.input_prompt_number = number;
        var prompt_html = CodeCell.input_prompt_function(this.input_prompt_number, nline);
        this.element.find('div.input_prompt').html(prompt_html);
    };


    CodeCell.prototype.clear_input = function () {
        this.code_mirror.setValue('');
    };


    CodeCell.prototype.get_text = function () {
        return this.code_mirror.getValue();
    };


    CodeCell.prototype.set_text = function (code) {
        return this.code_mirror.setValue(code);
    };


    CodeCell.prototype.at_top = function () {
        var cursor = this.code_mirror.getCursor();
        if (cursor.line === 0 && cursor.ch === 0) {
            return true;
        } else {
            return false;
        }
    };


    CodeCell.prototype.at_bottom = function () {
        var cursor = this.code_mirror.getCursor();
        if (cursor.line === (this.code_mirror.lineCount()-1) && cursor.ch === this.code_mirror.getLine(cursor.line).length) {
            return true;
        } else {
            return false;
        }
    };


    CodeCell.prototype.clear_output = function (stdout, stderr, other) {
        this.output_area.clear_output(stdout, stderr, other);
    };


    // JSON serialization

    CodeCell.prototype.fromJSON = function (data) {
        IPython.Cell.prototype.fromJSON.apply(this, arguments);
        if (data.cell_type === 'code') {
            if (data.input !== undefined) {
                this.set_text(data.input);
                this.form_view.parse_code(this)

                // make this value the starting point, so that we can only undo
                // to this state, instead of a blank cell
                this.code_mirror.clearHistory();
                this.auto_highlight();
            }
            if (data.prompt_number !== undefined) {
                this.set_input_prompt(data.prompt_number);
            } else {
                this.set_input_prompt();
            };
            this.output_area.fromJSON(data.outputs);
            if (data.collapsed !== undefined) {
                if (data.collapsed) {
                    this.collapse();
                } else {
                    this.expand();
                };
            };
        };
    };


    CodeCell.prototype.toJSON = function () {
        var data = IPython.Cell.prototype.toJSON.apply(this);
        data.input = this.get_text();
        data.cell_type = 'code';
        if (this.input_prompt_number) {
            data.prompt_number = this.input_prompt_number;
        };
        var outputs = this.output_area.toJSON();
        data.outputs = outputs;
        data.language = 'python';
        data.collapsed = this.collapsed;
        return data;
    };


    IPython.CodeCell = CodeCell;

    return IPython;
}(IPython));
