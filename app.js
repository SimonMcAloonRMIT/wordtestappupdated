var express = require('express');
var util = require('util');
var htmlDocx = require('html-docx-js');
var fs = require('fs');
const uuidv4 = require('uuid/v4');
var AWS = require('aws-sdk');
var S3 = require('aws-sdk').S3;
var S3S = require('s3-streams');
var ArrayList = require('arraylist');
var probe = require('probe-image-size');

var app = express();

require('./reportTest')(app);

var server = app.listen(4000, function() {
    util.log('wordtestAppUpdated listening on port ' + server.address().port);
});

// require('./reportTest')(app);

// test_app static files (cache) - for testing
app.use('/cache', express.static(__dirname + '/cache'));

// test end point
app.get('/', function(req, res) {
    console.log('request /');
    res.send('wordtestappupdated running... OK');
});



function calImageHeight(width, height, newWidth) {
    var aspectRatio = width / height;
    return newWidth / aspectRatio;    
}
