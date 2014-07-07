"""Python wrapper for nvd3.

A thin wrapper over nvd3 javascript library.

Example usage:

nvd3.CreatePieChart({'hi':12, 'bye':34, 'now': 15, 'later': 23},
                    height=200, width='50%')


All CreateXXX functions support the following optional arguments,
'width', 'height', 'dom_id', 'x_tick_format', 'y_tick_format'.

 data  format is in the same format as nvd3 expects it, most commonly
 a list of dataseries. Each dataseries has 'key' argument which is the
 name of the series, and values, which is a list of data points.
 Each data point is a dictionary which contains 'x', 'y' keys.

"""

from colabtools import js
from IPython.display import display
from IPython.display import HTML


def xy(item):
  return {'x': item[0], 'y': item[1]}


def yx(item):
  return {'y': item[0], 'x': str(item[1])}


def RunWithD3(jsprogram):
  js.RunInContext(jsprogram,
                  ['/static/external/js/d3-min-js.js',
                   '/static/external/js/nv.d3.min.js'])


# All functions below support the following optional keyword arguments
#   height, width
#   dom_id: if provided will use existing element, rather than inserting
#     another one.


def CreateLineWithFocusChart(data, **kwargs):
  """Creates line chart with zoom.

  Args:
    data: A list of data series. For example
     [{'key': 'Example', values: [{'x' :0, 'y': 1}, {'x': 1, 'y': 2}, ... ]},
      {'key': 'Another Exampe', values: [...]}]
    **kwargs: optional parameters (see module level description)
  """
  base = ChartBase()
  chart = base.models.lineWithFocusChart()

  chart.xAxis.tickFormat(base.d3.format(',f'))
  chart.yAxis.tickFormat(base.d3.format(',.2f'))
  chart.y2Axis.tickFormat(base.d3.format(',.2f'))

  base.Render(chart, data, **kwargs)


def CreateScatterPlot(data, **kwargs):
  """Creates scatter chart.

  Args:
    data: A list of data series. See nvd3 for details. For example:
      [{'key': 'Example', values: [{'x' :0, 'y': 1, 'shape': square},
         {'x': 1, 'y': 2}, ... ]},
      {'key': 'Another Exampe', values: [...]}]

    **kwargs: optional parameters (see module level description).
     Additionally supported parameters:
     distX, distY - shows the distribution lines on axes.

  """

  base = ChartBase()
  chart = (base.models.scatterChart()
           # will display those little distribution lines on the axis.
           .showDistX(kwargs.get('distX', True))
           .showDistY(kwargs.get('distY', True))
           .transitionDuration(350)
           .color(base.d3.scale.category10().range()))

  # Axis settings
  base.SetAxisFormat(
      chart,
      kwargs,
      x_tick_format=',.2f', y_tick_format=',.2f')

  # We want to show shapes other than circles.
  chart.scatter.onlyCircles(False)
  base.Render(chart, data, **kwargs)


def CreatePieChart(data, **kwargs):
  """Creates pie chart.

  Args:
    data: A dictionary of the form {'Sold': 50, 'Discarded': 30, 'Stolen': 3}
    **kwargs: optional parameters (see module level description) for common
       parameters. Also supports
         label_type = (one of 'percent' (default), 'key', 'value')

  """
  base = ChartBase()
  chart = (base.models.pieChart().showLabels(True)
           .labelThreshold(.05).labelType(kwargs.get('label_type', 'percent'))
           .donut(True).donutRatio(0.35))
  base.Render(chart, [xy((str(each[0]), float(each[1]))) for each in data.items()], **kwargs)


def CreateMultiBarChart(data, **kwargs):
  """Multi bar char.

  Args:
    data: A list of bar chart data. Each bar chart is a dict
      with two items. 'key' name of the chart and 'values' list of xy pairs.
    **kwargs: optional parameters (see module level description).
  """
  base = ChartBase()
  chart = (base.models.multiBarChart()
           .groupSpacing(0.1).reduceXTicks(True)
           .rotateLabels(0).showControls(True))

  base.SetAxisFormat(chart, kwargs, x_tick_format=',f', y_tick_format=',.1f')

  base.Render(chart, data, **kwargs)


# Private implementation details below


def CreateElement(dom_id, width='100%', height='300px'):
  display(HTML(
      '<div id="%(id)s" style="height:%(height)s; width:%(width)s"></div>'
      % {'id': dom_id, 'width': str(width), 'height': str(height)}))


class ChartBase(object):

  def __init__(self):
    self.dom_id = 'sel_' + str(id(self))
    self.js = js.Js(mode=js.DEFERRED)
    self.d3 = self.js.d3
    self.nv = self.js.nv
    self.models = self.nv.models

  def SetAxisFormat(self, chart, user, **default):
    default.update(user)
    if 'x_tick_format' in default:
      chart.xAxis.tickFormat(self.d3.format(
          default['x_tick_format']))

    if 'y_tick_format' in default:
      chart.yAxis.tickFormat(self.d3.format(
          default['y_tick_format']))

    if 'y2_tick_format' in default:
      chart.y2Axis.tickFormat(self.d3.format(
          default['y2_tick_format']));

  def Render(self, chart, data, **kwargs):
    """Renders the chart with given data.

    Args:
      chart: JsElement style element
      data: chart-speicific data
      **kwargs: supported parameters: width, height, dom_id
    """
    width = kwargs.get('width', '100%')
    if type(width) is int:
      width = '%dpx' % width
    height = kwargs.get('height', '400px')

    if type(height) is int:
      height = '%dpx' % height

    if 'dom_id' not in kwargs:
      CreateElement(self.dom_id, width, height)
    else:
      # External domid.
      self.dom_id = kwargs.get('dom_id')

    display(HTML(
        '<link rel=stylesheet type="text/css" '
        'href="/static/external/js/src/nv.d3.css"/>'))

    (self.d3.select('#%s' % self.dom_id)
     .style('width', width).style('height', height)
     .append('svg').datum(data).transition().duration(350).call(chart))
    self.nv.utils.windowResize(chart.update)
    RunWithD3(self.js)
