FROM debian:wheezy

RUN sed -i '1i deb     http://gce_debian_mirror.storage.googleapis.com/ wheezy \
    main' etc/apt/sources.list

RUN apt-get update
# Install libraries: pip, python dev, vitualenv, zmq, ...
RUN apt-get install -y git python-pip python-dev liblapack-dev libatlas-base-dev gfortran libfreetype6-dev libpng12-dev libzmq-dev && \
  easy_install -U distribute && \
  pip install -U Cython && \
  pip install numpy scipy pandas matplotlib scikit-learn && \
  pip install patsy && \
  pip install statsmodels && \
  pip install python-gflags google-api-python-client && \
  pip install openpyxl && \
  pip install pyzmq jinja2 tornado && \
  pip install yt && \
  pip install bokeh && \
  pip install ipython[notebook] && \
  apt-get remove -y --purge python-dev libatlas-base-dev gfortran && \
  apt-get autoremove -y --purge && \
  apt-get clean -y

ADD / /colaboratory/

WORKDIR /colaboratory

# Install coLaboratory
RUN pip install -r requirements.txt

# Run
CMD python -m colaboratory --ip='*'
