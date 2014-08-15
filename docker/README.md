A build of Jupyter coLaboratory intended to run on a server the users connect to using ssh port forwarding.

The idea is that one user sets up the server, and then multiple users can connect to the same server using ssh port forwarding. On the one hand, this means all users share the same kernel. On the other hand, it avoids having to do any authentication as connecting to the server through ssh already covers this.

Note that the server running this images should not expose port 8844 except through ssh port forwarding or some other authenticated connection, as there is no authentication in the IPython kernel itself.