var express = require('express');
var debug = require('debug')('m-kama');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
var path = require('path');
var favicon = require('static-favicon');
var stylus = require('stylus');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var xmlparser = require('express-xml-bodyparser');

var routes = require('./routes/index');

var app = express();

app.set('port', process.env.PORT || 3000);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.enable('view cache');
app.enable('trust proxy');
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(xmlparser());
app.use(cookieParser());
app.use(session({ store: new RedisStore({host:'redis.fr1.server.sovechkin.com', port:6379, pass:''}), secret: process.env.SECRET }))
app.use(express.static(path.join(__dirname, 'public')));
app.use(stylus.middleware({
      src: __dirname + '/stylus',
      dest: __dirname + '/public',
      compile: function(str, path) {
          return stylus(str)
            .set('compress', true);
      }
  }));

app.use('/', routes);

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


var server = app.listen(app.get('port'), function() {
  debug('Express server listening on port ' + server.address().port);
});
