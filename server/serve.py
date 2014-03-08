#!/usr/bin/env python
import BaseHTTPServer
import SimpleHTTPServer

server = BaseHTTPServer.HTTPServer(('127.0.0.1', 8000),
                                   SimpleHTTPServer.SimpleHTTPRequestHandler)
server.serve_forever()
