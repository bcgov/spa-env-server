
# spa-env-server

Serve environment variables of server to remote SPAs (no secrets! only public info).


## Features:

1.  Receive events on a given port from a variety of sources.
2.  Log events locally in a rotating log structure in the Gluster PV attached.
3.  Retrieve environment variable (from openshift configuration of server).
4.  Allow remote access to local logs via a simple REST lookup protected by username and password for auditing


## Developer Prerequisites

* Node.js 8 or later.

First, update npm to the latest version by running:

    sudo npm install npm -g

Then run:

    npm start server

To test:

 * curl -XPOST -H "Authorization: spaenv XXX" -H "Content-Type: application/json" -d '{"body": "xyz"}' localhost:5504/log

 where XXX is the SERVICE_AUTH_TOKEN environment variable passed to the service.

## Configuration

All configuration is done via a user's shell environment variable and read in NodeJS via `process.env`.

These are:

| Environment Variable  | Description |
| --------------------- | ------------- |
| SERVICE_IP (string)           | IP address of where the service runs, defaults to 'localhost' | 
| SERVICE_PORT (number)         | port for the service, Default: 8080 | 
| SERVICE_USE_AUTH  (boolean)   | spa env server uses a token to authorize connection from a service | 
| SERVICE_AUTH_TOKEN   (string) | security token used by services to connect to spa env server |
| FILE_LOG_LEVEL  (string)      | log level for local log file, defaults to 'info' |
| LOG_DIR_NAME  (string)        | Directory path to store local log files - typically local PV mount point, ie. /var/logs |
| MONITOR_USERNAME  (string)    | username for the /monitor REST endpoint to view and download local logs |
| MONITOR_PASSWORD  (string)    | password for the /monitor REST endpoint to view and download local logs |
| MAX_FILES  (number)           | total number of log files to rotate over. Default: 10 |
| MAX_BYTE_SIZE_PER_FILE  (number) | total number of each log file. Default: (1024 * 1024 * 75) = 75mb |
| APPEND_POD_NAME_TO_FILE (boolean) | Whether the pod name should be appended to the local log file name |

The max storage size used will be `MAX_FILES * MAX_BYTES_PER_FILE`. Its default storage size is 750mb.

To view and download local log files created by the server, go to URL of the route of the spa env server followed by "/monitor".  For example:  https://spa-env-server-dev.pathfinder.gov.bc.ca/monitor

The username and password should match the environment variables configured.

## Production Setup

See [Deploy to OpenShift](openshift/README.md) docs.


## SPA Client

An SPA client wishing to use this server will make an HTTP POST request to the host/port that the spa-env-server listens on.  Typically, the following environment values are used in the client:

| Environment Variable  | Description |
| --------------------- | ------------- |
| SPA_ENV_SERVER_HOST (string)	| name of the SPA Env Server host. In OpenShift this is spa-env-server. Can be an IP address.|
| SPA_ENV_SERVER_PORT (number)	| port for the service, Default: 8080|
| SPA_ENV_AUTH_TOKEN (string)| 	security token used by clients to connect to Server|
 	 
The client creates an http POST request.  An example of a function that posts a message string in javascript:

```
TBD

function getSpaEnv (message) {

var body = JSON.stringify({
   message: message
})

var options = {
  hostname: process.env.SPA_ENV_SERVER_HOST,
  port: process.env.SPA_ENV_SERVER_PORT,
  path: '/env',
  method: 'POST',
  headers: {
     'Content-Type': 'application/json',
     'Authorization': 'spaenv ' + process.env.SPA_ENV_AUTH_TOKEN,
     'Content-Length': Buffer.byteLength(body),
     'logsource': process.env.HOSTNAME,
     'timestamp': moment().format('DD-MMM-YYYY'),
     'program': 'name of the client application',
     'serverity': 'error'
   }
};

var req = http.request(options, function (res) {
   res.setEncoding('utf8');
   res.on('data', function (chunk) {
      console.log("Body chunk: " + JSON.stringify(chunk));
   });
   res.on('end', function () {
      console.log('End of chunks');
   });
});

req.on('error', function (e) {
   console.error("error sending to spa env server: " + e.message);
});

// write data to request body
req.write(body);
req.end();
}
```
 

Notice that all POSTs are made to the path "/env" of the spa-env-server.

Also notice the format of the Authorization header as required.

## Production Setup

See [Deploy to OpenShift](openshift/README.md) docs.
