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

var server = app.listen(4000, function() {
    util.log('wordtestAppUpdated listening on port ' + server.address().port);
});

// test_app static files (cache) - for testing
app.use('/cache', express.static(__dirname + '/cache'));

// test end point
app.get('/', function(req, res) {
    console.log('request /');
    res.send('wordtestappupdated running... OK');
});


app.get('/api/createWordDoc', function (req, res) {
    // debug
    util.log('-----------------------');
    util.log('NF Word Doc Download requested');

    var promises = [];
    var fileNameList = new ArrayList();
    var imageDetails = new ArrayList();
    var s3 = new AWS.S3();

    var getObject = function(imageNmae) {
        return new Promise(function(success, reject) {
            s3.getObject(
                { Bucket: "smc-bucket1", Key: imageNmae }, 
                function (error, data) {
                    if(error) {
                        reject(error);
                    } else {
                        data.Filename = imageNmae;
                        data.base64 = data.Body.toString('base64');
                        
                        // debug
                        //util.log(imageNmae + ' - image downloaded');
                        
                        var download = S3S.ReadStream(new S3(), {
                            Bucket: "smc-bucket1", Key: imageNmae
                        });

                        //console.log(download);

                        // get image size and calc resize
                        probe(download, function (err, result) {

                            // debug
                            //util.log(imageNmae + ' - image size date recieved');

                            var newWidth = 230;

                            data.width = newWidth;
                            data.height = calImageHeight(result.width, result.height, newWidth);

                            success(data);
                        });                        
                    }
                }
            )
        });
    }    

    // test images
    fileNameList.add([
        'test/image1.gif',
        'test/image1.gif',
        'test/image2.jpg',
        'test/image3.jpg',        
        'test/image4.jpg',
        'test/image5.jpg',
        'test/image6.jpg',
        'test/image7.png',
        'test/image8.png',
        'test/image9.jpg'                     
    ]);
    
    // debug
    //util.log(' ----- IMAGE DOWNLOAD STARTED...');

    for(var i = 0; i < fileNameList.length; i++){
        promises.push(getObject(fileNameList.get(i)));
        //util.log('getting image - ' + fileNameList.get(i));
    }
    
    Promise.all(promises)
    .then(function(results) {
        for(var index in results) {
            var data = results[index];
            imageDetails.add(data);
        }

        // debug
        util.log('All required images downloaded from s3');
        
        var content = '<style type="text/css">'+
        '@font-face {'+
            'font-family: "Calibri";'+
            'src: url("fonts/Calibri.ttf") format("truetype");'+
        '}'+
        '@font-face {'+
            'font-family: "ArialBold";'+
            'src: url("fonts/arialbd.ttf") format("truetype");'+
        '}'+
        '@font-face {'+
            'font-family: "Arial";'+
            'src: url("fonts/arial.ttf") format("truetype");'+
        '}'+
        '.WordSection{padding:0 0.3in; color:#000000; }'+
        '.WordSection h1{font-family:"ArialBold"; font-weight: bold; font-size:11pt; margin:0 0 5pt 0; color:#666666; border-bottom:solid 1px rgb(167,25,48); padding-bottom:1pt;}'+
        '.WordSection h2{font-family:"ArialBold"; font-weight: bold; font-size:9pt; color:#000000; margin-left:0.18in; margin-bottom:6pt; margin-top:0;}'+
        '.WordSection h3{font-family:"ArialBold"; font-weight: bold; font-size:9pt; color:rgb(167,25,48); margin-left:0.18in; margin-bottom:6pt; margin-top:0;}'+
        '.WordSection ul{margin-top:0; margin-bottom:10pt; margin-left:0.12in; margin-right:0; font-size:8pt; font-family:Calibri;}'+
        '.WordSection ul li{margin-bottom:3pt;}'+
        '.WordSection ul li .newsfeed-img{width:230px; max-height:180px; float:left; text-align:center; margin-top:5px;}'+
        '.WordSection ul li .newsfeed-img img{max-width:100%; max-height:100%;}'+
        '.print-header{border-bottom:solid 1px #000000; color:#000000; padding:4pt 0; font-size:7pt; font-family:Arial; margin: 0 0.3in;}'+
        '.print-footer{border-top:solid 1px #000000; color:#000000; padding:4pt 0; font-size:7pt; font-family:Arial; margin: 0 0.3in;}'+
        '.red-text{color:rgb(167,25,48);}'+
        '.datetime-color{color:#A6AAA9;}'+
        '.right-element{float: right; text-align:right;}'+
        '.page-break{ display: block; page-break-before: always;}'+
        '.clearfix{clear:both; height:0;}'+
        '</style>';

        content+= '<div class="WordSection">';
        content+= '<h1>AWS Project - Last 2 Weeks</h1>';
        content+= '<h2>SIMON MCALOON - Author+</h2>';
        content+= '<h3>Key Achievements</h3>';
        content+= '<ul>';
        content+= '<li>';
        content+= '<sub class="datetime-color"> &ndash; datetime</sub>';



        for(var i = 0; i < imageDetails.length; i++) {
            var image = imageDetails[i];
            content += '<div><img width="' + image.width + '" height="' + image.height + '" src="data:image/png;base64,' + image.base64 + '" alt=""></div>';
            
            //console.log('image' + i);

            if(i != 0 && i % 2 != 0 && i != imageDetails.length -1) {
                content += '<br style="page-break-before: always; clear: both" />';    
                //console.log('PAGE BREAK');
            }
        }

        content+= '</li>';
        content+= '</ul>';
        content+='</div>';    

        var html = content;

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

        // generate docx via stream and retunr 
        // TO DO        

    })
    .catch(function(err) {
        util.log(err);
    });
});

function calImageHeight(width, height, newWidth) {
    var aspectRatio = width / height;
    return newWidth / aspectRatio;    
}
