"""Class providing InteractiveTable widget for ipython notebook.

example usage:
cell[1]: browser_columns = ["engine", "browser", "platform", "version"];
data= ([[ "Trident", "Internet Explorer 4.0", "Win 95+", 5, "X" ],
        [ "Trident", "Internet Explorer 5.0", "Win 95+", 555, "C" ]]);

cell[2]: table = interactive_table.InteractiveTable(browser_columns, data * 1);
         table # to actually display the contents

cell[3]: table.get_autoupdated_selection()
"""
import json

from IPython import display

# pylint: disable=g-bad-import-order
# pylint: disable=g-import-not-at-top

try:
  from colabtools import interactive_util
  from colabtools import message
except:
  # used for testing
  print 'Using legacy google3.research  bindings for colaboratory'
  from google3.research.colab.lib import interactive_util
  from google3.research.colab.lib import message


GetObjectId = interactive_util.GetObjectId
Listener = interactive_util.Listener


FULL_MODULE_NAME = __name__
TABLE_CSS = ['/static/external/css/demo_table.css',
             '/static/custom/interactive_table.css']
INTERACTIVE_JS = interactive_util.BOOTSTRAP_JS
JQUERY_DATATABLES = '/static/external/js/jquery_datatables.js'
JQUERY_COLUMNFILTER = '/static/external/js/jquery.dataTables.columnFilter.js'


def Create(dataframe, **kwargs):
  """Creates interactive table from pandas DataFrame.

  Args:
      dataframe: exposes columns and data (e.g.
        pandas.core.frame.DataFrame)
      **kwargs: any arguments that can be passed to
              constructor verbatim
  Returns:
      InteractiveTable wrapping dataframe.
  """
  return InteractiveTable(
      dataframe.columns,
      dataframe.values,
      **kwargs)


def ToJs(x):
  if str(type(x)).find('numpy') >= 0: return str(x)
  if type(x).__name__ == 'datetime':
    return x.strftime("'%Y-%m-%d %H:%M:%S'")
  return json.dumps(x)


def ToJsMatrix(matrix):
  """Creates a two dimensional javascript compatible matrix.

  Args:
      matrix: is any iterator-of-iterator matrix. Currently
        the individual type should be numbers of strings.
        TODO(sandler): add datetime support.

  Returns:
     javascript representation.
  """
  return '[[%s]]' % ('],\n ['.join((
      ','.join(map(ToJs, x)) for x in matrix)))


