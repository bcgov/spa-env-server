/*=============================================
=                Dependencies                 =
=============================================*/
const winston = require('winston');
require('winston-daily-rotate-file');
const bodyParser = require('body-parser');
const stringify = require('json-stringify-safe');
const express = require('express')
const app = express();
const fs = require('fs');
const serveIndex = require('serve-index');
const basicAuth = require('express-basic-auth')

/*=============================================
=      Environment Variable Configuration     =
=============================================*/
const SERVICE_IP = process.env.SERVICE_IP || 'localhost';
const SERVICE_PORT = process.env.SERVICE_PORT || 8080;
const FILE_LOG_LEVEL = process.env.FILE_LOG_LEVEL || 'info';
const HOST_NAME = process.env.HOSTNAME || '?'
const SERVICE_AUTH_TOKEN = process.env.SERVICE_AUTH_TOKEN || 'NO_TOKEN';
const USE_AUTH = checkEnvBoolean(process.env.SERVICE_USE_AUTH);
const MONITOR_USERNAME = process.env.MONITOR_USERNAME || '';
const MONITOR_PASSWORD = process.env.MONITOR_PASSWORD || '';

//Defaults to use 750mb total storage.
const MAX_FILES = parseInt(process.env.MAX_FILES, 10) || 10;
const MAX_BYTE_SIZE_PER_FILE = parseInt(process.env.MAX_BYTE_SIZE_PER_FILE, 10) || (1024 * 1024 * 75)

//Should not end with a /, "/var/logs" or "logs" is good.
const LOG_DIR_NAME = process.env.LOG_DIR_NAME || null;
const APPEND_POD_NAME_TO_FILE = (process.env.APPEND_POD_NAME_TO_FILE == 'true');
const FILE_LOG_NAME = LOG_DIR_NAME ?
    LOG_DIR_NAME + '/spaenv' + (APPEND_POD_NAME_TO_FILE ? '-' + HOST_NAME : '') + '.log'
    : './logs/spaenv' + (APPEND_POD_NAME_TO_FILE ? '-' + HOST_NAME : '') + '.log';


/*=============================================
=            APPLICATION CONFIGURATION        =
=============================================*/
// turn off self-cert check
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Daily rotate file transport for logs
var transport = new winston.transports.DailyRotateFile({
    filename: FILE_LOG_NAME,
    datePattern: 'yyyy-MM-DD',
    prepend: true,
    level: FILE_LOG_LEVEL,
    timestamp: true,
    maxsize: MAX_BYTE_SIZE_PER_FILE,
    maxFiles: MAX_FILES,
});

// Winston Logger init
var winstonLogger = winston.createLogger({
    level: FILE_LOG_LEVEL,
    transports: [
        new winston.transports.Console({ timestamp: true }),
        transport
    ]
});

winstonLogger.error = function (err, context) {
    winstonLogger.error('SPA Env Server error:' + err + ' context:' + context);
};

// remove console if not in debug mode
if (FILE_LOG_LEVEL != 'debug') {
    winston.remove(winston.transports.Console);
}


/*=============================================
=              Main Application               =
=============================================*/
// Init app
if (process.env.NODE_ENV != 'production' ||
    process.env.CORS_ALLOW_ALL == 'true') {
    app.use(function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
        next();
    });
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
var args = process.argv;

if (args.length == 3 && args[2] == 'server') {
    var server = app.listen(SERVICE_PORT, SERVICE_IP, function() {
        var host = server.address().address;
        var port = server.address().port;
        winstonLogger.info('START SPA Env Server host(' + HOST_NAME
            + ') loglevel(' + FILE_LOG_LEVEL + ') fileLocation(' + FILE_LOG_NAME + ')');
    });
}

// handle posts to /env endpoint
app.post('/env', function (req, res) {
    getSPAEnvValue(req).then(function (envValue) {
        res.status(200);
        return res.send(envValue);
    }).catch(function(envValue) {
        res.status(403);
        return res.send(envValue);
    });
});

