/******************************** Dependencies *******************************/
'use strict';
var express = require('express');
var fs = require('fs');
var pdf = require('html-pdf');
var iconv = require('iconv-lite');
var router = express.Router();
const config = require("../../config.json");
const apiRequestHelper = require('../shared/api-request-helper');
var logger = require('../shared/logger');
const API_KEY_OBJ = require("../../API_KEY.json");
var mapping = require('../../VCAP_Mapping');
const serviceURL = config.Service_URL || mapping.Service_URL;
var request = require('request');
const API_KEY = API_KEY_OBJ.API_KEY;
const S3Config = config.S3Credentials||mapping.S3Credentials;
/* font local dir */
const fontsShareDir = '/usr/share/fonts';
const fontsLocalShareDir = '/usr/local/share/fonts';
//const bucket = process.env.S3_Bucket;
var jwt = require('jsonwebtoken');
var tokenSecret = process.env.Secret;
var _ = require('lodash');
var async = require('async');
var htmlEncode = require('htmlencode');
htmlEncode.EncodeType = 'numerical';

var htmlDocx = require('html-docx-js');
const uuidv4 = require('uuid/v4');
/*********************************Module Export***********************************/

router.get("/generateWordDocTest", function(req, res) {
    res.send('generateWordDocTest');
});

router.get("/generateWordDocTestUpdate", function(req, res) {
    // content
    var html = "<h1>Word Doc Generation</h1><h2>Test</h2>";
            
    // convert html to use in docx
    var docx = htmlDocx.asBlob(html, {orientation: 'landscape', margins: {top: 720}});

    // create random filename
    var filename = uuidv4() + ".docx";

    // generate docx via temp file and return
    fs.writeFile(__dirname + "/cache/" + filename, docx, function (err){      
        // debug
        logger.debug('Generating temp file "' + filename + '"');  

        if (err) {
            logger.debug(err);
            res.sendStatus(500);
        } else {
            res.writeHead(200, {
                "Content-Type": "application/x-binary",
                "Content-Disposition": "attachment; filename=test-" + Date.now() + ".docx"
            });

            // debug
            logger.debug('Returning temp file  "' + filename + '"');  

            // return word doc
            fs.createReadStream(__dirname + "/cache/" + filename).pipe(res);

            // remove temp file
            fs.unlink(__dirname + "/cache/" + filename, function (err) {
                if (err) {
                    // debug
                    logger.debug(err);
                } else {
                    // debug
                    logger.debug('Deleting temp file   "' + filename + '"');  
                }
            }); 
        }    
    });
});

module.exports = router;