class InteractiveTable(display.DisplayObject):
  """Defines interactive table widget."""

  def __init__(self,
               columns, data,
               columns_js=None, column_filters_js=None,
               auto_save_timeout=1000,
               persistent_id='',
               num_rows_per_page=10,
               max_rows=20000,
               max_columns=20):
    """Constructor.

    Args:
       columns: a list of column names e.g. ['salary', 'rank']

       data: list of rows, each row of the same size as columns. E.g.
         [['100', 'engineer'], ['00', 'janitor']], it also accepts
       pandas DataFrame as input. Or use interactive_table.Create function
       above instead.

       columns_js: (optional) a javascript expression describing column
         names (useful if data arrives from the browser), if provided
         columns is then ignored. E.g. 'document.my_column_names'.
         This javascript should evaluate correctly in the browser context.

       column_filters_js: Javascript expression describing
         configuration for column filters. (such as reg.ex matching)
         This parameter is passed verbatim to ColumnFilter constructor.
         For information on possible configuration parameters
         refer to http://goo.gl/nFK7cB

       auto_save_timeout: if positive the current selection
         will be automatically saved after this many milliseconds

       persistent_id: Could be any string that is a valid identifier
         in both python and javascript. Must be unique across
         all interactive tables this notebook.
         If provided, then all listeners to this table
         will be able to update themselves automatically even
         if table is reloaded. If not provided, then listners
         will need to be reexecuted (once), upon reload, to update their
         hooks.

       num_rows_per_page: display that many rows per page initially
       max_rows: if len(data) exceeds this value a warning will be printed
         and the table truncated
       max_columns: if len(columns) exceeds this value a warning will be
         printed and truncated.
    """
    # use persistent_id for listener, so that element links
    # are maintained across sessions. Since those are not
    # used in any way in python code, only in session-specific
    # javascript, we won't get any conflicts
    if not persistent_id: persistent_id = GetObjectId(self)
    self.listener = Listener(persistent_id)

        # Using persistent_id here ensures that table will update
    # its selection and it will be accessible by other cells
    self.id = 'IT_' + persistent_id
    if len(columns) > max_columns:
      print ('Warning: Total number of columns (%d) exceeds max_columns (%d)'
             ' limiting to first max_columns ')  % (len(columns), max_columns)
      columns = columns[:max_columns]

    if len(data) > max_rows:
      print ('Warning: total number of rows (%d) exceeds max_rows (%d) '
             ' limiting to first max_rows ') % (len(data), max_rows)
      data = data[:max_rows]
    self.columns = columns
    self.data = data

    if column_filters_js is None and columns_js is None:
      column_filters_js = self.get_js_types()

    self.columns_js = columns_js or ''
    self.auto_save = auto_save_timeout > 0
    self.auto_save_timeout = auto_save_timeout
    self.column_filters_js = column_filters_js
    self.num_rows_per_page = num_rows_per_page
    self.selection = range(len(data))

    message.Subscribe(self._get_tag(), self.compute_selection, True)

  def get_js_types(self):
    types = {}

    for row in self.data:
      for col_index, cell in enumerate(row):
        t = type(cell).__name__
        types.setdefault(col_index, set())
        types[col_index].add(t)

    filter_types = []
    for i in range(len(types)):
      seen = types[i]
      js_data_type = 'text'
      if 'str' not in seen and 'unicode' not in seen:
        for each in seen:
          if each.startswith('int') or each.startswith('float'):
            js_data_type = 'number'

      if js_data_type == 'text':
        filter_types.append('{type:"text",bRegex:true}')
      if js_data_type == 'number':
        filter_types.append('{type:"number-range"}')

    return '{ aoColumns: [ %s ] }' % ','.join(filter_types)

  def compute_selection(self, tag, data, unused_origin_info):
    if data['action'] == 'clear':
      self.selection = []
    if data['action'] == 'append':
      self.selection.extend(data['indices'])

  def get_selection(self):
    """Returns selection saved in the table."""
    data = self.data
    return [data[x] for x in self.selection]

  def get_autoupdated_selection(self):
    """Returns saved selection *and* registers the cell for updates."""
    self.listen()
    return self.get_selection()

  def get_current_selection(self):
    """Returns current selection (before save is pressed).

    TODO(sandler): Implement this as needed
    """

  def _repr_html_(self):
    """Used by frontend to generate the actual table.

    Returns:

    html representation and javascript hooks to generate the table.
    TODO(sandler): Consider generating html table, so that it is preserved
    in pynb files (instead of just being empty). This would require generating
    table as html, and then execute script on already existing table.
    """
    # implicit evalution of numpy.array into bool.  bad idea!
    if len(self.data) == 0:  # pylint: disable=g-explicit-length-test
      return 'The table is empty'
    try:
      js = self._gen_js(self.columns, self.data,
                        columns_js=self.columns_js,
                        column_filters_js=self.column_filters_js)
      return '%s<script>;setTimeout(function() {%s; }, 1) </script>' % (
          self._gen_html(),
          js)
    except Exception, e:
      print e

  def _get_tag(self):
    return self.id

  def _gen_html(self):
    """Returns html (static) part of the table."""

    save_on_click = ''
    if not self.auto_save:
      save_on_click = """
          <input type=button value=save
                onClick="document.%(id)s.saveData();
                style="align:right">"""
    html = (save_on_click + """<span id='msg%(id)s'></span>
            <table cellpadding="1"
                   cellspacing="1"
                   border="1"
                   id=%(id)s
                   style="width:100%%;border:1px solid black">
            <thead></thead>
            <tfoot style="display: table-header-group; color: gray">
               <tr></tr>
            </tfoot>
            </table>
    """)
    s = (html) % {'id': self.id}
    return s

  def listen(self):
    """Registers the current cell to execute on "save"."""
    self.listener.register()

  def _gen_js(self, columns, data, columns_js='', column_filters_js=''):
    columns = columns_js if columns_js else str(
        [{'sTitle': str(each)} for each in columns])
    auto_save = ''
    if self.auto_save:
      auto_save = 'table.bind("filter", function(v) { table.saveData();});'
    # TODO(sandler): Move somewhere where we can test all this.
    return """
      console.log("started");
      var tfooter = $('#%(id)s').find("tfoot tr");
      var columns = %(columns)s
      for (var col in columns) {
        tfooter.append("<th>" + columns[col].sTitle + "</th>");
      }
      var target_el = $('#%(id)s');
      console.log(target_el);
      var setupTable = function() {
        // This removes all event listeners from this cell!
        // We do this to prevent notebook from stealing focus
        // when user clicks on edit boxes
        // This might also remove some useful handlers, but
        // we are not aware if there are any. Re-visit as needed.
        var cell = $('#output-area');
        cell.select = selectWithoutCodeMirrorFocus;
        var table = $('#%(id)s').dataTable({ \n
            'aaData': %(data)s,\n
            'aoColumns': %(columns)s,\n
            'iDisplayLength': %(num_rows_per_page)d \n
        });
        table.saveData = function() {
          clearTimeout(table.timer);
          table.timer = setTimeout( function() {
             saveInteractiveTableData("%(tag)s", table, "%(listener_id)s")
          }, %(auto_save_timeout)s);
        };
        %(auto_save)s
        document.%(id)s = table;
        var settings = Object(%(column_filter_settings)s);
        console.log(settings)
        //settings.sPlaceHolder="head:after";
        table.columnFilter(settings);
        table.saveData();
      }
      colab.util.sequentiallyLoadJavascript(%(scripts)s,"#msg%(id)s",
        function() {
           console.log("loading after all scripts have loaded");
           loadCss(%(table_css)s);
           setupTable();
         });

    """ % {'id': self.id,
           'tag': self._get_tag(),
           'listener_id': self.listener.id,
           'num_rows_per_page': self.num_rows_per_page,
           'data': ToJsMatrix(data),
           'auto_save': auto_save,
           'columns': columns,
           'auto_save_timeout': self.auto_save_timeout,
           'column_filter_settings': column_filters_js,
           'scripts': str([JQUERY_DATATABLES,
                           JQUERY_COLUMNFILTER, INTERACTIVE_JS]),
           'table_css': str(TABLE_CSS)
          }