//Setup the password protected /monitor
winstonLogger.debug('Serving index files from ' + LOG_DIR_NAME);
const users = {};
users[MONITOR_USERNAME] = MONITOR_PASSWORD;
app.get('/monitor', basicAuth({
   users,
   challenge: true, //Show popup box asking for credentials
}));
app.use('/monitor', serveIndex(LOG_DIR_NAME));
app.use('/monitor', express.static(LOG_DIR_NAME, {
  //Get browser to display instead of download weird filenames, *.log.1
  setHeaders: (res, path, stat) => {
    winstonLogger.debug('Getting monitored files for ' + LOG_DIR_NAME);
    res.set('content-type', 'text/plain; charset=UTF-8')
  }
}));
app.use(function (err, req, res, next) {
    winstonLogger.info(err, req);
    res.status(500).send('An error has occured: ' + err);
});
winstonLogger.info('SPA Env Server started on host: ' +  SERVICE_IP + '  port: ' + SERVICE_PORT);


// get a log
var getSPAEnvValue = function (req) {
    return new Promise(function (resolve, reject) {
        var authorized = false;

        if (USE_AUTH && req.get('Authorization') === 'spaenv ' + SERVICE_AUTH_TOKEN) {
            authorized = true;
        };
        if (authorized || !USE_AUTH) {
            // extract stuff
            const envName = req.get('SPA_ENV_NAME');
            const host = req.get('host') || '?'
            const logsource = req.get('logsource') || '?'
            const fhost = req.get('http_x_forwarded_host') || '?'
            const program = req.get('program') || '?'
            const times = req.get('timestamp') || '?'
            const http_host = req.get('http_host') || '?';
            const method = req.get('request_method') || '?';
            const forwarded = req.get('http_x_forwarded_for') || '?';
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '?'
            const browser = req.headers['user-agent'];
            //todo: Verify! Screenshots showed severity_label.
            const severity = req.get('severity') || '?' //orig
            const severityLabel = req.get('severity_label') || '?' //from screenshot

            const logString = 'program(' + program + ') envName(' + envName
                + ') host(' + host + ') logsource(' + logsource + ') fhost(' + fhost
                + ') severity(' + severity + ') method(' + method + ') times(' + times
                + ') browser(' + browser + ') sourceIP(' + ip + ') http_host(' + http_host
                + ') http_x_forwarded_for(' + forwarded + ') pod(' + HOST_NAME + ')';

            // write to local filesystem
            winstonLogger.info(logString);

            // get the environment variable requested
            // there are two cases:
            // 1. A single env names with a name starting with SPA_ENV_
            // 2. A json collection of env names with each name starting with SPA_ENV_
            if (envName && envName.length > 8 && envName.substring(0, 8) === 'SPA_ENV_') {
                if (! isEmpty(process.env[envName]))
                    resolve(process.env[envName]);
                else
                    reject('Forbidden');
            }
            else if (envName && envName.length > 10 && envName.substring(0, 1) === '{') {
                // json
                var keys = JSON.parse(envName);
                for (var key in keys) {
                    if (keys.hasOwnProperty(key) && key.length > 8 && key.substring(0, 8) === 'SPA_ENV_') {
                        if (! isEmpty(process.env[key]))
                            keys[key] = process.env[key];
                    }
                }
                resolve (keys);
            }
            else
                reject('Forbidden');
        }
        else {
            winstonLogger.info('unauthorized');
            winstonLogger.debug('received with headers: ', req.headers);
            reject('Forbidden');
        }
    }, function(err) {
        winstonLogger.info('error: ' + err);
        reject('Forbidden');
    });
};

exports.getSPAEnvValue = getSPAEnvValue;


function checkEnvBoolean(env){
    return env && env.toLowerCase() === 'true';
}

function isEmpty(value) {
    return typeof value == 'string' && !value.trim() || typeof value == 'undefined' || value == null || value === '';
}