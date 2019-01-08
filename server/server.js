'use strict';
var loopback = require('loopback');
var boot = require('loopback-boot');
var express = require('express');
var app = module.exports = loopback();
var path = require("path");
var fileapp = express();
var notifications = require("./services/notifications")();

fileapp.use('/files/responseImages', express.static(path.resolve(__dirname, '../storage/responseImages')));
fileapp.use('/files/userProfileImages', express.static(path.resolve(__dirname, '../storage/userProfileImages')));
app.start = function () {
    fileapp.listen(5500);
    // start the web server
    return app.listen(function () {
        app.emit('started');
        var baseUrl = app.get('url').replace(/\/$/, '');
        console.log('Web server listening at: %s', baseUrl);
        notifications.init();
        if (app.get('loopback-component-explorer')) {
            var explorerPath = app.get('loopback-component-explorer').mountPath;
            console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
        }
    });
};
app.middleware('initial', '/api/*', function logResponse(req, res, next) {
    // same code as sample # 2 
    console.log("ooo some request");
    next();
});
// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function (err) {
    if (err) throw err;
    // start the server if `$ node server.js`
    if (require.main === module) app.start();
});