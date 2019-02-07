var express = require('express');
var util = require('util');


var app = express();

require('./reporting')(app);

var server = app.listen(4000, function() {
    util.log('wordtestAppUpdated listening on port ' + server.address().port);
});

// require('./reportTest')(app);

// test_app static files (cache) - for testing
app.use('/cache', express.static(__dirname + '/cache'));

// test end point
app.get('/', function(req, res) {
    console.log('request /');
    res.send('wordtestappupdated running... OK :)');
});




