var express = require('express');
var htmlDocx = require('html-docx-js');
var util = require('util');
var fs = require('fs');
const uuidv4 = require('uuid/v4');

var app = express();

// init
var server = app.listen(4000, function() {
    util.log('test listening on port ' + server.address().port);
});

// test end point
app.get('/', function(req, res) {
    console.log('doc gen test');

    var html = "<h1>Word Doc Generation</h1><h2>Test</h2>";
    
    // generate HTML for testing - TO BE REMOVED
    fs.writeFile(__dirname + "/cache/test.html", html, function (err){
    });          
    
    // convert html to use in docx
    var docx = htmlDocx.asBlob(html, {orientation: 'landscape', margins: {top: 720}});
    
    // create random filename
    var filename = uuidv4() + ".docx";
    
    // generate docx via temp file and return
    fs.writeFile(__dirname + "/cache/" + filename, docx, function (err){      
        // debug
        util.log('Generating temp file "' + filename + '"');  
    
        if (err) {
            util.log(err);
            res.sendStatus(500);
        } else {
            res.writeHead(200, {
                "Content-Type": "application/x-binary",
                "Content-Disposition": "attachment; filename=test-" + Date.now() + ".docx"
            });
    
            // debug
            util.log('Returning temp file  "' + filename + '"');  
    
            // return word doc
            fs.createReadStream(__dirname + "/cache/" + filename).pipe(res);
    
            // remove temp file
            fs.unlink(__dirname + "/cache/" + filename, function (err) {
                if (err) {
                    // debug
                    util.log(err);
                } else {
                    // debug
                    util.log('Deleting temp file   "' + filename + '"');  
                }
            }); 
        }             
    });
});

