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
/*********************************Module Export***********************************/

router.get("/generateWordDocTest", function(req, res) {
    res.send('generateWordDocTest');
});

// Taken from PDF_Creation.js for testeing 
router.post("/createPDFHtmlPdfPreviewReport", function(req, res) {
	let data = req.body;
	let filename = data.filename;
	let dataOptions = (data.dataOptions)?data.dataOptions:{};
	let printOptions = (data.printOptions)?data.printOptions:{};
	let testExp=/^[a-zA-Z0-9 ]*$/;
	let testExp2=/^[a-zA-Z0-9. ]*$/;
	if(req.headers.$wssid != dataOptions.loggedInUserID) return res.status(401).send("Session and Userinfo mismatched");
	if(typeof dataOptions.projectEntityID !="number" || typeof dataOptions.projectPhaseId !="number" || typeof dataOptions.reportMonth !="number" || typeof dataOptions.reportStatusID !="number" ||
			typeof dataOptions.checkRAGStatus !="boolean" || typeof dataOptions.checkSensitive !="boolean" || typeof dataOptions.checkShowCostSchDetailReport !="boolean" || 
			typeof dataOptions.checkShowSummaryReport !="boolean" || typeof dataOptions.checkShowWSDetailReport !="boolean" || typeof dataOptions.includeFS !="boolean" || 
			typeof dataOptions.sensitive !="boolean" || !(testExp.test( dataOptions.costRAGStatus)) || !(testExp.test( dataOptions.hseRAGStatus)) || 
			!(testExp.test( dataOptions.piRAGStatus)) || !(testExp.test( dataOptions.riskRAGStatus)) || !(testExp.test( dataOptions.scheduleRAGStatus)) || !(testExp2.test(filename)) ||
			!(testExp.test( dataOptions.monthName)) || !(testExp.test( printOptions.format)) || !(testExp.test( printOptions.orientation)) ){
		return res.status(401).send("invalid parameters");
	}
	if(printOptions.header){if(!(testExp2.test( printOptions.header.height))) return res.status(401).send("invalid print options");}
	if(printOptions.footer){if(!(testExp2.test( printOptions.footer.height))) return res.status(401).send("invalid print options");}
	let timeOut = 1000000;
	var basepath = dirNameBase + '/public/';
	var html = '';
	var headerContents = '';
	var footerContents = '';
	var finalOptions = {
		format: (printOptions.format ? printOptions.format : 'A3'),
		orientation: (printOptions.orientation ? printOptions.orientation : 'landscape'),
		quality: (printOptions.quality ? printOptions.quality : 100),
		border: (printOptions.border ? printOptions.border : 0),
		timeout: (printOptions.timeout ? printOptions.timeout : timeOut),
		header: {
			height: (printOptions.header.height ? printOptions.header.height : '0.15in'),
			contents: headerContents
		},
		footer: {
			height: (printOptions.footer.height ? printOptions.footer.height : '0.5in'),
		    contents: footerContents
		},
		base: "file://" + basepath
	};
	res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
	res.setHeader('Content-type', 'application/pdf');
	if(req.headers.$wssid != dataOptions.loggedInUserID) return res.status(401).send("Session and Userinfo mismatched");
	    var auth={};
	    auth['userID']=req.headers.$wssid;
	    auth['internal']=true;
	    var token = jwt.sign(auth, tokenSecret, { expiresIn: 60 });
	    let url = serviceURL.PROJECT_INSIGHT_DASHBOARD + '/getReportHeaderPrintForReport';
	    apiRequestHelper.post(url, { 'loggedInUserID': dataOptions.loggedInUserID, 'projectEntityID': dataOptions.projectEntityID, 'reportEntityID': dataOptions.projectPhaseId,
	    	'reportStatusID': dataOptions.reportStatusID }, token, (error, result) => {
	    		var reportPrintHeader = result[0];
	    		reportPrintHeader.monthName = dataOptions.monthName;
	    		var executiveSummary = '';
	    		var KAInsights = [];
				var KIInsights = [];
				var FPInsights = [];
				var acceptedYTD = '';
	    		var satisfactoryYTD = '';
	    		var actionsYTD = '';
				var printTopRisks = [];
				var printSchedule = '';
				var printScheduleCommentary = '';
	    		var printHse = '';
	    		var printHSECommentary = '';
	    		var costCommentary = '';
	    		var costData = {};
	    		var reportAllWorkstreamDetail = [];
	    		var TotalProgressDetail = {};
				var workstreamProgressDetail = [];
				var responseforRiskImg;
				var responseforSchProgressImg;
				var responseforSchProgressStatusImg;
				var responseforHSEImg;
				var responseforCostPhaseImg;
				var responseforCostAnnualImg;
				var responseforSchWrkStreamIdImg = [];
				var responseforMasterImg;
		    	var responseforFlaggedImg;
		    	var fundingSrcCount;
		    	var responseforCostLargeAllImg;
	    		logger.debug("Api Response Received", result);
	    if(dataOptions.moduleAccessPermissions.insightPermissions.showModule){
	    	 let url = serviceURL.PROJECT_INSIGHT_DASHBOARD + '/getProjectInsightForReport';
	    	    apiRequestHelper.post(url, { 'loggedInUserID': dataOptions.loggedInUserID, 'projectEntityID': dataOptions.projectEntityID, 'reportEntityID': dataOptions.projectPhaseId,
	    	    	'reportStatusID': dataOptions.reportStatusID, 'reportMonth': dataOptions.reportMonth }, token, (error, result) => {
	    	            if (error) { return res.send(error); }
	    	            executiveSummary = result[0].ModuleSummary.replace(/(&lt;)/g, '<').replace(/(&gt;)/g, '>').replace(/(&#10;)/g, '<br/>').replace(/(&#34;)/g, '"').replace(/(&amp;)/g, '&').replace(/(&#8211;)/g, '–').replace(/(&#8220;)/g, '"').replace(/(&#8221;)/g, '"').replace(/(&#8216;)/g, "'").replace(/(&#8217;)/g, "'");
	    	            for(var i = 0; i < result[0].Insights.length; i++){
							if (result[0].Insights[i].INSIGHT_TYPE_ID == 1) {
								for (var j =0; j< result[0].Insights[i].InsightList.length; j++) {
									if (result[0].Insights[i].InsightList[j].TOP_SELECTED_PUBLISH_FLAG) {
										KAInsights.push(result[0].Insights[i].InsightList[j]);
									}
								}
							} else if (result[0].Insights[i].INSIGHT_TYPE_ID == 2) {
								for (var j =0; j< result[0].Insights[i].InsightList.length; j++) {
									if (result[0].Insights[i].InsightList[j].TOP_SELECTED_PUBLISH_FLAG) {
										KIInsights.push(result[0].Insights[i].InsightList[j]);
									}
								}
							} else if (result[0].Insights[i].INSIGHT_TYPE_ID == 3) {
								for (var j =0; j< result[0].Insights[i].InsightList.length; j++) {
									if (result[0].Insights[i].InsightList[j].TOP_SELECTED_PUBLISH_FLAG) {
										FPInsights.push(result[0].Insights[i].InsightList[j]);
									}
								}
							}
						}
	    	        });
	    		}
	    if(dataOptions.moduleAccessPermissions.insightPermissions.showModule || dataOptions.moduleAccessPermissions.schedulePermissions.showModule){
	    	 let url = serviceURL.PROJECT_INSIGHT_DASHBOARD + '/getProjectInsightForReport';
	    	    apiRequestHelper.post(url, { 'loggedInUserID': dataOptions.loggedInUserID, 'projectEntityID': dataOptions.projectEntityID, 'reportEntityID': dataOptions.projectPhaseId,
	    	    	'reportStatusID': dataOptions.reportStatusID, 'reportMonth': dataOptions.reportMonth , "dashboardSize": "LARGE"}, token, (error, result) => {
	    	    		//logger.debug('result for getProjectInsightForReport = ' , result);
	    	    		reportAllWorkstreamDetail = result[0].Insights;
	    	    		fundingSrcCount = 0;
	    				var fundingSrcId = reportAllWorkstreamDetail[0].FUNDING_SOURCE_ID;
	    				for (var i =1; i< reportAllWorkstreamDetail.length; i++) {
	    					if (fundingSrcId != reportAllWorkstreamDetail[i].FUNDING_SOURCE_ID) {
	    						fundingSrcCount = fundingSrcCount + 1;
	    						break;
	    					}
	    				}
	    	    	});
	    	    setTimeout(function(){
	    	    	if (reportAllWorkstreamDetail.length == 1) {
	    	    		var wrkStreamImgUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		let urlforSchWrkStreamIdImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    	    var authforImg={};
	    	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    	    authforImg['Newsfeed']=true;
	    	    	    var responseforSchWrkStreamIdImgSingle;
	    	    	    var responseforCostWrkStreamIdImgSingle;
	    			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	    	apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	    	responseforSchWrkStreamIdImgSingle = result;
	    	    	    	apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
			    	    	    responseforCostWrkStreamIdImgSingle = result;
		    	    	    	var responseforSchWrkStreamIdImgSingleObj = {"wrkStreamId" : reportAllWorkstreamDetail[0].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingle, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingle};
		    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObj);
		    	    	    	let urlforCostCommentary = serviceURL.COST_WORKBENCH + '/fetchCostProgressForWorkStreamA3report';
		    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
		    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[0].WorkstreamID}, tokenforImg, (error, result) => {
		    	        	    		reportAllWorkstreamDetail[0].CostProgress = result.costProgress;
		    	        	    	});
		    	    	    	});
	    	    	    	 });
	    	    	    		    	    	   
    	    		} else if (reportAllWorkstreamDetail.length == 2) {
	    	    		var wrkStreamImgUrlforOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		let urlforSchWrkStreamIdImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    	    var authforImg={};
	    	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    	    authforImg['Newsfeed']=true;
	    	    	    var responseforSchWrkStreamIdImgSingleOne;
	    	    	    var responseforSchWrkStreamIdImgSingleTwo;
	    	    	    var responseforCostWrkStreamIdImgSingleOne;
	    	    	    var responseforCostWrkStreamIdImgSingleTwo;    			    
	    			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	    	apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	    		responseforSchWrkStreamIdImgSingleOne = result;
	    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
		    	    	    		responseforSchWrkStreamIdImgSingleTwo = result;
		    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
			    	    	    		responseforCostWrkStreamIdImgSingleOne = result;	
			    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	    	    		responseforCostWrkStreamIdImgSingleTwo = result;
				    	    	    		var responseforSchWrkStreamIdImgSingleObjOne = {"wrkStreamId" : reportAllWorkstreamDetail[0].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleOne, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleOne};
					    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjOne);	    	
					    	    	    	var responseforSchWrkStreamIdImgSingleObjTwo = {"wrkStreamId" : reportAllWorkstreamDetail[1].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleTwo, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleTwo};
					    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjTwo);
					    	    	    	let urlforCostCommentary = serviceURL.COST_WORKBENCH + '/fetchCostProgressForWorkStreamA3report';
					    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
					    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[0].WorkstreamID}, tokenforImg, (error, result) => {
					    	        	    		reportAllWorkstreamDetail[0].CostProgress = result.costProgress;
					    	        	    	});
					    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
					    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[1].WorkstreamID}, tokenforImg, (error, result) => {
					    	        	    		reportAllWorkstreamDetail[1].CostProgress = result.costProgress;
					    	        	    	});
					    	    	    });
				    	    	    });
			    	    	    });
	    	    	    	});	    	    	    		    	    	    		    	    	    		    	    	    	
    	    		} else if (reportAllWorkstreamDetail.length == 3) {
	    	    		var wrkStreamImgUrlforOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		let urlforSchWrkStreamIdImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    	    var authforImg={};
	    	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    	    authforImg['Newsfeed']=true;
	    	    	    var responseforSchWrkStreamIdImgSingleOne;
	    	    	    var responseforSchWrkStreamIdImgSingleTwo;
	    	    	    var responseforCostWrkStreamIdImgSingleOne;
	    	    	    var responseforCostWrkStreamIdImgSingleTwo;    
	    	    	    var responseforSchWrkStreamIdImgSingleThree;
	    	    	    var responseforCostWrkStreamIdImgSingleThree;    
	    			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	    	apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	    		responseforSchWrkStreamIdImgSingleOne = result;
	    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
		    	    	    		responseforSchWrkStreamIdImgSingleTwo = result;
		    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
			    	    	    		responseforSchWrkStreamIdImgSingleThree = result;
			    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	    	    		responseforCostWrkStreamIdImgSingleOne = result;	
				    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
					    	    	    		responseforCostWrkStreamIdImgSingleTwo = result;
					    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
						    	    	    		responseforCostWrkStreamIdImgSingleThree = result;
						    	    	    		var responseforSchWrkStreamIdImgSingleObjOne = {"wrkStreamId" : reportAllWorkstreamDetail[0].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleOne, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleOne};
							    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjOne);	    	
							    	    	    	var responseforSchWrkStreamIdImgSingleObjTwo = {"wrkStreamId" : reportAllWorkstreamDetail[1].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleTwo, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleTwo};
							    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjTwo);
							    	    	    	var responseforSchWrkStreamIdImgSingleObjThree = {"wrkStreamId" : reportAllWorkstreamDetail[2].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleThree, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleThree};
								    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjThree);
								    	    	    let urlforCostCommentary = serviceURL.COST_WORKBENCH + '/fetchCostProgressForWorkStreamA3report';
							    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
							    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[0].WorkstreamID}, tokenforImg, (error, result) => {
							    	        	    		reportAllWorkstreamDetail[0].CostProgress = result.costProgress;
							    	        	    	});
							    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
							    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[1].WorkstreamID}, tokenforImg, (error, result) => {
							    	        	    		reportAllWorkstreamDetail[1].CostProgress = result.costProgress;
							    	        	    	});
							    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
							    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[2].WorkstreamID}, tokenforImg, (error, result) => {
							    	        	    		reportAllWorkstreamDetail[2].CostProgress = result.costProgress;
							    	        	    	});
							    	    	    });
						    	    	    });
					    	    	    });
				    	    	    });
			    	    	    });
	    	    	    	});	    	    	    	
    	    		} else if (reportAllWorkstreamDetail.length == 4) {
	    	    		var wrkStreamImgUrlforOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforFour = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[3].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlFour = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[3].WorkstreamID + '.png';
	    	    		let urlforSchWrkStreamIdImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    	    var authforImg={};
	    	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    	    authforImg['Newsfeed']=true;
	    	    	    var responseforSchWrkStreamIdImgSingleOne;
	    	    	    var responseforSchWrkStreamIdImgSingleTwo;
	    	    	    var responseforCostWrkStreamIdImgSingleOne;
	    	    	    var responseforCostWrkStreamIdImgSingleTwo;    
	    	    	    var responseforSchWrkStreamIdImgSingleThree;
	    	    	    var responseforCostWrkStreamIdImgSingleThree;    
	    	    	    var responseforSchWrkStreamIdImgSingleFour;
	    	    	    var responseforCostWrkStreamIdImgSingleFour;    
	    			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	    	apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	    		responseforSchWrkStreamIdImgSingleOne = result;
	    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
		    	    	    		responseforSchWrkStreamIdImgSingleTwo = result;
		    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
			    	    	    		responseforSchWrkStreamIdImgSingleThree = result;
			    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforFour, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	    	    		responseforSchWrkStreamIdImgSingleFour = result;
				    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
					    	    	    		responseforCostWrkStreamIdImgSingleOne = result;		
					    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
						    	    	    		responseforCostWrkStreamIdImgSingleTwo = result;
						    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
							    	    	    		responseforCostWrkStreamIdImgSingleThree = result;
							    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlFour, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
								    	    	    		responseforCostWrkStreamIdImgSingleFour = result;
								    	    	    		var responseforSchWrkStreamIdImgSingleObjOne = {"wrkStreamId" : reportAllWorkstreamDetail[0].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleOne, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleOne};
									    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjOne);	    	
									    	    	    	var responseforSchWrkStreamIdImgSingleObjTwo = {"wrkStreamId" : reportAllWorkstreamDetail[1].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleTwo, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleTwo};
									    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjTwo);
									    	    	    	var responseforSchWrkStreamIdImgSingleObjThree = {"wrkStreamId" : reportAllWorkstreamDetail[2].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleThree, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleThree};
										    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjThree);
										    	    	    var responseforSchWrkStreamIdImgSingleObjFour = {"wrkStreamId" : reportAllWorkstreamDetail[3].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleFour, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleFour};
										    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjFour);
										    	    	    let urlforCostCommentary = serviceURL.COST_WORKBENCH + '/fetchCostProgressForWorkStreamA3report';
									    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
									    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[0].WorkstreamID}, tokenforImg, (error, result) => {
									    	        	    		reportAllWorkstreamDetail[0].CostProgress = result.costProgress;
									    	        	    	});
									    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
									    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[1].WorkstreamID}, tokenforImg, (error, result) => {
									    	        	    		reportAllWorkstreamDetail[1].CostProgress = result.costProgress;
									    	        	    	});
									    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
									    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[2].WorkstreamID}, tokenforImg, (error, result) => {
									    	        	    		reportAllWorkstreamDetail[2].CostProgress = result.costProgress;
									    	        	    	});
									    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
									    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[3].WorkstreamID}, tokenforImg, (error, result) => {
									    	        	    		reportAllWorkstreamDetail[3].CostProgress = result.costProgress;
									    	        	    	});
									    	    	    });
								    	    	    });
							    	    	    });
						    	    	    });
					    	    	    });
				    	    	    });
			    	    	    });
	    	    	    	});	    	    	    	
    	    		}  else if (reportAllWorkstreamDetail.length == 5) {
	    	    		var wrkStreamImgUrlforOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforFour = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[3].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforFive = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[4].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlFour = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[3].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlFive = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[4].WorkstreamID + '.png';
	    	    		let urlforSchWrkStreamIdImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    	    var authforImg={};
	    	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    	    authforImg['Newsfeed']=true;
	    	    	    var responseforSchWrkStreamIdImgSingleOne;
	    	    	    var responseforSchWrkStreamIdImgSingleTwo;
	    	    	    var responseforCostWrkStreamIdImgSingleOne;
	    	    	    var responseforCostWrkStreamIdImgSingleTwo;    
	    	    	    var responseforSchWrkStreamIdImgSingleThree;
	    	    	    var responseforCostWrkStreamIdImgSingleThree;    
	    	    	    var responseforSchWrkStreamIdImgSingleFour;
	    	    	    var responseforCostWrkStreamIdImgSingleFour;    
	    	    	    var responseforSchWrkStreamIdImgSingleFive;
	    	    	    var responseforCostWrkStreamIdImgSingleFive;    
	    			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	    	apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	    		responseforSchWrkStreamIdImgSingleOne = result;
	    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
		    	    	    		responseforSchWrkStreamIdImgSingleTwo = result;
		    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
			    	    	    		responseforSchWrkStreamIdImgSingleThree = result;
			    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforFour, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	    	    		responseforSchWrkStreamIdImgSingleFour = result;
				    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforFive, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
					    	    	    		responseforSchWrkStreamIdImgSingleFive = result;
					    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
						    	    	    		responseforCostWrkStreamIdImgSingleOne = result;
						    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
							    	    	    		responseforCostWrkStreamIdImgSingleTwo = result;
							    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
								    	    	    		responseforCostWrkStreamIdImgSingleThree = result;
								    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlFour, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
									    	    	    		responseforCostWrkStreamIdImgSingleFour = result;
									    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlFive, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
										    	    	    		responseforCostWrkStreamIdImgSingleFive = result;
										    	    	    		var responseforSchWrkStreamIdImgSingleObjOne = {"wrkStreamId" : reportAllWorkstreamDetail[0].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleOne, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleOne};
											    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjOne);	    	
											    	    	    	var responseforSchWrkStreamIdImgSingleObjTwo = {"wrkStreamId" : reportAllWorkstreamDetail[1].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleTwo, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleTwo};
											    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjTwo);
											    	    	    	var responseforSchWrkStreamIdImgSingleObjThree = {"wrkStreamId" : reportAllWorkstreamDetail[2].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleThree, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleThree};
												    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjThree);
												    	    	    var responseforSchWrkStreamIdImgSingleObjFour = {"wrkStreamId" : reportAllWorkstreamDetail[3].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleFour, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleFour};
												    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjFour);
												    	    	    var responseforSchWrkStreamIdImgSingleObjFive = {"wrkStreamId" : reportAllWorkstreamDetail[4].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleFive, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleFive};
												    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjFive);
												    	    	    let urlforCostCommentary = serviceURL.COST_WORKBENCH + '/fetchCostProgressForWorkStreamA3report';
											    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
											    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[0].WorkstreamID}, tokenforImg, (error, result) => {
											    	        	    		reportAllWorkstreamDetail[0].CostProgress = result.costProgress;
											    	        	    	});
											    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
											    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[1].WorkstreamID}, tokenforImg, (error, result) => {
											    	        	    		reportAllWorkstreamDetail[1].CostProgress = result.costProgress;
											    	        	    	});
											    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
											    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[2].WorkstreamID}, tokenforImg, (error, result) => {
											    	        	    		reportAllWorkstreamDetail[2].CostProgress = result.costProgress;
											    	        	    	});
											    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
											    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[3].WorkstreamID}, tokenforImg, (error, result) => {
											    	        	    		reportAllWorkstreamDetail[3].CostProgress = result.costProgress;
											    	        	    	});
											    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
											    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[4].WorkstreamID}, tokenforImg, (error, result) => {
											    	        	    		reportAllWorkstreamDetail[4].CostProgress = result.costProgress;
											    	        	    	});
											    	    	    });
										    	    	    });
									    	    	    });
								    	    	    });
							    	    	    });
						    	    	    });
					    	    	    });
				    	    	    });
			    	    	    });
	    	    	    	});	    	    	    	
    	    		}  else if (reportAllWorkstreamDetail.length == 6) {
	    	    		var wrkStreamImgUrlforOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforFour = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[3].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforFive = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[4].WorkstreamID + '.png';
	    	    		var wrkStreamImgUrlforSix = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Schedule-' + reportAllWorkstreamDetail[5].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlOne = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[0].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlTwo = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[1].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlThree = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[2].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlFour = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[3].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlFive = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[4].WorkstreamID + '.png';
	    	    		var wrkStreamCostImgUrlSix = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLarge-' + reportAllWorkstreamDetail[5].WorkstreamID + '.png';
	    	    		let urlforSchWrkStreamIdImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    	    var authforImg={};
	    	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    	    authforImg['Newsfeed']=true;
	    	    	    var responseforSchWrkStreamIdImgSingleOne;
	    	    	    var responseforSchWrkStreamIdImgSingleTwo;
	    	    	    var responseforCostWrkStreamIdImgSingleOne;
	    	    	    var responseforCostWrkStreamIdImgSingleTwo;    
	    	    	    var responseforSchWrkStreamIdImgSingleThree;
	    	    	    var responseforCostWrkStreamIdImgSingleThree;    
	    	    	    var responseforSchWrkStreamIdImgSingleFour;
	    	    	    var responseforCostWrkStreamIdImgSingleFour;    
	    	    	    var responseforSchWrkStreamIdImgSingleFive;
	    	    	    var responseforCostWrkStreamIdImgSingleFive;    
	    	    	    var responseforSchWrkStreamIdImgSingleSix;
	    	    	    var responseforCostWrkStreamIdImgSingleSix;    
	    			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	    	apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	    		responseforSchWrkStreamIdImgSingleOne = result;
	    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
		    	    	    		responseforSchWrkStreamIdImgSingleTwo = result;
		    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
			    	    	    		responseforSchWrkStreamIdImgSingleThree = result;
			    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforFour, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	    	    		responseforSchWrkStreamIdImgSingleFour = result;
				    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforFive, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
					    	    	    		responseforSchWrkStreamIdImgSingleFive = result;
					    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamImgUrlforSix, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
						    	    	    		responseforSchWrkStreamIdImgSingleSix = result;
						    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlOne, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
							    	    	    		responseforCostWrkStreamIdImgSingleOne = result;	
							    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlTwo, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
								    	    	    		responseforCostWrkStreamIdImgSingleTwo = result;
								    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlThree, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
									    	    	    		responseforCostWrkStreamIdImgSingleThree = result;
									    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlFour, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
										    	    	    		responseforCostWrkStreamIdImgSingleFour = result;
										    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlFive, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
											    	    	    		responseforCostWrkStreamIdImgSingleFive = result;
											    	    	    		apiRequestHelper.post(urlforSchWrkStreamIdImg, { 'urlDetails': wrkStreamCostImgUrlSix, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
												    	    	    		responseforCostWrkStreamIdImgSingleSix = result;
												    	    	    		var responseforSchWrkStreamIdImgSingleObjOne = {"wrkStreamId" : reportAllWorkstreamDetail[0].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleOne, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleOne};
													    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjOne);	    	
													    	    	    	var responseforSchWrkStreamIdImgSingleObjTwo = {"wrkStreamId" : reportAllWorkstreamDetail[1].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleTwo, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleTwo};
													    	    	    	responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjTwo);
													    	    	    	var responseforSchWrkStreamIdImgSingleObjThree = {"wrkStreamId" : reportAllWorkstreamDetail[2].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleThree, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleThree};
														    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjThree);
														    	    	    var responseforSchWrkStreamIdImgSingleObjFour = {"wrkStreamId" : reportAllWorkstreamDetail[3].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleFour, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleFour};
														    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjFour);
														    	    	    var responseforSchWrkStreamIdImgSingleObjFive = {"wrkStreamId" : reportAllWorkstreamDetail[4].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleFive, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleFive};
														    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjFive);
														    	    	    var responseforSchWrkStreamIdImgSingleObjSix = {"wrkStreamId" : reportAllWorkstreamDetail[5].WorkstreamID, "schWrkStreamImg" : responseforSchWrkStreamIdImgSingleSix, "costWrkStreamImg" : responseforCostWrkStreamIdImgSingleSix};
														    	    	    responseforSchWrkStreamIdImg.push(responseforSchWrkStreamIdImgSingleObjSix);
														    	    	    let urlforCostCommentary = serviceURL.COST_WORKBENCH + '/fetchCostProgressForWorkStreamA3report';
													    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
													    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[0].WorkstreamID}, tokenforImg, (error, result) => {
													    	        	    		reportAllWorkstreamDetail[0].CostProgress = result.costProgress;
													    	        	    	});
													    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
													    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[1].WorkstreamID}, tokenforImg, (error, result) => {
													    	        	    		reportAllWorkstreamDetail[1].CostProgress = result.costProgress;
													    	        	    	});
													    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
													    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[2].WorkstreamID}, tokenforImg, (error, result) => {
													    	        	    		reportAllWorkstreamDetail[2].CostProgress = result.costProgress;
													    	        	    	});
													    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
													    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[3].WorkstreamID}, tokenforImg, (error, result) => {
													    	        	    		reportAllWorkstreamDetail[3].CostProgress = result.costProgress;
													    	        	    	});
													    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
													    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[4].WorkstreamID}, tokenforImg, (error, result) => {
													    	        	    		reportAllWorkstreamDetail[4].CostProgress = result.costProgress;
													    	        	    	});
													    	        	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
													    	        	    	'projectEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth , "workStreamID" : reportAllWorkstreamDetail[5].WorkstreamID}, tokenforImg, (error, result) => {
													    	        	    		reportAllWorkstreamDetail[5].CostProgress = result.costProgress;
													    	        	    	});
													    	    	    });
												    	    	    });
											    	    	    });
										    	    	    });
									    	    	    });
								    	    	    });
							    	    	    });
						    	    	    });
					    	    	    });
				    	    	    });
			    	    	    });
	    	    	    	});	    	    	    	
    	    		}
    	    	}, 3000);
	    	    }
	    var masterLogoUrl = 'master_logo_print.png';
		var flaggedUrl = 'Flagged.png';
		let urlforMasterImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    var authforImg={};
	    authforImg['userID']=dataOptions.loggedInUserID;
	    authforImg['Newsfeed']=true;
	    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
		apiRequestHelper.post(urlforMasterImg, { 'urlDetails': masterLogoUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	responseforMasterImg = result;
	    });
    	apiRequestHelper.post(urlforMasterImg, { 'urlDetails': flaggedUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	responseforFlaggedImg = result;
	    });
	    if(dataOptions.moduleAccessPermissions.costPermissions.showModule){
	    	let url = serviceURL.COST_DASHBOARD + '/getSmallCostCardSummary';
    	    apiRequestHelper.post(url, { 'loggedInUserID': dataOptions.loggedInUserID, 'projectEntityID': dataOptions.projectEntityID, 'reportEntityID': dataOptions.projectPhaseId,
    	    	'reportStatusID': dataOptions.reportStatusID, 'reportMonth': dataOptions.reportMonth}, token, (error, result) => {
    	    		//logger.debug('result for getCostCardDataForReport = ' , result);
    	    		costData = result;
				});
    	    let urlforCostCommentary = serviceURL.COST_WORKBENCH + '/fetchCostCardDataForWB';
    	    apiRequestHelper.post(urlforCostCommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'projectEntityID': dataOptions.projectEntityID,
    	    	'reportEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth }, token, (error, result) => {
    	    		//logger.debug('result for fetchCostCardDataForWB = ' , result);
    	    		costCommentary = result[0].Commentary;
    	    		costCommentary = costCommentary.replace(/(&lt;)/g, '<').replace(/(&gt;)/g, '>').replace(/(&#10;)/g, '<br/>').replace(/(&#34;)/g, '"').replace(/(&amp;)/g, '&').replace(/(&#8211;)/g, '–').replace(/(&#8220;)/g, '"').replace(/(&#8221;)/g, '"').replace(/(&#8216;)/g, "'").replace(/(&#8217;)/g, "'");
    	    	});
    	    var costPhaseUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostPhase.png';
			var costAnnualUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostAnnual.png';
			var costLargeAllUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/CostLargeAll.png';			
			let urlforCostImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
    	    var authforImg={};
    	    authforImg['userID']=dataOptions.loggedInUserID;
    	    authforImg['Newsfeed']=true;
		    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
    	    	apiRequestHelper.post(urlforCostImg, { 'urlDetails': costPhaseUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
    	    	responseforCostPhaseImg = result;
    	    });
    	    	apiRequestHelper.post(urlforCostImg, { 'urlDetails': costAnnualUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	responseforCostAnnualImg = result;
	    	    });
    	    	apiRequestHelper.post(urlforCostImg, { 'urlDetails': costLargeAllUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	responseforCostLargeAllImg = result;
	    	    });
    	    }
	    if(dataOptions.moduleAccessPermissions.schedulePermissions.showModule){
	    	 let url = serviceURL.SCHEDULE_DASHBOARD + '/fetchA3ReportView';
	    	    apiRequestHelper.post(url, { 'loggedInUserID': dataOptions.loggedInUserID, 'projectEntityID': dataOptions.projectEntityID,
	    	    	'reportEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth }, token, (error, result) => {
	    	    		//logger.debug('result for fetchA3ReportView = ' , result);
	    	    		printSchedule = result;
	    	    	});
	    	    let urlforSchCommentary = serviceURL.SCHEDULE_REPORT_WORKBENCH + '/fetchScheduleCardCommentaryForWB';
	    	    apiRequestHelper.post(urlforSchCommentary, { 'loggedInUserId': dataOptions.loggedInUserID, 'EntityId': dataOptions.projectEntityID,
	    	    	'ProjectPhaseId': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth, "ModuleId": 5 }, token, (error, result) => {
	    	    		printScheduleCommentary = result.moduleSummary;
	    	    		printScheduleCommentary = printScheduleCommentary.replace(/(&lt;)/g, '<').replace(/(&gt;)/g, '>').replace(/(&#10;)/g, '<br/>').replace(/(&#34;)/g, '"').replace(/(&amp;)/g, '&').replace(/(&#8211;)/g, '–').replace(/(&#8220;)/g, '"').replace(/(&#8221;)/g, '"').replace(/(&#8216;)/g, "'").replace(/(&#8217;)/g, "'");
	    	    	});
	    	    let urlforPrJProgressData = serviceURL.SCHEDULE_DASHBOARD + '/getProjectProgressData';
	    	    apiRequestHelper.post(urlforPrJProgressData, { 'loggedInUserId': dataOptions.loggedInUserID, 'projectID': dataOptions.projectEntityID,
	    	    	'entityId': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth }, token, (error, result) => {
	    	    		//logger.debug('result for getProjectProgressData = ' , result);
	    	    		var getProgressDetail = result;
						for(var a = 0; a < getProgressDetail.length; a++){
							if(getProgressDetail[a].WorkStreamName == 'ALL'){
								TotalProgressDetail = getProgressDetail[a];
							}else{
								workstreamProgressDetail.push(getProgressDetail[a]);
							}
						}
	    	    	});
	    	    var schProgressUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/SchProgress.png';
				var schProgressStatusUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/SchProgressStatus.png';
				let urlforSchImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    var authforImg={};
	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    authforImg['Newsfeed']=true;
			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	apiRequestHelper.post(urlforSchImg, { 'urlDetails': schProgressUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	responseforSchProgressImg = result;
	    	    });
	    	    	apiRequestHelper.post(urlforSchImg, { 'urlDetails': schProgressStatusUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
		    	    	responseforSchProgressStatusImg = result;
		    	    });
	    		}
	    if(dataOptions.moduleAccessPermissions.hsePermissions.showModule){
	    	 let url = serviceURL.HSE_DASHBOARD_DC + '/getCommentaryForPdf';
	    	    apiRequestHelper.post(url, { 'loggedInUserID': dataOptions.loggedInUserID, 'reportEntityID': dataOptions.projectEntityID,
	    	    	'reportDashboardEntityID': dataOptions.projectPhaseId,  'reportMonth': dataOptions.reportMonth }, token, (error, result) => {
	    	    		logger.debug('result for getCommentaryForPdf = ' , result);
	    	    		logger.debug('url for getCommentaryForPdf = ' , url);
	    	    		printHse = result;
	    	    	});
	    	    let urlforHSECommentary = serviceURL.HSE + '/fetchCommentary';
	    	    apiRequestHelper.post(urlforHSECommentary, { 'loggedInUserID': dataOptions.loggedInUserID, 'entityID': dataOptions.projectEntityID,
	    	    	'projectPhaseID': dataOptions.projectPhaseId,  'publishedMonth': dataOptions.reportMonth }, token, (error, result) => {
	    	    		printHSECommentary = result[0].Commentary;
	    	    		printHSECommentary = printHSECommentary.replace(/(&lt;)/g, '<').replace(/(&gt;)/g, '>').replace(/(&#10;)/g, '<br/>').replace(/(&#34;)/g, '"').replace(/(&amp;)/g, '&').replace(/(&#8211;)/g, '–').replace(/(&#8220;)/g, '"').replace(/(&#8221;)/g, '"').replace(/(&#8216;)/g, "'").replace(/(&#8217;)/g, "'");
		    	    });
	    	    var hseUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/HsePyramid.png';
	    	    let urlforHSEImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    var authforImg={};
	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    authforImg['Newsfeed']=true;
			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	apiRequestHelper.post(urlforHSEImg, { 'urlDetails': hseUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	responseforHSEImg = result;
	    	    });
	    		}
	    if(dataOptions.moduleAccessPermissions.riskPermissions.showModule){
	    	 let url = serviceURL.RISK_CARD + '/riskCardDetails';
	    	    apiRequestHelper.post(url, { 'loggedInUserID': dataOptions.loggedInUserID, 'projectId': dataOptions.projectEntityID,
	    	    	'projectPhaseId': dataOptions.projectPhaseId,  'projectPhasePeriodValue': dataOptions.reportMonth , "isCurrentMonth": true}, token, (error, result) => {
	    	    		logger.debug('result for riskCardDetails = ' , result);
	    	    		acceptedYTD = result.acceptedYTD;
	    	    		satisfactoryYTD = result.satisfactoryYTD;
	    	    		actionsYTD = result.actionsYTD;
						var getTopRisks = result.topRisks;
						for(var i = 0; i < 3; i++){
							getTopRisks[i].riskName = getTopRisks[i].riskName.replace(/(<)/g, '&lt;').replace(/(>)/g, '&gt;');
							printTopRisks.push(getTopRisks[i]);
						}
	    	    	});
	    	    var riskUrl = 'S3/DOC_' +  dataOptions.projectEntityID + '_' + dataOptions.projectPhaseId + '_' + dataOptions.reportMonth + '/Risk.png';
	    	    let urlforRiskImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
	    	    var authforImg={};
	    	    authforImg['userID']=dataOptions.loggedInUserID;
	    	    authforImg['Newsfeed']=true;
			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
	    	    	apiRequestHelper.post(urlforRiskImg, { 'urlDetails': riskUrl, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
	    	    	responseforRiskImg = result;
	    	    });
	    	}
	    	setTimeout(function(){
		    	var createdContent = createReportPrintHtml(dataOptions, reportPrintHeader, dataOptions.moduleAccessPermissions, executiveSummary, KAInsights, KIInsights, FPInsights, acceptedYTD,
		    			satisfactoryYTD, actionsYTD, printTopRisks, printSchedule, printScheduleCommentary, printHse, printHSECommentary, costCommentary, costData, reportAllWorkstreamDetail,
		    			TotalProgressDetail, workstreamProgressDetail,responseforRiskImg, responseforSchProgressImg, responseforSchProgressStatusImg, responseforHSEImg, responseforCostPhaseImg,
		    			responseforCostAnnualImg, responseforSchWrkStreamIdImg, responseforMasterImg, responseforFlaggedImg, fundingSrcCount, responseforCostLargeAllImg);
		    	html = createdContent.content;
		    	finalOptions.footer.contents = createdContent.footerContents;
	            writeToPdf(html, finalOptions, function(err, stream) {
	        		if (err) return res.status(500).send(err);
	        		stream.pipe(res);
	        	});
	    	}, 40000);
	    	if (error) return res.send(error);
	    });
});

function filterCostData(value) {
	if (value) {
		var calculateValue = 0;
		var getValue = 0;
		if(value<0){
			getValue = Math.abs(value);
		}else{
			getValue = value;
		}
		if (getValue >= 1000 && getValue < 1000000) {
			var roundvalue = (getValue / 1000);
			calculateValue = parseFloat(Math.round(roundvalue * 100) / 100).toFixed(2) + "K";
		} else if (getValue >= 1000000) {
			var roundvalue = (getValue / 1000000);
			calculateValue = parseFloat(Math.round(roundvalue * 10) / 10).toFixed(1) + "M";
		}
		if(value<0){
			return '-'+calculateValue;
		}else{
			return calculateValue;
		}
	}
	else {
		var returnValue = "0.0";
		return returnValue;
	}
}

function roundPercent(value) {
		var getValue = 0;
		if(value<0){
			getValue = Math.abs(value);
		}else{
			getValue = value;
		}
		if (getValue) {
			var calculateValue = (Math.round(getValue * 10) / 10).toFixed(1) + '%';
			return calculateValue;
		}
	}

function MCountReport(value) {
		if (value) {
			var calculateValue = 0;
			var getValue = 0;
			if(value<0){
				getValue = Math.abs(value);
			}else{
				getValue = value;
			}
			var calculateValue = (getValue / 1000000);
			calculateValue = Math.round(calculateValue * 10) / 10;
			calculateValue = calculateValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
			if (calculateValue.toString().indexOf(".") === -1) {
				calculateValue = calculateValue + ".0";
			}
			if(value<0){
				return '-'+calculateValue;
			}else{
				return calculateValue;
			}
		}
		else {
			var returnValue = "0.0";
			return returnValue;
		}
	}

function getPercentageValue(value) {
	if (value.toString().indexOf(".") === -1) {
		value = value + ".0";
	}
	return value;
}

function SchCountReport(value) {
	if (value) {
		if (value.toString().indexOf(".") === -1) {
			value = value + ".0";
		} else {
			value = value.toFixed(1);
		}
		return value;
	} else {
		var returnValue = "0.0";
		return returnValue;
	}
}

function SchCountReportForCost(value) {
	if (value) {
		value = value * 100;;
		if (value.toString().indexOf(".") === -1) {
			value = value + ".0";
		} else {
			value = value.toFixed(1);
		}
		return value;
	} else {
		var returnValue = "0.0";
		return returnValue;
	}
}

router.post("/createPDFHtmlPdf", function(req, res) {
	let data = req.body;
	//logger.debug("getdata = " + JSON.stringify(data));
	let filename = data.filename;
	let dataOptions = (data.dataOptions)?data.dataOptions:{};
	let currDay = data.currDay;
	let currMonth = data.currMonth;
	let currYear = data.currYear;
	let printOptions = (data.printOptions)?data.printOptions:{};
	let testExp=/^[a-zA-Z0-9 ]*$/;
	let testExp2=/^[a-zA-Z0-9. ]*$/;
	let nfList=dataOptions.newsFeedList;
	//logger.debug("options1 = " + JSON.stringify(printOptions));
	//Security
	if(typeof currDay !="number" || typeof currMonth !="number" || typeof currYear !="number" || typeof dataOptions.isBreak !="boolean" || typeof dataOptions.isIncDate !="boolean" || 
			typeof dataOptions.isPrintImage !="boolean" || !(testExp.test( dataOptions.dateRange)) || !(testExp.test( dataOptions.filterRange)) || 
			!(testExp.test( dataOptions.month)) || !(testExp.test( dataOptions.source)) || !(testExp2.test(filename)) ||
		    !(testExp.test( printOptions.format)) || !(testExp.test( printOptions.orientation)) ){
		return res.status(401).send("invalid parameters");
	}
	if(printOptions.header){if(!(testExp2.test( printOptions.header.height))) return res.status(401).send("invalid print options");}
	if(printOptions.footer){if(!(testExp2.test( printOptions.footer.height))) return res.status(401).send("invalid print options");}
	if(nfList){
	if(req.headers.$wssid != nfList.loggedInUserID) return res.status(401).send("Session and Userinfo mismatched");
	var nList=_.filter(nfList.NewsFeedList, function(o) {
		if(typeof o.COMMUNITY_ID != "number" || typeof o.NEWSFEED_ID != "number" || typeof o.OWNER_ID != "number" || !(testExp.test( o.dateTimeLog)))
		 return o; });
	}
	if(nList.length>0) return res.status(401).send("Invalid Newsfeed paramaters");
	
	let timeOut = 1000000;
	var basepath = dirNameBase + '/public/';
	//logger.debug('basepath = ' + basepath);
	var html = '';
	var headerContents = '';
	var footerContents = '';
	var finalOptions = {
		format: (printOptions.format ? printOptions.format : 'A4'),
		orientation: (printOptions.orientation ? printOptions.orientation : 'portrait'),
		quality: (printOptions.quality ? printOptions.quality : 100),
		border: (printOptions.border ? printOptions.border : 0),
		timeout: (printOptions.timeout ? printOptions.timeout : timeOut),
		header: {
			height: (printOptions.header.height ? printOptions.header.height : '0.5in'),
			contents: headerContents
		},
		footer: {
			height: (printOptions.footer.height ? printOptions.footer.height : '0.5in'),
		    contents: footerContents
		},
		base: "file://" + basepath
	};

	//filename = encodeURIComponent(filename) + '.pdf';
	res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
	res.setHeader('Content-type', 'application/pdf');
	let newsFeedList = data.dataOptions.newsFeedList;
	var responseforNFImg = [];
	if (dataOptions.isPrintImage) {
		let attachmentDetailsList = data.dataOptions.attachmentDetails;
		if (attachmentDetailsList.length > 0) {
				let urlforNFIdImg = serviceURL.NEWSFEED_POST + '/getImageFromS3forPdf';
			    var authforImg={};
			    authforImg['userID']=req.headers.$wssid;
			    authforImg['Newsfeed']=true;
			    var tokenforImg = jwt.sign(authforImg, tokenSecret, { expiresIn: 60 });
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[0].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
			    	var responseforNFImgSingleOne = result;
			    	var responseforNFImgSingleObjOne = {"nfId" : attachmentDetailsList[0].nfIdDetails, "nfImg" : responseforNFImgSingleOne};
			    	responseforNFImg.push(responseforNFImgSingleObjOne);
			    });
			    if (attachmentDetailsList.length > 1) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[1].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwo = result;
				    	var responseforNFImgSingleObjTwo = {"nfId" : attachmentDetailsList[1].nfIdDetails, "nfImg" : responseforNFImgSingleTwo};
				    	responseforNFImg.push(responseforNFImgSingleObjTwo);
				    });
			    }
			    if (attachmentDetailsList.length > 2) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[2].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThree = result;
				    	var responseforNFImgSingleObjThree = {"nfId" : attachmentDetailsList[2].nfIdDetails, "nfImg" : responseforNFImgSingleThree};
				    	responseforNFImg.push(responseforNFImgSingleObjThree);
				    });
			    }
			    if (attachmentDetailsList.length > 3) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[3].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFour = result;
				    	var responseforNFImgSingleObjFour = {"nfId" : attachmentDetailsList[3].nfIdDetails, "nfImg" : responseforNFImgSingleFour};
				    	responseforNFImg.push(responseforNFImgSingleObjFour);
				    });
			    }
			    if (attachmentDetailsList.length > 4) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[4].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFive = result;
				    	var responseforNFImgSingleObjFive = {"nfId" : attachmentDetailsList[4].nfIdDetails, "nfImg" : responseforNFImgSingleFive};
				    	responseforNFImg.push(responseforNFImgSingleObjFive);
				    });
			    }
			    if (attachmentDetailsList.length > 5) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[5].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleSix = result;
				    	var responseforNFImgSingleObjSix = {"nfId" : attachmentDetailsList[5].nfIdDetails, "nfImg" : responseforNFImgSingleSix};
				    	responseforNFImg.push(responseforNFImgSingleObjSix);
				    });
			    }
			    if (attachmentDetailsList.length > 6) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[6].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleSeven = result;
				    	var responseforNFImgSingleObjSeven = {"nfId" : attachmentDetailsList[6].nfIdDetails, "nfImg" : responseforNFImgSingleSeven};
				    	responseforNFImg.push(responseforNFImgSingleObjSeven);
				    });
			    }
			    if (attachmentDetailsList.length > 7) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[7].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleEight = result;
				    	var responseforNFImgSingleObjEight = {"nfId" : attachmentDetailsList[7].nfIdDetails, "nfImg" : responseforNFImgSingleEight};
				    	responseforNFImg.push(responseforNFImgSingleObjEight);
				    });
			    }
			    if (attachmentDetailsList.length > 8) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[8].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleNine = result;
				    	var responseforNFImgSingleObjNine = {"nfId" : attachmentDetailsList[8].nfIdDetails, "nfImg" : responseforNFImgSingleNine};
				    	responseforNFImg.push(responseforNFImgSingleObjNine);
				    });
			    }
			    if (attachmentDetailsList.length > 9) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[9].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTen = result;
				    	var responseforNFImgSingleObjTen = {"nfId" : attachmentDetailsList[9].nfIdDetails, "nfImg" : responseforNFImgSingleTen};
				    	responseforNFImg.push(responseforNFImgSingleObjTen);
				    });
			    }
			    if (attachmentDetailsList.length > 10) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[10].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleEleven = result;
				    	var responseforNFImgSingleObjEleven = {"nfId" : attachmentDetailsList[10].nfIdDetails, "nfImg" : responseforNFImgSingleEleven};
				    	responseforNFImg.push(responseforNFImgSingleObjEleven);
				    });
			    }
			    if (attachmentDetailsList.length > 11) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[11].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwelve = result;
				    	var responseforNFImgSingleObjTwelve = {"nfId" : attachmentDetailsList[11].nfIdDetails, "nfImg" : responseforNFImgSingleTwelve};
				    	responseforNFImg.push(responseforNFImgSingleObjTwelve);
				    });
			    }
			    if (attachmentDetailsList.length > 12) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[12].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirteen = result;
				    	var responseforNFImgSingleObjThirteen = {"nfId" : attachmentDetailsList[12].nfIdDetails, "nfImg" : responseforNFImgSingleThirteen};
				    	responseforNFImg.push(responseforNFImgSingleObjThirteen);
				    });
			    }
			    if (attachmentDetailsList.length > 13) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[13].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleForteen = result;
				    	var responseforNFImgSingleObjForteen = {"nfId" : attachmentDetailsList[13].nfIdDetails, "nfImg" : responseforNFImgSingleForteen};
				    	responseforNFImg.push(responseforNFImgSingleObjForteen);
				    });
			    }
			    if (attachmentDetailsList.length > 14) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[14].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFifteen = result;
				    	var responseforNFImgSingleObjFifteen = {"nfId" : attachmentDetailsList[14].nfIdDetails, "nfImg" : responseforNFImgSingleFifteen};
				    	responseforNFImg.push(responseforNFImgSingleObjFifteen);
				    });
			    }
			    if (attachmentDetailsList.length > 15) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[15].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleSixteen = result;
				    	var responseforNFImgSingleObjSixteen = {"nfId" : attachmentDetailsList[15].nfIdDetails, "nfImg" : responseforNFImgSingleSixteen};
				    	responseforNFImg.push(responseforNFImgSingleObjSixteen);
				    });
			    }
			    if (attachmentDetailsList.length > 16) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[16].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleSeventeen = result;
				    	var responseforNFImgSingleObjSeventeen = {"nfId" : attachmentDetailsList[16].nfIdDetails, "nfImg" : responseforNFImgSingleSeventeen};
				    	responseforNFImg.push(responseforNFImgSingleObjSeventeen);
				    });
			    }
			    if (attachmentDetailsList.length > 17) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[17].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleEighteen = result;
				    	var responseforNFImgSingleObjEighteen = {"nfId" : attachmentDetailsList[17].nfIdDetails, "nfImg" : responseforNFImgSingleEighteen};
				    	responseforNFImg.push(responseforNFImgSingleObjEighteen);
				    });
			    }
			    if (attachmentDetailsList.length > 18) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[18].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleNineteen = result;
				    	var responseforNFImgSingleObjNineteen = {"nfId" : attachmentDetailsList[18].nfIdDetails, "nfImg" : responseforNFImgSingleNineteen};
				    	responseforNFImg.push(responseforNFImgSingleObjNineteen);
				    });
			    }
			    if (attachmentDetailsList.length > 19) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[19].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwenty = result;
				    	var responseforNFImgSingleObjTwenty = {"nfId" : attachmentDetailsList[19].nfIdDetails, "nfImg" : responseforNFImgSingleTwenty};
				    	responseforNFImg.push(responseforNFImgSingleObjTwenty);
				    });
			    }
			    if (attachmentDetailsList.length > 20) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[20].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentyOne = result;
				    	var responseforNFImgSingleObjTwentyOne = {"nfId" : attachmentDetailsList[20].nfIdDetails, "nfImg" : responseforNFImgSingleTwentyOne};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentyOne);
				    });
			    }
			    if (attachmentDetailsList.length > 21) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[21].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentyTwo = result;
				    	var responseforNFImgSingleObjTwentyTwo = {"nfId" : attachmentDetailsList[21].nfIdDetails, "nfImg" : responseforNFImgSingleTwentyTwo};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentyTwo);
				    });
			    }
			    if (attachmentDetailsList.length > 22) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[22].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentyThree = result;
				    	var responseforNFImgSingleObjTwentyThree = {"nfId" : attachmentDetailsList[22].nfIdDetails, "nfImg" : responseforNFImgSingleTwentyThree};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentyThree);
				    });
			    }
			    if (attachmentDetailsList.length > 23) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[23].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentyFour = result;
				    	var responseforNFImgSingleObjTwentyFour = {"nfId" : attachmentDetailsList[23].nfIdDetails, "nfImg" : responseforNFImgSingleTwentyFour};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentyFour);
				    });
			    }
			    if (attachmentDetailsList.length > 24) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[24].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentyFive = result;
				    	var responseforNFImgSingleObjTwentyFive = {"nfId" : attachmentDetailsList[24].nfIdDetails, "nfImg" : responseforNFImgSingleTwentyFive};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentyFive);
				    });
			    }
			    if (attachmentDetailsList.length > 25) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[25].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentySix = result;
				    	var responseforNFImgSingleObjTwentySix = {"nfId" : attachmentDetailsList[25].nfIdDetails, "nfImg" : responseforNFImgSingleTwentySix};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentySix);
				    });
			    }
			    if (attachmentDetailsList.length > 26) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[26].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentySeven = result;
				    	var responseforNFImgSingleObjTwentySeven = {"nfId" : attachmentDetailsList[26].nfIdDetails, "nfImg" : responseforNFImgSingleTwentySeven};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentySeven);
				    });
			    }
			    if (attachmentDetailsList.length > 27) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[27].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentyEight = result;
				    	var responseforNFImgSingleObjTwentyEight = {"nfId" : attachmentDetailsList[27].nfIdDetails, "nfImg" : responseforNFImgSingleTwentyEight};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentyEight);
				    });
			    }
			    if (attachmentDetailsList.length > 28) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[28].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleTwentyNine = result;
				    	var responseforNFImgSingleObjTwentyNine = {"nfId" : attachmentDetailsList[28].nfIdDetails, "nfImg" : responseforNFImgSingleTwentyNine};
				    	responseforNFImg.push(responseforNFImgSingleObjTwentyNine);
				    });
			    }
			    if (attachmentDetailsList.length > 29) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[29].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirty = result;
				    	var responseforNFImgSingleObjThirty = {"nfId" : attachmentDetailsList[29].nfIdDetails, "nfImg" : responseforNFImgSingleThirty};
				    	responseforNFImg.push(responseforNFImgSingleObjThirty);
				    });
			    }
			    if (attachmentDetailsList.length > 30) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[30].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtyOne = result;
				    	var responseforNFImgSingleObjThirtyOne = {"nfId" : attachmentDetailsList[30].nfIdDetails, "nfImg" : responseforNFImgSingleThirtyOne};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtyOne);
				    });
			    }
			    if (attachmentDetailsList.length > 31) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[31].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtyTwo = result;
				    	var responseforNFImgSingleObjThirtyTwo = {"nfId" : attachmentDetailsList[31].nfIdDetails, "nfImg" : responseforNFImgSingleThirtyTwo};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtyTwo);
				    });
			    }
			    if (attachmentDetailsList.length > 32) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[32].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtyThree = result;
				    	var responseforNFImgSingleObjThirtyThree= {"nfId" : attachmentDetailsList[32].nfIdDetails, "nfImg" : responseforNFImgSingleThirtyThree};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtyThree);
				    });
			    }
			    if (attachmentDetailsList.length > 33) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[33].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtyFour = result;
				    	var responseforNFImgSingleObjThirtyFour = {"nfId" : attachmentDetailsList[33].nfIdDetails, "nfImg" : responseforNFImgSingleThirtyFour};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtyFour);
				    });
			    }
			    if (attachmentDetailsList.length > 34) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[34].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtyFive = result;
				    	var responseforNFImgSingleObjThirtyFive = {"nfId" : attachmentDetailsList[34].nfIdDetails, "nfImg" : responseforNFImgSingleThirtyFive};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtyFive);
				    });
			    }
			    if (attachmentDetailsList.length > 35) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[35].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtySix = result;
				    	var responseforNFImgSingleObjThirtySix = {"nfId" : attachmentDetailsList[35].nfIdDetails, "nfImg" : responseforNFImgSingleThirtySix};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtySix);
				    });
			    }
			    if (attachmentDetailsList.length > 36) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[36].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtySeven = result;
				    	var responseforNFImgSingleObjThirtySeven = {"nfId" : attachmentDetailsList[36].nfIdDetails, "nfImg" : responseforNFImgSingleThirtySeven};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtySeven);
				    });
			    }
			    if (attachmentDetailsList.length > 37) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[37].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtyEight = result;
				    	var responseforNFImgSingleObjThirtyEight = {"nfId" : attachmentDetailsList[37].nfIdDetails, "nfImg" : responseforNFImgSingleThirtyEight};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtyEight);
				    });
			    }
			    if (attachmentDetailsList.length > 38) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[38].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleThirtyNine = result;
				    	var responseforNFImgSingleObjThirtyNine = {"nfId" : attachmentDetailsList[38].nfIdDetails, "nfImg" : responseforNFImgSingleThirtyNine};
				    	responseforNFImg.push(responseforNFImgSingleObjThirtyNine);
				    });
			    }
			    if (attachmentDetailsList.length > 39) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[39].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleForty = result;
				    	var responseforNFImgSingleObjForty = {"nfId" : attachmentDetailsList[39].nfIdDetails, "nfImg" : responseforNFImgSingleForty};
				    	responseforNFImg.push(responseforNFImgSingleObjForty);
				    });
			    }
			    if (attachmentDetailsList.length > 40) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[40].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortyOne = result;
				    	var responseforNFImgSingleObjFortyOne = {"nfId" : attachmentDetailsList[40].nfIdDetails, "nfImg" : responseforNFImgSingleFortyOne};
				    	responseforNFImg.push(responseforNFImgSingleObjFortyOne);
				    });
			    }
			    if (attachmentDetailsList.length > 41) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[41].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortyTwo = result;
				    	var responseforNFImgSingleObjFortyTwo = {"nfId" : attachmentDetailsList[41].nfIdDetails, "nfImg" : responseforNFImgSingleFortyTwo};
				    	responseforNFImg.push(responseforNFImgSingleObjFortyTwo);
				    });
			    }
			    if (attachmentDetailsList.length > 42) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[42].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortyThree = result;
				    	var responseforNFImgSingleObjFortyThree = {"nfId" : attachmentDetailsList[42].nfIdDetails, "nfImg" : responseforNFImgSingleFortyThree};
				    	responseforNFImg.push(responseforNFImgSingleObjFortyThree);
				    });
			    }
			    if (attachmentDetailsList.length > 43) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[43].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortyFour = result;
				    	var responseforNFImgSingleObjFortyFour = {"nfId" : attachmentDetailsList[43].nfIdDetails, "nfImg" : responseforNFImgSingleFortyFour};
				    	responseforNFImg.push(responseforNFImgSingleObjFortyFour);
				    });
			    }
			    if (attachmentDetailsList.length > 44) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[44].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortyFive = result;
				    	var responseforNFImgSingleObjFortyFive = {"nfId" : attachmentDetailsList[44].nfIdDetails, "nfImg" : responseforNFImgSingleFortyFive};
				    	responseforNFImg.push(responseforNFImgSingleObjFortyFive);
				    });
			    }
			    if (attachmentDetailsList.length > 45) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[45].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortySix = result;
				    	var responseforNFImgSingleObjFortySix = {"nfId" : attachmentDetailsList[45].nfIdDetails, "nfImg" : responseforNFImgSingleFortySix};
				    	responseforNFImg.push(responseforNFImgSingleObjFortySix);
				    });
			    }
			    if (attachmentDetailsList.length > 46) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[46].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortySeven = result;
				    	var responseforNFImgSingleObjFortySeven = {"nfId" : attachmentDetailsList[46].nfIdDetails, "nfImg" : responseforNFImgSingleFortySeven};
				    	responseforNFImg.push(responseforNFImgSingleObjFortySeven);
				    });
			    }
			    if (attachmentDetailsList.length > 47) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[47].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortyEight = result;
				    	var responseforNFImgSingleObjFortyEight = {"nfId" : attachmentDetailsList[47].nfIdDetails, "nfImg" : responseforNFImgSingleFortyEight};
				    	responseforNFImg.push(responseforNFImgSingleObjFortyEight);
				    });
			    }
			    if (attachmentDetailsList.length > 48) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[48].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFortyNine = result;
				    	var responseforNFImgSingleObjFortyNine = {"nfId" : attachmentDetailsList[48].nfIdDetails, "nfImg" : responseforNFImgSingleFortyNine};
				    	responseforNFImg.push(responseforNFImgSingleObjFortyNine);
				    });
			    }
			    if (attachmentDetailsList.length > 49) {
			    	apiRequestHelper.post(urlforNFIdImg, { 'urlDetails': attachmentDetailsList[49].nfImgDetails, 'S3Config' : S3Config}, tokenforImg, (error, result) => {
				    	var responseforNFImgSingleFifty = result;
				    	var responseforNFImgSingleObjFifty = {"nfId" : attachmentDetailsList[49].nfIdDetails, "nfImg" : responseforNFImgSingleFifty};
				    	responseforNFImg.push(responseforNFImgSingleObjFifty);
				    });
			    }
			}
	}
	if (dataOptions.isPrintImage) {
    	setTimeout(function(){
	if(data.dataOptions.source == 'NEWSFEED') {
		let newsFeedList = data.dataOptions.newsFeedList;
	    if (newsFeedList.NewsFeedList.length > 0) {
	    	 if(req.headers.$wssid != newsFeedList.loggedInUserID) return res.status(401).send("Session and Userinfo mismatched");
	    	    var auth={};
	    	    auth['userID']=req.headers.$wssid;
	    	    auth['Newsfeed']=true;
	    	    var token = jwt.sign(auth, tokenSecret, { expiresIn: 30 });

	    	    let url = serviceURL.NEWSFEED_POST + '/generateDataForWordDocByAuthor';
	    	    apiRequestHelper.post(url, newsFeedList, token, (error, result) => {
	    	    	if (dataOptions.isIncDate) {
		    	    	for (var i=0; i<result.printData.length; i++) {
							for (var j=0; j<result.printData[i].postList.length; j++) {
								for (var k =0; k< result.printData[i].postList[j].InsightList.length; k++) {
									for (var n=0; n< result.printData[i].postList[j].InsightList[k].NewsfeedList.length; n++) {
										for (var l =0; l< newsFeedList.NewsFeedList.length;l++) {
											if (result.printData[i].postList[j].InsightList[k].NewsfeedList[n].NewsfeedID ===  newsFeedList.NewsFeedList[l].NEWSFEED_ID) {
														var encode=htmlEncode.htmlEncode(newsFeedList.NewsFeedList[l].dateTimeLog);
														result.printData[i].postList[j].InsightList[k].NewsfeedList[n].dateTimeLog = encode;
													}
												}
											}
										}
									}
								}
		    	    		}
                if (error) return res.send(error);
                var createdContent = createNewsfeedPrintHtml(result.printData, dataOptions, currDay, currMonth, currYear, responseforNFImg);
                html = createdContent.content;
                finalOptions.header.contents = createdContent.headerContents;
                finalOptions.footer.contents = createdContent.footerContents;

                writeToPdf(html, finalOptions, function(err, stream) {
            		//logger.debug('err =' + err);
            		if (err) return res.status(500).send(err);

            		stream.pipe(res);
            	});
            });

	    } else { res.status(500).send('No newsfeed present') }
	}
	//logger.debug("options2 = " + JSON.stringify(finalOptions));
    	}, 40000);
	} else {
		if(data.dataOptions.source == 'NEWSFEED') {
			let newsFeedList = data.dataOptions.newsFeedList;
		    if (newsFeedList.NewsFeedList.length > 0) {
		    	 if(req.headers.$wssid != newsFeedList.loggedInUserID) return res.status(401).send("Session and Userinfo mismatched");
		    	    var auth={};
		    	    auth['userID']=req.headers.$wssid;
		    	    auth['Newsfeed']=true;
		    	    var token = jwt.sign(auth, tokenSecret, { expiresIn: 30 });

		    	    let url = serviceURL.NEWSFEED_POST + '/generateDataForWordDocByAuthor';
		    	    apiRequestHelper.post(url, newsFeedList, token, (error, result) => {
		    	    	if (dataOptions.isIncDate) {
			    	    	for (var i=0; i<result.printData.length; i++) {
								for (var j=0; j<result.printData[i].postList.length; j++) {
									for (var k =0; k< result.printData[i].postList[j].InsightList.length; k++) {
										for (var n=0; n< result.printData[i].postList[j].InsightList[k].NewsfeedList.length; n++) {
											for (var l =0; l< newsFeedList.NewsFeedList.length;l++) {
												if (result.printData[i].postList[j].InsightList[k].NewsfeedList[n].NewsfeedID ===  newsFeedList.NewsFeedList[l].NEWSFEED_ID) {
														var encode=htmlEncode.htmlEncode(newsFeedList.NewsFeedList[l].dateTimeLog);
														result.printData[i].postList[j].InsightList[k].NewsfeedList[n].dateTimeLog = encode;
														}
													}
												}
											}
										}
									}
			    	    		}
	                if (error) return res.send(error);
	                var createdContent = createNewsfeedPrintHtml(result.printData, dataOptions, currDay, currMonth, currYear, responseforNFImg);
	                html = createdContent.content;
	                finalOptions.header.contents = createdContent.headerContents;
	                finalOptions.footer.contents = createdContent.footerContents;

	                writeToPdf(html, finalOptions, function(err, stream) {
	            		//logger.debug('err =' + err);
	            		if (err) return res.status(500).send(err);

	            		stream.pipe(res);
	            	});
	            });

		    } else { res.status(500).send('No newsfeed present') }
		}
		//logger.debug("options2 = " + JSON.stringify(finalOptions));
	    	}
});

function createReportPrintHtml(dataOptions, resultData, modulePermissions, execSumm, KAInsights, KIInsights, FPInsights, acceptedYTD, satisfactoryYTD, actionsYTD, printTopRisks, printSchedule,
		printScheduleCommentary, printHse, printHSECommentary, costCommentary, costData, reportAllWorkstreamDetail, TotalProgressDetail, workstreamProgressDetail, responseforRiskImg,
		responseforSchProgressImg, responseforSchProgressStatusImg, responseforHSEImg, responseforCostPhaseImg, responseforCostAnnualImg, responseforSchWrkStreamIdImg, responseforMasterImg,
		responseforFlaggedImg, fundingSrcCount, responseforCostLargeAllImg) {
	var s3URL=S3Config.url+S3Config.bucket+'/';
	var costCurrency = costData.currency;
	var annualchart = costData.factsMeasures.annual;
	var annualVariance = annualchart.annualVariance;
	if(parseFloat(annualchart.annualBudget) == 0){
		var annulNoBudget = true;
		var annualShowMTM = false;
	}else{
		var annulNoBudget = false;
		var annualShowMTM = true;
		if(annualchart.annualVariance < 0){
			var annualBudgetStatus = 'UNDER BUDGET';
			var annualCostBugdColor = 'bugd-green';
			var annualShowVariance = true;
		}else if(annualchart.annualVariance > 0){
			var annualBudgetStatus = 'OVER BUDGET';
			var annualCostBugdColor = 'bugd-red';
			var annualShowVariance = true;
		}else if(parseInt(annualchart.annualVariance) == 0){
			var annualBudgetStatus = 'ON TARGET';
			var annualShowVariance = false;
		}
		if(annualchart.annualYeoMTMChange != null){
			var anMtm = annualchart.annualYeoMTMChange;
			if(anMtm == 0){
				var annualMTMpresent = false;
				var annualMTMStatus = 'No Change';
			}else{
				var annualMTMpresent = true;
				if(anMtm > 0){
					var annualMTM = '+$' + filterCostData(annualchart.annualYeoMTMChange);
				}else if(anMtm < 0){
					var annualMtm = Math.abs(annualchart.annualYeoMTMChange);
					annualMTM = '-$' + filterCostData(annualMtm);
				}
			}
		}else{
			var annualMTMpresent = false;
			var annualMTMStatus = 'No previous month data';
		}
	}
	var phasechart = costData.factsMeasures.total;
	if(parseFloat(phasechart.annualBudget) == 0 || parseFloat(phasechart.totalOriginalBudget) == 0){
		var phaseNoBudget = true;
		var phaseShowMTM = false;
	}else{
		var phaseNoBudget = false;
		var phaseShowMTM = true;
		if(phasechart.totalVariance < 0){
			var totalBudgetStatus = 'UNDER BUDGET';
			var phaseCostBugdColor = 'bugd-green';
			var phaseShowVariance = true;
		}else if(phasechart.totalVariance > 0){
			var totalBudgetStatus = 'OVER BUDGET';
			var phaseCostBugdColor = 'bugd-red';
			var phaseShowVariance = true;
		}else if(parseInt(phasechart.totalVariance) == 0){
			var totalBudgetStatus = 'ON TARGET';
			var phaseShowVariance = false;
		}

		if(phasechart.totalEfcMTMChange != null){
			var phMtm = phasechart.totalEfcMTMChange;
			if(phMtm == 0){
				var phaseMTMpresent = false;
				var phaseMTMStatus = 'No Change';
			}else{
				var phaseMTMpresent = true;
				if(phMtm > 0){
					var phaseMtmColor = 'bugd-red';
					var phaseMTM = '+$' + filterCostData(phasechart.totalEfcMTMChange);
				}else if(phMtm < 0){
					var phaseMtmColor = 'bugd-green';
					var totalMtm = Math.abs(phasechart.totalEfcMTMChange);
					var phaseMTM = '-$' + filterCostData(totalMtm);
				}
			}
		}else{
			var phaseMTMpresent = false;
			var phaseMTMStatus = 'No previous month data';
		}
	}
	var printContent = {};
	//var fontPathArial=dirNameBase + "/public/fonts/arial.ttf";
	//var fontPathArialbd=dirNameBase + "/public/fonts/arialbd.ttf";
	//var fontPathArial="file://"+dirNameBase + "/public/fonts/arial.ttf";
	//var fontPathArialbd="file://"+dirNameBase + "/public/fonts/arialbd.ttf";
	var fontPathArial="fonts/arial.ttf";
	var fontPathArialbd="fonts/arialbd.ttf";
	logger.info('createPDFHtmlPdfPreviewReport::createdContent::createReportPrintHtml - fontsShareDir= '+fontsShareDir+' fontPathArial= '+fontPathArial+' fontPathArialbd= '+fontPathArialbd);
	printContent.footerContents = '<div class="print-footer" style="text-align:center;"><span>Strictly Confidential to Joint Venture</span><span class="right-element">Page {{page}}</span></div>';
	var content = '<style type="text/css">'+
		'@font-face {'+
		    'font-family: "Arial";'+
		    'src: url("fonts/arial.ttf") format("truetype");'+
				'letter-spacing: 0.025rem;'+
		'}'+
		'@font-face {'+
			'font-family: "ArialBold";'+
			'src: url("fonts/arialbd.ttf") format("truetype");'+
			'letter-spacing: 0.025rem;'+
	    '}'+
		'.Section1{padding:0 0.3in; color:#000000;font-size:8pt;}'+
		'.Section2{padding:0 0.3in; color:#000000;mso-footer: f2;}'+
		'.Section3{padding:0 0.3in; color:#000000;mso-footer: f3;}'+
		'.table#hrdftrtbl{margin:0in 0in 0in -20in; width:1px; height:1px; overflow:hidden; font-family:Arial, "DejaVu Sans";}'+
		'.Section1 .p-col-2, .Section2 .p-col-2, .Section3 .p-col-2{width: 50%;}'+
		'.Section1 .p-col-1, .Section2 .p-col-1, .Section3 .p-col-1{width: 100%;}'+
		'.Section1 .font-bold {font-family:"ArialBold"; font-weight: bold;}'+
		'.Section2 .font-bold {font-family:"ArialBold"; font-weight: bold;}'+
		'.Section3 .font-bold {font-family:"ArialBold"; font-weight: bold;}'+
		'.Section1 .p-col-3, .Section2 .p-col-3, .Section3 .p-col-3{width: 33.33%;}'+
		'.Section1 .p-col-4, .Section2 .p-col-4, .Section3 .p-col-4{width: 25%;}'+
		'.Section1 .p-col-6, .Section2 .p-col-6, .Section3 .p-col-6{width: 16.66%;}'+
		'.summary-monthly table.MsoNormalTable, .detail-monthly table.MsoNormalTable, .cost-sch-detail table.MsoNormalTable{border-collapse: collapse; border:solid 2px #000000;}'+
		'.summary-monthly table.MsoNormalTable th, .detail-monthly table.MsoNormalTable th, .cost-sch-detail table.MsoNormalTable th{line-height:7pt; background: #1C405A; color:#ffffff; font-size:7pt; text-align: left; text-transform: uppercase; border: solid 2px #000000; padding: 2px; font-family:Arial, "DejaVu Sans"; vertical-align: middle;}'+
		'.summary-monthly table.MsoNormalTable td, .detail-monthly table.MsoNormalTable td, .cost-sch-detail table.MsoNormalTable td{color:#000000; font-size:6pt; line-height: 100%; border: solid 2px #000000; padding: 2px; font-family:Arial, "DejaVu Sans";}'+
		'.summary-monthly table.block-table, .detail-monthly table.block-table{border-collapse: collapse; border:0;}'+
		'.summary-monthly table.block-table td, .detail-monthly table.block-table td{border: 0;}'+
		'.summary-monthly table.insight-table, .detail-monthly table.insight-table{border-collapse: collapse; border:0;}'+
		'.summary-monthly table.insight-table td, .detail-monthly table.insight-table td{border: 0;}'+
		'.summary-monthly table.data-table, .detail-monthly table.data-table, .cost-sch-detail table.data-table{border-collapse: collapse; border:solid 1px #999999;}'+
		'.summary-monthly table.data-table th, .detail-monthly table.data-table th, .cost-sch-detail table.data-table th{background: white; color: #000000; font-size: 7pt; text-align: left; border: solid 1px #999999; padding: 2px;  font-family:Arial, "DejaVu Sans"; vertical-align: middle; text-transform: none;}'+
		'.summary-monthly table.data-table td, .detail-monthly table.data-table td, .cost-sch-detail table.data-table td{color:#000000; font-size:6pt; line-height: 100%; border: solid 1px #999999; padding: 2px; font-family:Arial, "DejaVu Sans";}'+
		'.summary-monthly table.data-table td.hlthgreen, .detail-monthly table.data-table td.hlthgreen{color:rgb(0,176,80); font-size:10pt;}'+
		'.summary-monthly table.data-table td.hlthyellow, .detail-monthly table.data-table td.hlthyellow{color:rgb(255,192,0); font-size:10pt;}'+
		'.summary-monthly table.data-table td.hlthblack, .detail-monthly table.data-table td.hlthblack{color:rgb(0,0,0); font-size:10pt;}'+
		'.summary-monthly table.head-inner-table, .detail-monthly table.head-inner-table{border-collapse: collapse; border:0;}'+
		'.summary-monthly table.head-inner-table td, .detail-monthly table.head-inner-table td{border: 0;line-height:7pt;}'+
		'.detail-monthly table th.top-head{background: rgb(127, 127, 127); color: #ffffff; font-size: 8pt; text-align: center; padding: 2px; font-family:Arial, "DejaVu Sans"; font-weight:bold; vertical-align: middle; text-transform: none;}'+	
		'.summary-monthly table.block-table td.bugd-green{color:#048479;}'+
		'.summary-monthly table.block-table td.bugd-red{color:#D71536;}'+
		'.print-footer{background: #1C405A; margin:0 0.3in;color:#fff; font-size:5pt; font-family:Arial, "DejaVu Sans";}'+
		'.right-element{float: right; text-align:right;}'+
		'.detail-monthly table th.top-head{background: rgb(127, 127, 127); color: #ffffff; font-size: 8pt; text-align: center; padding: 2px; font-family:Arial, "DejaVu Sans"; font-weight:bold; vertical-align: middle; text-transform: none;}'+	
	 	'.cost-sch-detail table.cont-detail-table{border-collapse: collapse; border:solid 1px #999999;}'+
	 	'.cost-sch-detail table.cont-detail-table th{background: #1C405A; color:#ffffff; font-size:10pt; text-align: left; text-transform: uppercase; border: 0; padding: 5px; font-family:Arial, "DejaVu Sans"; font-weight:bold; vertical-align: middle;}'+
	 	'.cost-sch-detail table.cont-detail-table td{border: solid 1px #999999; padding: 0;}'+
	 	'.cost-sch-detail table.detail-table{border-collapse: collapse; border:0; margin: 0;}'+
	 	'.cost-sch-detail table.detail-table th{background: rgb(242,242,242); color: #000000; font-size: 8pt; text-align: center; border: 0; border-bottom: solid 1px #999999; padding: 2px;  font-family:Arial, "DejaVu Sans"; vertical-align: middle; text-transform: none; font-weight: normal;}'+
	 	'.cost-sch-detail table.detail-table .top-header th{background: rgb(217, 217, 217);}'+
	 	'.cost-sch-detail table.detail-table td{color: #000000; font-size: 8pt; text-align: center; border: 0; border-bottom: solid 1px #999999; padding: 2px;  font-family:Arial, "DejaVu Sans"; vertical-align: middle;}'+
	 	'.cost-sch-detail table.detail-table .bdr-right{border-right: solid 1px #999999;}'+
		'.cost-sch-detail table.detail-table .bdr-left{border-left: solid 1px #999999;}'+
	 	'.cost-sch-detail table.detail-table .foot, .cost-sch-detail table.detail-table .foot td{background: rgb(242,242,242); font-weight: bold;}'+
	 	'.cost-sch-detail table.detail-table .foot-dark, .cost-sch-detail table.detail-table .foot-dark td{background: rgb(217, 217, 217); font-weight: bold;}'+
		'.cost-sch-detail table.detail-table th.gap, .cost-sch-detail table.detail-table .top-header th.gap, .cost-sch-detail table.detail-table td.gap, .cost-sch-detail table.detail-table .foot td.gap, .cost-sch-detail table.detail-table .foot-dark td.gap{background: #ffffff; border: 0; width: 11px;}'+
	 	'.cost-sch-detail table.commentary-table{border-collapse: collapse; border:0;}'+
	 	'.cost-sch-detail table.commentary-table td{color: #000000; font-size: 8pt; border: 0; border-bottom: solid 1px #999999; padding: 2px; font-family:Arial, "DejaVu Sans"; vertical-align: middle;}'+
		'.datetime-color{color:#A6AAA9;}'+	
		'.sectionHeader{margin-bottom: 3px;}'+
		'.sectionHeader table{border-collapse: collapse; border:solid 2px #000000; mso-padding-alt: 0;}'+
		'.sectionHeader table th{background: #1C405A; font-family:Arial, "DejaVu Sans"; font-weight:bold; color:#ffffff; font-size:10pt; border-bottom:solid 1px #000000; padding:1px;}'+
		'.sectionHeader table td{font-size: 9pt; font-family:Arial, "DejaVu Sans"; padding: 1px;font-size:7pt;}'+
		'.sectionHeader table td table{border: 0; border-left: solid 1px #000000; mso-padding-alt:0;font-size:10pt;}' +
		'.MsoHeader, .MsoFooter{ mso-pagination:widow-orphan; font-family:Arial, "DejaVu Sans";}' +
		'.Section3 .p-col-sch{width: 44.5%;}' +
		'.Section3 .p-col-gap{width: 0.5%;}' +
		'.Section3 .p-col-cost{width: 55%;}' +
		'</style>';
	if (dataOptions.checkShowSummaryReport) {
		content+= '<div class="Section1"><div class="sectionHeader"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td valign="top" width="45" style="padding: 2px 2px 2px 3px;"><img src="data:image/png;base64,' + responseforMasterImg + '" alt="master logo" width="45" height="40" /></td>';
		content+= '<td style="padding-right: 4px; padding-top: 0;padding-bottom:0;"><table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 0;"><tr>';
		content+= '<th class="p-col-3" align="left" valign="top">' + resultData.ReportName + '</th>';
		content+= '<th class="p-col-3" colspan="2" align="center" valign="top">Summary Monthly Progress Report</th>';
		content+= '<th class="p-col-3" align="right" valign="top">' + resultData.monthName + '</th></tr><tr>';
		content+= '<td class="p-col-3" align="left" valign="top">Project Phase / Gate: <span class="font-bold">' + resultData.ProjectPhase + '</span></td>';
		content+= '<td class="p-col-6" align="right" valign="top">Business Unit:</td>';
		content+= '<td class="p-col-6" valign="top"><div class="font-bold">' + resultData.BusinessUnitName + '</div></td>';
		content+= '<td class="p-col-3" align="right" valign="top">Approved by: <span class="font-bold">' + resultData.ProjectOwner + '</span></td></tr><tr>';
		content+= '<td class="p-col-3" align="left" valign="top">Project Number: <span class="font-bold">' + resultData.ProjectNumber + '</span></td>';
		content+= '<td class="p-col-6" align="right" valign="top">Joint Venture Partners:</td>';
		content+= '<td class="p-col-3" valign="top" colspan="3"><div class="font-bold">' + resultData.JVAPartnerName + '</div></td></tr></table></td></tr></table></div><div class=summary-monthly>';
		if (dataOptions.moduleAccessPermissions.insightPermissions.showModule) {
			content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="MsoNormalTable"><tr>';
			if (dataOptions.checkRAGStatus && dataOptions.piRAGStatus === "Red") {
				content+= '<th class="p-col-4"><span style="font-size: 12pt; color: #D71536;">&#9632;</span>Executive Summary</th>';
			} else if (dataOptions.checkRAGStatus && dataOptions.piRAGStatus === "Amber") {
				content+= '<th class="p-col-4"><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>Executive Summary</th>';
			} else if (dataOptions.checkRAGStatus && dataOptions.piRAGStatus === "Green") {
				content+= '<th class="p-col-4"><span style="font-size: 12pt; color: #00B050;">&#9632;</span>Executive Summary</th>';
			} else {
				content+= '<th class="p-col-4" style="font-size:6pt;">Executive Summary</th>';
			}
			content+= '<th class="p-col-4" style="font-size:6pt;">Key Achievements</th><th class="p-col-4" style="font-size:6pt;">Key Issues</th><th class="p-col-4" style="font-size:6pt;">Forward Plan</th></tr><tr><td class="p-col-4" valign="top">';
			content+= '<div>' + execSumm +  '</div></td><td class="p-col-4" valign="top"><table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table">';
			for (var i =0; i< KAInsights.length; i++) {
				if ((!dataOptions.checkSensitive && !KAInsights[i].ExternalFlag) || (!dataOptions.checkSensitive && KAInsights[i].ExternalFlag) || (dataOptions.checkSensitive && !KAInsights[i].ExternalFlag)) {
					if (dataOptions.includeFS) {
						content+= '<tr><td style="border-bottom:solid 1px #999999;"><span class="font-bold">' + KAInsights[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +KAInsights[i].FUNDING_SOURCE_NM + '</sub></span>';
					} else {
						content+= '<tr><td style="border-bottom:solid 1px #999999;"><span class="font-bold">' + KAInsights[i].WorkstreamName + '</span>';
					}
					if (KAInsights[i].ImportanceFlag) {
						content+= '<span><img src="data:image/png;base64,' + responseforFlaggedImg + '" alt="" width="10" height="10"></span>';
					}
					content+= '<div>' + KAInsights[i].Insight + '</div></td></tr>';
				}
			}
			content+= '</table></td><td class="p-col-4" valign="top"><table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table">';
			for (var i =0; i< KIInsights.length; i++) {
				if ((!dataOptions.checkSensitive && !KIInsights[i].ExternalFlag) || (!dataOptions.checkSensitive && KIInsights[i].ExternalFlag) || (dataOptions.checkSensitive && !KIInsights[i].ExternalFlag)) {
					if (dataOptions.includeFS) {
						content+= '<tr><td style="border-bottom:solid 1px #999999;"><span class="font-bold">' + KIInsights[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +KIInsights[i].FUNDING_SOURCE_NM + '</sub></span>';
					} else {
						content+= '<tr><td style="border-bottom:solid 1px #999999;"><span class="font-bold">' + KIInsights[i].WorkstreamName + '</span>';
					}
					if (KIInsights[i].ImportanceFlag) {
						content+= '<span><img src="data:image/png;base64,' + responseforFlaggedImg + '" alt="" width="10" height="10"></span>';
					}
					content+= '<div>' + KIInsights[i].Insight + '</div></td></tr>';
				}
			}
			content+= '</table></td><td class="p-col-4" valign="top"><table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table">';
			for (var i =0; i< FPInsights.length; i++) {
				if ((!dataOptions.checkSensitive && !FPInsights[i].ExternalFlag) || (!dataOptions.checkSensitive && FPInsights[i].ExternalFlag) || (dataOptions.checkSensitive && !FPInsights[i].ExternalFlag)) {
					if (dataOptions.includeFS) {
						content+= '<tr><td style="border-bottom:solid 1px #999999;"><span class="font-bold">' + FPInsights[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +FPInsights[i].FUNDING_SOURCE_NM + '</sub></span>';
					} else {
						content+= '<tr><td style="border-bottom:solid 1px #999999;"><span class="font-bold">' + FPInsights[i].WorkstreamName + '</span>';
					}
					if (FPInsights[i].ImportanceFlag) {
						content+= '<span><img src="data:image/png;base64,' + responseforFlaggedImg + '" alt="" width="10" height="10"></span>';
					}
					content+= '<div>' + FPInsights[i].Insight + '</div></td></tr>';
				}
			}
			content+= '</table></td></tr></table></div>';
		}
		if (dataOptions.moduleAccessPermissions.riskPermissions.showModule || dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
			content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="MsoNormalTable" style="border-top: 0;"><tr><th class="p-col-4" style="border-top: 0; padding:0;">';
			content+= '<table width="96%" border="0" cellspacing="0" cellpadding="0" class="head-inner-table"><tr><td style="text-transform: uppercase; font-weight: bold; color:#ffffff; padding:0; border: 0; mso-line-height-rule: exactly; line-height: 7pt;">';
			if (dataOptions.moduleAccessPermissions.riskPermissions.showModule) {
				if (dataOptions.checkRAGStatus && dataOptions.riskRAGStatus === "Red") {
					content+= '<span><span style="font-size: 12pt; color: #D71536;">&#9632;</span>Risks</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.riskRAGStatus === "Amber") {
					content+= '<span><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>Risks</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.riskRAGStatus === "Green") {
					content+= '<span><span style="font-size: 12pt; color: #00B050;">&#9632;</span>Risks</span>';
				} else {
					content+= '<span> Risks </span>';
				}
			}
			content+= '</td><td style="text-transform: none; font-weight: normal; text-align: right; color:#ffffff; padding:0; border: 0;line-height: 7pt;">';
			if (dataOptions.moduleAccessPermissions.riskPermissions.showModule) {
				content+= '<span style="vertical-align: middle;"> Accepted:' +  Math.round(acceptedYTD) + '% &nbsp;&nbsp;Satisfactory: ' + Math.round(satisfactoryYTD) + '% &nbsp;&nbsp;Actions Due:' + actionsYTD + '&nbsp;&nbsp;</span>';
			}
			content+= '</td></tr></table></th>';
			content+= '<th class="p-col-4" style="border-top: 0;border-right: 0; padding:0; font-size:6pt;line-height:7pt;">';
			if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
				if (dataOptions.checkRAGStatus && dataOptions.scheduleRAGStatus === "Red") {
					content+= '<span><span style="font-size: 12pt; color: #D71536;">&#9632;</span>Schedule</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.scheduleRAGStatus === "Amber") {
					content+= '<span><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>Schedule</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.scheduleRAGStatus === "Green") {
					content+= '<span><span style="font-size: 12pt; color: #00B050;">&#9632;</span>Schedule</span>';
				} else {
					content+= '<span> Schedule </span>';
				}
			}

			content+= '</th><th class="p-col-4" style="border-left: 0; border-right: 0; border-top: 0;">&nbsp;</th>';
			content+= '<th class="p-col-4" style="border-left: 0; border-top: 0;">&nbsp;</th></tr>';
			content+= '<tr><td class="p-col-4" valign="top" style="padding: 3px 7px 3px 3px; border-right: 0;">';
			if (dataOptions.moduleAccessPermissions.riskPermissions.showModule) {
				content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
				content+= '<tr><th style="text-align: center;background: rgb(242,242,242);"><span class="font-bold">No</span></th><th style="background: rgb(242,242,242);"><span class="font-bold">Risk Name</span></th></tr>';
				for (var i =0; i< printTopRisks.length; i++) {
					content+= '<tr><td align="center">' + printTopRisks[i].number + '</td><td>' + printTopRisks[i].riskName + '</td></tr>';
				}

				content+= '</table><img src="data:image/png;base64,' + responseforRiskImg + '" width="250" height="180" alt=""></div>';
			}
			content+= '</td>';
			content+= '<td class="p-col-4" valign="top" align="center" style="border-right: 0; padding: 3px 3px 3px 7px;">';
			if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
				content+= '<div><p style="margin:0 0 5px 0;">';
				content+= '<span style="color:#848688; font-size: 8pt;">&#9866;</span> <span style="font-size:4pt;">Original Baseline</span>&nbsp;';
				content+= '<span style="color:#00354D; font-size: 8pt;">&#9866;</span> <span style="font-size:4pt;">Actual Progress</span>&nbsp;';
				content+= '<span style="color:#FBAB1A; font-size: 8pt;">&#9866;</span> <span style="font-size:4pt;">Control Baseline</span>&nbsp;';
				content+= '<span style="color:#00354D; font-size: 8pt;">&#9867;</span> <span style="font-size:4pt;">Forecast Progress</span></p>';
				content+= '<img src="data:image/png;base64,' + responseforSchProgressImg + '" width="250" height="180" alt=""><img src="data:image/png;base64,' + responseforSchProgressStatusImg + '" width="200" height="50" alt=""></div>';
			}
			content+= '</td>';
			content+= '<td class="p-col-4" valign="top" style="padding: 3px 7px 3px 3px; border-right: 0; border-left: 0;">';
			if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
				content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
				content+= '<tr><th style="background: rgb(242,242,242);"><span class="font-bold">Key Milestones</span></th><th style="width:0.4in; text-align: center;background: rgb(242,242,242);"><span class="font-bold">Plan</span></th><th style="width:0.4in; text-align: center;background: rgb(242,242,242);"><span class="font-bold">Fcst</span></th><th style="width:0.3in; text-align: center;background: rgb(242,242,242);"><span class="font-bold">Health</span></th></tr>';
				for (var i =0; i< printSchedule.milestones.length; i++) {
					/*var tempPlanArray = printSchedule.milestones[i].plan.split("/");
					var tempPlanArraylast2 = printSchedule.milestones[i].plan.slice(-2);
					var tempfcstArray = printSchedule.milestones[i].fcst.split("/");
					var tempfcstArraylast2 = printSchedule.milestones[i].fcst.slice(-2);
					printSchedule.milestones[i].plan = tempPlanArray[1] + "/" + tempPlanArray[0] + "/" + tempPlanArraylast2;
					printSchedule.milestones[i].fcst = tempfcstArray[1] + "/" + tempfcstArray[0] + "/" + tempfcstArraylast2;*/
					content+= '<tr><td>' + printSchedule.milestones[i].name + '</td><td align="center">' + printSchedule.milestones[i].plan + '</td>';
					content+= '<td align="center">' + printSchedule.milestones[i].fcst + '</td>';
					if (printSchedule.milestones[i].health === 'ACHIEVED') {
						content+= '<td class="hlthblack" align="center">&#9679;</td></tr>';
					} else if (printSchedule.milestones[i].health === 'ON TRACK') {
						content+= '<td class="hlthgreen" align="center">&#9679;</td></tr>';
					} else if (printSchedule.milestones[i].health === 'SLIPPED') {
						content+= '<td class="hlthyellow" align="center">&#9679;</td></tr>';
					}
				}
				content+= '</table></div>';
			}
			content+= '</td>';
			content+= '<td class="p-col-4" valign="top" style="border-left: 0; padding: 3px 3px 3px 7px;">';
			if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
				content+= '<div><div class="font-bold">Commentary</div><div>' + printScheduleCommentary + '</div></div>';
			}
			content+= '</td></tr></table></div>';
		}
		if (dataOptions.moduleAccessPermissions.hsePermissions.showModule || dataOptions.moduleAccessPermissions.costPermissions.showModule) {
			content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="MsoNormalTable" style="border-top: 0;"><tr><th class="p-col-4"  style="font-size:6pt;border-right: 0; border-top: 0; mso-line-height-rule: exactly; line-height: 7pt;">';
			if (dataOptions.moduleAccessPermissions.hsePermissions.showModule) {
				if (dataOptions.checkRAGStatus && dataOptions.hseRAGStatus === "Red") {
					content+= '<span><span style="font-size: 12pt; color: #D71536;">&#9632;</span>HEALTH, SAFETY &amp; ENVIRONMENT</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.hseRAGStatus === "Amber") {
					content+= '<span><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>HEALTH, SAFETY &amp; ENVIRONMENT</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.hseRAGStatus === "Green") {
					content+= '<span><span style="font-size: 12pt; color: #00B050;">&#9632;</span>HEALTH, SAFETY &amp; ENVIRONMENT</span>';
				} else {
					content+= '<span> HEALTH, SAFETY &amp; ENVIRONMENT </span>';
				}
			}
			content+= '</th><th class="p-col-4" style="border-left: 0; border-top: 0;">&nbsp;</th><th class="p-col-2" colspan="2"  style="font-size:6pt;border-top: 0; mso-line-height-rule: exactly; line-height: 7pt;">';
			if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
				if (dataOptions.checkRAGStatus && dataOptions.costRAGStatus === "Red") {
					content+= '<span><span style="font-size: 12pt; color: #D71536;">&#9632;</span>Cost</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.costRAGStatus === "Amber") {
					content+= '<span><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>Cost</span>';
				} else if (dataOptions.checkRAGStatus && dataOptions.costRAGStatus === "Green") {
					content+= '<span><span style="font-size: 12pt; color: #00B050;">&#9632;</span>Cost</span>';
				} else {
					content+= '<span> Cost </span>';
				}
			}
			content+= '</th></tr><tr><td class="p-col-4" valign="top" align="center" style="padding: 3px 7px 3px 3px; border-right: 0;">';
			if (dataOptions.moduleAccessPermissions.hsePermissions.showModule) {
				content+= '<div><img src="data:image/png;base64,' + responseforHSEImg + '" width="250" height="120" alt=""><table border="0" cellspacing="0" cellpadding="0" class="data-table">';
				for (var i =0; i< printHse.laggingIndicators.length; i++) {
					content+= '<tr><td>' + printHse.laggingIndicators[i].key + '</td><td style="text-align: center;">' + printHse.laggingIndicators[i].value + '</td>';
					content+= '<td style="text-align: center;">';
					if (printHse.laggingIndicators[i].prevValue < 0) {
						content+= '<span style="font-size: 8pt; color:#048479;">&#9660;</span></td></tr>';
					} else if (printHse.laggingIndicators[i].prevValue > 0) {
						content+= '<span style="font-size: 8pt; color:#D71536;">&#9650;</span></td></tr>';
					} else {
						content+= '<span>&nbsp;</span></td></tr>';
					}
				}
				content+= '<tr><td>Exposure Hours (Month)</td><td style="text-align: center;">' + printHse.ExposureHoursMonth + '<td>&nbsp;</td></tr>';
				content+= '<tr><td>Exposure Hours (PTD)</td><td style="text-align: center;">' + printHse.ExposureHoursPtd + '<td>&nbsp;</td></tr>';
				content+= '</table></div>';
			}
			content+= '</td><td class="p-col-4" valign="top" style="border-left: 0; padding: 3px 3px 3px 7px;">';
			if (dataOptions.moduleAccessPermissions.hsePermissions.showModule) {
				content+= '<div><div class="font-bold">Commentary</div><div>' + printHSECommentary + '</div></div>';
			}
			content+= '</td>';
			content+= '<td class="p-col-4" valign="top" style="padding: 3px 7px 3px 3px; border-right: 0;">';
			if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
				content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="block-table"><tr>';
				content+= '<td style="border-bottom: solid 1px #999999;"><h4 style="text-transform: uppercase; font-size: 9pt; margin-bottom: 2pt;">Phase</h4><img src="data:image/png;base64,' + responseforCostPhaseImg + '" width="100" height="60" alt=""></td>';
				if (phaseNoBudget) {
					content+= '<td valign="middle" style="width:0.6in; text-align: center; text-transform: uppercase; border-bottom: solid 1px #999999;">No Budget</td>';
				} else {
					content+= '<td valign="middle" style="width:0.6in; border-bottom: solid 1px #999999;"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr>';
					if (phaseCostBugdColor === 'bugd-green') {
						content+= '<td style="font-weight: bold; text-align: center;color: #048479;">';
					} else if (phaseCostBugdColor === 'bugd-red') {
						content+= '<td style="font-weight: bold; text-align: center;color: #D71536;">';
					}
					content+= '<div style="text-transform: uppercase; font-size: 7pt; line-height: 1.1; margin-bottom: 2pt;text-align: center;">' + totalBudgetStatus + '</div>';
					if (phaseShowVariance) {
						content+= '<span> by&nbsp;' + roundPercent(phasechart.totalVariance) + '</span>';
					}
					content+= '</td></tr>';
					if (phaseShowMTM) {
						content+= '<tr><td style="font-size: 6pt; padding-top:5px; text-align: center;">';
						if (phaseMTMpresent) {
							if (phaseMtmColor === 'bugd-green') {
								content+= '<span class="delta" style="color: #048479;">Month &Delta; <br>' + phaseMTM + '</span>';
							} else if (phaseMtmColor === 'bugd-red') {
								content+= '<span class="delta" style="color: #D71536;">Month &Delta; <br>' + phaseMTM + '</span>';
							}
						} else {
							content+= '<span class="delta">' + phaseMTMStatus + '</span>';
						}
						content+= '</td></tr>';
					}
					content+= '</table></td>';
				}
				content+= '<td style="width:1.1in; border-bottom: solid 1px #999999;"><table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
				content+= '<tr><th style="width:0.5in;background: rgb(242,242,242);"><span class="font-bold">Phase</span></th><th style="text-align: right; width:0.6in;background: rgb(242,242,242);"><span class="font-bold">'  + costCurrency +  '&nbsp;M</span></th></tr>';
				content+= '<tr><td>Control</td><td style="text-align: right;">'  + MCountReport(phasechart.totalCtlBudget) +  '</td></tr>';
				content+= '<tr><td>Budget</td><td style="text-align: right;">'  + MCountReport(phasechart.totalOriginalBudget) +  '</td></tr>';
				content+= '<tr><td>VOWD</td><td style="text-align: right;">'  + MCountReport(phasechart.totalVowd) +  '</td></tr>';
				content+= '<tr><td>EFC</td><td style="text-align: right;">'  + MCountReport(phasechart.totalEfc) +  '</td></tr>';
				content+= '<tr><td>Planned</td><td style="text-align: right;">'  + MCountReport(phasechart.totalPlannedCost) +  '</td></tr>';
				content+= '<tr><td>Progress</td><td style="text-align: right;">'  + MCountReport(phasechart.totalProgress) +  '</td></tr></table></td></tr><tr>';
				content+= '<td><h4 style="text-transform: uppercase; font-size: 9pt; margin-bottom: 2pt;">Annual</h4><img src="data:image/png;base64,' + responseforCostAnnualImg + '" width="100" height="60" alt=""></td>';
				if (annulNoBudget) {
					content+= '<td valign="middle" style="width:0.6in; text-align: center; text-transform: uppercase;">No Budget</td>';
				} else {
					content+= '<td valign="middle" style="width:0.6in;"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr>';
					if (annualCostBugdColor === 'bugd-green') {
						content+= '<td style="font-weight: bold; text-align: center;color: #048479;">';
					} else if (annualCostBugdColor === 'bugd-red') {
						content+= '<td style="font-weight: bold; text-align: center;color: #D71536;">';
					}
					content+= '<div style="text-transform: uppercase; font-size: 7pt; line-height: 1.1; margin-bottom: 2pt;text-align: center;">' + annualBudgetStatus + '</div>';
					if (annualShowVariance) {
						content+= '<span> by&nbsp;' + roundPercent(annualchart.annualVariance) + '</span>';
					}
					content+= '</td></tr>';
					if (annualShowMTM) {
						content+= '<tr><td style="font-size: 6pt; padding-top:5px; text-align: center;">';
						if (annualMTMpresent) {
							content+= '<span class="delta">Month &Delta; <br>' + annualMTM + '</span>';
						} else {
							content+= '<span class="delta">' + annualMTMStatus + '</span>';
						}
						content+= '</td></tr>';
					}
					content+= '</table></td>';
				}
				content+= '<td style="width:1.1in;"><table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
				content+= '<tr><th style="width:0.5in;background: rgb(242,242,242);"><span class="font-bold">Annual</span></th><th style="text-align: right; width:0.6in;background: rgb(242,242,242);"><span class="font-bold">'  + costCurrency +  '&nbsp;M</span></th></tr>';
				content+= '<tr><td>Budget</td><td style="text-align: right;">'  + MCountReport(annualchart.annualBudget) +  '</td></tr>';
				content+= '<tr><td>VOWD</td><td style="text-align: right;">'  + MCountReport(annualchart.annualVowd) +  '</td></tr>';
				content+= '<tr><td>Q0 Plan</td><td style="text-align: right;">'  + MCountReport(annualchart.annualQ0Planned) +  '</td></tr>';
				content+= '<tr><td>YEO</td><td style="text-align: right;">'  + MCountReport(annualchart.annualYeo) +  '</td></tr></table></td>';
				content+= '</tr></table></div>';
			}
			content+= '</td>';
			content+= '<td class="p-col-4" valign="top" style="border-left: 0; padding: 3px 3px 3px 7px;">';
			if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
				content+= '<div><div class="font-bold">Commentary</div><div>' + costCommentary + '</div></div>';
			}
			content+= '</td></tr></table></div>';
		}
		content+= '</div>';
		content+= '</div>';
		if (dataOptions.checkShowWSDetailReport || dataOptions.checkShowCostSchDetailReport) {
			content+= '<br clear="all" style="page-break-before:always;">';
		}
	}
	if (dataOptions.checkShowWSDetailReport) {
		var reportAllWorkstreamDetailLength = reportAllWorkstreamDetail.length;
		var reportAllWorkstreamDetailLengthforFirstPage = 0;
		var reportAllWorkstreamDetailLengthforSecondPage = 0;
		var reportAllWorkstreamDetailLengthforThirdPage = 0;
		if (reportAllWorkstreamDetailLength >2) {
			reportAllWorkstreamDetailLengthforFirstPage = 2;
		} else {
			reportAllWorkstreamDetailLengthforFirstPage = reportAllWorkstreamDetailLength;
		}
		if (reportAllWorkstreamDetailLength >4) {
			reportAllWorkstreamDetailLengthforSecondPage = 4;
		} else if (reportAllWorkstreamDetailLength >2) {
			reportAllWorkstreamDetailLengthforSecondPage = reportAllWorkstreamDetailLength;
		}
		if (reportAllWorkstreamDetailLength >6) {
			reportAllWorkstreamDetailLengthforThirdPage = 6;
		} else if (reportAllWorkstreamDetailLength >4) {
			reportAllWorkstreamDetailLengthforThirdPage = reportAllWorkstreamDetailLength;
		}
		if (reportAllWorkstreamDetailLengthforFirstPage > 0) {
			if (dataOptions.checkShowSummaryReport) {
				content+= '<div style="page-break-before:always;" class="Section2">';
			} else {
				content+= '<div class="Section2">';
			}
			content+= '<div class="sectionHeader"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td valign="top" width="45" style="padding: 2px 2px 2px 3px;"><img src="data:image/png;base64,' + responseforMasterImg + '" alt="master logo" width="45" height="40" /></td>';
			content+= '<td style="padding-right: 4px; padding-top: 0;padding-bottom:0;"><table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 0;"><tr>';
			content+= '<th class="p-col-3" align="left" valign="top">' + resultData.ReportName + '</th>';
			content+= '<th class="p-col-3" colspan="2" align="center" valign="top">Workstream Detailed Monthly Progress Report</th>';
			content+= '<th class="p-col-3" align="right" valign="top">' + resultData.monthName + '</th></tr><tr>';
			content+= '<td class="p-col-3" align="left" valign="top">Project Phase / Gate:  <span class="font-bold">' + resultData.ProjectPhase + '</span></td>';
			content+= '<td class="p-col-6" align="right" valign="top">Business Unit:</td>';
			content+= '<td class="p-col-6" valign="top"><div class="font-bold">' + resultData.BusinessUnitName + '</div></td>';
			content+= '<td class="p-col-3" align="right" valign="top">Approved by: <span class="font-bold">' + resultData.ProjectOwner + '</span></td></tr><tr>';
			content+= '<td class="p-col-3" align="left" valign="top">Project Number: <span class="font-bold">' + resultData.ProjectNumber + '</span></td>';
			content+= '<td class="p-col-6" align="right" valign="top">Joint Venture Partners:</td>';
			content+= '<td class="p-col-3" valign="top" colspan="3"><div class="font-bold">' + resultData.JVAPartnerName + '</div></td></tr></table></td></tr></table></div>';
			for (var i =0; i< reportAllWorkstreamDetailLengthforFirstPage; i++) {
				content+= '<div class=detail-monthly><table border="0" cellspacing="0" cellpadding="0" width="100%" class="MsoNormalTable"><tr>';
				if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
					if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Red") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2"><span style="font-size: 12pt; color: #D71536;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2"><span style="font-size: 12pt; color: #D71536;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
							}
					} else if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Amber") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2"><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2"><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					} else if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Green") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2"><span style="font-size: 12pt; color: #00B050;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2"><span style="font-size: 12pt; color: #00B050;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					} else {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2">' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2">' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					}
				} else {
					content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-2"></th>';
				}
				/*for (var j =0; j< reportAllWorkstreamDetail[i].Insights.length; j++) {
					if (dataOptions.moduleAccessPermissions.insightPermissions.showModule) {
						content+= '<th class="p-col-4">' + reportAllWorkstreamDetail[i].Insights[j].InsightTypeName + '</th>';
					} else {
						content+= '<th class="p-col-4"></th>';
					}
				}*/
				content+= '<th style="line-height: 7pt;border-left:0;" class="p-col-2"></th></tr><tr><td class="p-col-2" valign="top">';
				if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
					content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table"><tr><td style="width:60%" valign="top">';
					for (var j =0; j< responseforSchWrkStreamIdImg.length; j++) {
						if (reportAllWorkstreamDetail[i].WorkstreamID == responseforSchWrkStreamIdImg[j].wrkStreamId) {
							content+= '<span><img src="data:image/png;base64,' + responseforSchWrkStreamIdImg[j].schWrkStreamImg + '" width="270" height="158" alt=""></span>';
						}
					}
					content+= '</td><td style="width:40%" valign="top">';	
					for (var j =0; j< workstreamProgressDetail.length; j++) {
						if (reportAllWorkstreamDetail[i].WorkstreamID == workstreamProgressDetail[j].WorkStreamId) {
							content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
							content+= '<tr><th colspan="3" class="top-head">SCHEDULE PROGRESS</th></tr>';
							content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">To current month</span></th>';
							content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
							content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Original Baseline</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.OriginalBaseline) + '%<span style="color: #cccccc; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.OriginalBaseline) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Control Baseline</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Planned) + '%<span style="color: #434343; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Planned) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Actual</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Actual) + '%<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Actual) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Variance</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Variance) + '%<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Variance) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '</table>';
						}
					}
					content+= '</td></tr></table>';				
				}
				if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
					content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table"><tr><td style="width:60%" valign="top">';
					for (var j =0; j< responseforSchWrkStreamIdImg.length; j++) {
						if (reportAllWorkstreamDetail[i].WorkstreamID == responseforSchWrkStreamIdImg[j].wrkStreamId) {
							content+= '<span><img src="data:image/png;base64,' + responseforSchWrkStreamIdImg[j].costWrkStreamImg + '" width="270" height="158" alt=""></span>';
						}
					}
					content+= '</td><td style="width:40%" valign="top">';	
					content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
					content+= '<tr><th colspan="3" class="top-head">COST PROGRESS</th></tr>';
					content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">At Completion</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Baseline</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Baseline.Cumulative) + '<span style="color: #cccccc; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">&nbsp;</td></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Current Baseline</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBaseline.Cumulative) + '<span style="color: #434343; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBaseline.MonthDelta) + '<span style="color: #434343; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Current Budget</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBudget.Cumulative) + '<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBudget.MonthDelta) + '<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">EAC</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EAC.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EAC.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">EAC Variance</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EACVariance.Cumulative) + '<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EACVariance.MonthDelta) + '<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">To current month</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Commitment</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Commitment.Cumulative) + '<span style="color: #fbaa1b; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Commitment.MonthDelta) + '<span style="color: #fbaa1b; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">VOWD</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.VOWD.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.VOWD.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">VOWD / EAC %</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReportForCost(reportAllWorkstreamDetail[i].CostProgress.VOWD_By_EAC_Percent.Cumulative) + '%<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReportForCost(reportAllWorkstreamDetail[i].CostProgress.VOWD_By_EAC_Percent.MonthDelta) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">ETC VOWD</td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.ETC_VOWD.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.ETC_VOWD.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '</table>';
					content+= '</td></tr></table>';	
				}
				
				content+= '</td>';
				content+= '<td class="p-col-2" valign="top">';				
				for (var k =0; k< reportAllWorkstreamDetail[i].Insights.length; k++) {
					content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';					
					if (dataOptions.moduleAccessPermissions.insightPermissions.showModule && reportAllWorkstreamDetail[i].Insights[k].InsightList.length > 0) {
						content+= '<tr><th class="top-head" style="text-align:left; text-transform: uppercase;">' + reportAllWorkstreamDetail[i].Insights[k].InsightTypeName + '</th></tr><tr><td style="padding: 3px; border: 0;">';
						content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table">';
						for (var l =0; l< reportAllWorkstreamDetail[i].Insights[k].InsightList.length; l++) {
							if (((!dataOptions.checkSensitive && !reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag) ||
									(!dataOptions.checkSensitive && reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag) ||
									(dataOptions.checkSensitive && !reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag))) {
							content+= '<tr><td style="border-bottom : solid 1px #999999;"><div>' + reportAllWorkstreamDetail[i].Insights[k].InsightList[l].Insight + '</div></td></tr>';
							}
						}
						content+= '</table></div>';
						content+= '</td></tr>';
					}
					content+= '</table></div>';
				}
				content+= '</td>';
				content+= '</tr></table></div>';
			}
			content+= '</div>';
			if (reportAllWorkstreamDetailLengthforSecondPage > 0) {
				content+= '<br clear="all" style="page-break-before:always;">';
			}
		}		
		if (reportAllWorkstreamDetailLengthforSecondPage > 0) {
			content+= '<div class="Section2">';
			content+= '<div class="sectionHeader"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td valign="top" width="45" style="padding: 2px 2px 2px 3px;"><img src="data:image/png;base64,' + responseforMasterImg + '" alt="master logo" width="45" height="40" /></td>';
			content+= '<td style="padding-right: 4px; padding-top: 0;padding-bottom:0;"><table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 0;"><tr>';
			content+= '<th class="p-col-3" align="left" valign="top">' + resultData.ReportName + '</th>';
			content+= '<th class="p-col-3" colspan="2" align="center" valign="top">Workstream Detailed Monthly Progress Report</th>';
			content+= '<th class="p-col-3" align="right" valign="top">' + resultData.monthName + '</th></tr><tr>';
			content+= '<td class="p-col-3" align="left" valign="top">Project Phase / Gate:  <span class="font-bold">' + resultData.ProjectPhase + '</span></td>';
			content+= '<td class="p-col-6" align="right" valign="top">Business Unit:</td>';
			content+= '<td class="p-col-6" valign="top"><div class="font-bold">' + resultData.BusinessUnitName + '</div></td>';
			content+= '<td class="p-col-3" align="right" valign="top">Approved by: <span class="font-bold">' + resultData.ProjectOwner + '</span></td></tr><tr>';
			content+= '<td class="p-col-3" align="left" valign="top">Project Number: <span class="font-bold">' + resultData.ProjectNumber + '</span></td>';
			content+= '<td class="p-col-6" align="right" valign="top">Joint Venture Partners:</td>';
			content+= '<td class="p-col-3" valign="top" colspan="3"><div class="font-bold">' + resultData.JVAPartnerName + '</div></td></tr></table></td></tr></table></div>';
			for (var i =2; i< reportAllWorkstreamDetailLengthforSecondPage; i++) {
				content+= '<div class=detail-monthly><table border="0" cellspacing="0" cellpadding="0" width="100%" class="MsoNormalTable"><tr>';
				if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
					if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Red") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #D71536;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #D71536;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
							}
					} else if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Amber") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					} else if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Green") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #00B050;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #00B050;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					} else {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4">' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4">' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					}
				} else {
					content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"></th>';
				}
				/*for (var j =0; j< reportAllWorkstreamDetail[i].Insights.length; j++) {
					if (dataOptions.moduleAccessPermissions.insightPermissions.showModule) {
						content+= '<th class="p-col-4">' + reportAllWorkstreamDetail[i].Insights[j].InsightTypeName + '</th>';
					} else {
						content+= '<th class="p-col-4"></th>';
					}
				}*/
				content+= '<th style="line-height: 7pt;border-left:0;" class="p-col-2"></th></tr><tr><td class="p-col-2" valign="top">';
				if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
					content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table"><tr><td style="width:60%" valign="top">';
					for (var j =0; j< responseforSchWrkStreamIdImg.length; j++) {
						if (reportAllWorkstreamDetail[i].WorkstreamID == responseforSchWrkStreamIdImg[j].wrkStreamId) {
							content+= '<span><img src="data:image/png;base64,' + responseforSchWrkStreamIdImg[j].schWrkStreamImg + '" width="270" height="158" alt=""></span>';
						}
					}
					content+= '</td><td style="width:40%" valign="top">';	
					for (var j =0; j< workstreamProgressDetail.length; j++) {
						if (reportAllWorkstreamDetail[i].WorkstreamID == workstreamProgressDetail[j].WorkStreamId) {
							content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
							content+= '<tr><th colspan="3" class="top-head">SCHEDULE PROGRESS</th></tr>';
							content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">To current month</span></th>';
							content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
							content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Original Baseline</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.OriginalBaseline) + '%<span style="color: #cccccc; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.OriginalBaseline) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Control Baseline</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Planned) + '%<span style="color: #434343; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Planned) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Actual</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Actual) + '%<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Actual) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Variance</td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Variance) + '%<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
							content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Variance) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
							content+= '</table>';
						}
					}
					content+= '</td></tr></table>';		
				}
				if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
					content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table"><tr><td style="width:60%" valign="top">';
					for (var j =0; j< responseforSchWrkStreamIdImg.length; j++) {
						if (reportAllWorkstreamDetail[i].WorkstreamID == responseforSchWrkStreamIdImg[j].wrkStreamId) {
							content+= '<span><img src="data:image/png;base64,' + responseforSchWrkStreamIdImg[j].costWrkStreamImg + '" width="270" height="158" alt=""></span>';
						}
					}
					content+= '</td><td style="width:40%" valign="top">';	
					content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
					content+= '<tr><th colspan="3" class="top-head">COST PROGRESS</th></tr>';
					content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">At Completion</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">Baseline</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Baseline.Cumulative) + '<span style="color: #cccccc; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">&nbsp;</td></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">Current Baseline</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBaseline.Cumulative) + '<span style="color: #434343; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBaseline.MonthDelta) + '<span style="color: #434343; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">Current Budget</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBudget.Cumulative) + '<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBudget.MonthDelta) + '<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">EAC</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EAC.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EAC.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">EAC Variance</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EACVariance.Cumulative) + '<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EACVariance.MonthDelta) + '<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">To current month</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
					content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">Commitment</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Commitment.Cumulative) + '<span style="color: #fbaa1b; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Commitment.MonthDelta) + '<span style="color: #fbaa1b; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">VOWD</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.VOWD.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.VOWD.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">VOWD / EAC %</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + SchCountReportForCost(reportAllWorkstreamDetail[i].CostProgress.VOWD_By_EAC_Percent.Cumulative) + '%<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + SchCountReportForCost(reportAllWorkstreamDetail[i].CostProgress.VOWD_By_EAC_Percent.MonthDelta) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '<tr style="line-height: 10px;min-height: 10px;height: 10px;"><td style="padding: 0 3px;">ETC VOWD</td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.ETC_VOWD.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
					content+= '<td style="text-align: right; padding: 0 3px;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.ETC_VOWD.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
					content+= '</table>'
					content+= '</td></tr></table>';				
				}
				content+= '</td>';
				content+= '<td class="p-col-2" valign="top">';				
				for (var k =0; k< reportAllWorkstreamDetail[i].Insights.length; k++) {
					content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';					
					if (dataOptions.moduleAccessPermissions.insightPermissions.showModule && reportAllWorkstreamDetail[i].Insights[k].InsightList.length > 0) {
						content+= '<tr><th class="top-head" style="text-align:left; text-transform: uppercase;">' + reportAllWorkstreamDetail[i].Insights[k].InsightTypeName + '</th></tr><tr><td style="padding: 3px; border: 0;">';
						content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table">';
						for (var l =0; l< reportAllWorkstreamDetail[i].Insights[k].InsightList.length; l++) {
							if (((!dataOptions.checkSensitive && !reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag) ||
									(!dataOptions.checkSensitive && reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag) ||
									(dataOptions.checkSensitive && !reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag))) {
							content+= '<tr><td style="border-bottom : solid 1px #999999;"><div>' + reportAllWorkstreamDetail[i].Insights[k].InsightList[l].Insight + '</div></td></tr>';
							}
						}
						content+= '</table></div>';
						content+= '</td></tr>';
					}
					content+= '</table></div>';
				}
				content+= '</td>';
				content+= '</tr></table></div>';
			}
			content+= '</div>';
			if (reportAllWorkstreamDetailLengthforThirdPage > 0) {
				content+= '<br clear="all" style="page-break-before:always;">';
			}
		}
		if (reportAllWorkstreamDetailLengthforThirdPage > 0) {
			content+= '<div class="Section2">';
			content+= '<div class="sectionHeader"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td valign="top" width="45" style="padding: 2px 2px 2px 3px;"><img src="data:image/png;base64,' + responseforMasterImg + '" alt="master logo" width="45" height="40" /></td>';
			content+= '<td style="padding-right: 4px; padding-top: 0;padding-bottom:0;"><table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 0;"><tr>';
			content+= '<th class="p-col-3" align="left" valign="top">' + resultData.ReportName + '</th>';
			content+= '<th class="p-col-3" colspan="2" align="center" valign="top">Workstream Detailed Monthly Progress Report</th>';
			content+= '<th class="p-col-3" align="right" valign="top">' + resultData.monthName + '</th></tr><tr>';
			content+= '<td class="p-col-3" align="left" valign="top">Project Phase / Gate:  <span class="font-bold">' + resultData.ProjectPhase + '</span></td>';
			content+= '<td class="p-col-6" align="right" valign="top">Business Unit:</td>';
			content+= '<td class="p-col-6" valign="top"><div class="font-bold">' + resultData.BusinessUnitName + '</div></td>';
			content+= '<td class="p-col-3" align="right" valign="top">Approved by: <span class="font-bold">' + resultData.ProjectOwner + '</span></td></tr><tr>';
			content+= '<td class="p-col-3" align="left" valign="top">Project Number: <span class="font-bold">' + resultData.ProjectNumber + '</span></td>';
			content+= '<td class="p-col-6" align="right" valign="top">Joint Venture Partners:</td>';
			content+= '<td class="p-col-3" valign="top" colspan="3"><div class="font-bold">' + resultData.JVAPartnerName + '</div></td></tr></table></td></tr></table></div>';
			for (var i =4; i< reportAllWorkstreamDetailLengthforThirdPage; i++) {
				content+= '<div class=detail-monthly><table border="0" cellspacing="0" cellpadding="0" width="100%" class="MsoNormalTable"><tr>';
				if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
					if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Red") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #D71536;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #D71536;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
							}
					} else if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Amber") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #FBAB1A;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					} else if (dataOptions.checkRAGStatus && reportAllWorkstreamDetail[i].RAG_STATUS === "Green") {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #00B050;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"><span style="font-size: 12pt; color: #00B050;">&#9632;</span>' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					} else {
						if (fundingSrcCount > 0) {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4">' + reportAllWorkstreamDetail[i].WorkstreamName + '<sub style="color:#A6AAA9;"> &ndash;' +reportAllWorkstreamDetail[i].FUNDING_SOURCE_NM + '</sub></th>';
						} else {
							content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4">' + reportAllWorkstreamDetail[i].WorkstreamName + '</th>';
						}
					}
				} else {
					content+= '<th style="line-height: 7pt;border-right:0;" class="p-col-4"></th>';
				}
				/*for (var j =0; j< reportAllWorkstreamDetail[i].Insights.length; j++) {
				if (dataOptions.moduleAccessPermissions.insightPermissions.showModule) {
					content+= '<th class="p-col-4">' + reportAllWorkstreamDetail[i].Insights[j].InsightTypeName + '</th>';
				} else {
					content+= '<th class="p-col-4"></th>';
				}
			}*/
			content+= '<th style="line-height: 7pt;border-left:0;" class="p-col-2"></th></tr><tr><td class="p-col-2" valign="top">';
			if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
				content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table"><tr><td style="width:60%" valign="top">';
				for (var j =0; j< responseforSchWrkStreamIdImg.length; j++) {
					if (reportAllWorkstreamDetail[i].WorkstreamID == responseforSchWrkStreamIdImg[j].wrkStreamId) {
						content+= '<span><img src="data:image/png;base64,' + responseforSchWrkStreamIdImg[j].schWrkStreamImg + '" width="270" height="158" alt=""></span>';
					}
				}
				content+= '</td><td style="width:40%" valign="top">';	
				for (var j =0; j< workstreamProgressDetail.length; j++) {
					if (reportAllWorkstreamDetail[i].WorkstreamID == workstreamProgressDetail[j].WorkStreamId) {
						content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
						content+= '<tr><th colspan="3" class="top-head">SCHEDULE PROGRESS</th></tr>';
						content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">To current month</span></th>';
						content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
						content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
						content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Original Baseline</td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.OriginalBaseline) + '%<span style="color: #cccccc; font-size: 11pt;">&#9644;</span></td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.OriginalBaseline) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
						content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Control Baseline</td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Planned) + '%<span style="color: #434343; font-size: 11pt;">&#9644;</span></td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Planned) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
						content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Actual</td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Actual) + '%<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Actual) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
						content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Variance</td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].cumulative.Variance) + '%<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
						content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReport(workstreamProgressDetail[j].delta.Variance) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
						content+= '</table>';
					}
				}		
				content+= '</td></tr></table>';		
			}
			if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
				content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table"><tr><td style="width:60%" valign="top">';
				for (var j =0; j< responseforSchWrkStreamIdImg.length; j++) {
					if (reportAllWorkstreamDetail[i].WorkstreamID == responseforSchWrkStreamIdImg[j].wrkStreamId) {
						content+= '<span><img src="data:image/png;base64,' + responseforSchWrkStreamIdImg[j].costWrkStreamImg + '" width="270" height="158" alt=""></span>';
					}
				}
				content+= '</td><td style="width:40%" valign="top">';	
				content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';
				content+= '<tr><th colspan="3" class="top-head">COST PROGRESS</th></tr>';
				content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">At Completion</span></th>';
				content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
				content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Baseline</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Baseline.Cumulative) + '<span style="color: #cccccc; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">&nbsp;</td></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Current Baseline</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBaseline.Cumulative) + '<span style="color: #434343; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBaseline.MonthDelta) + '<span style="color: #434343; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Current Budget</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBudget.Cumulative) + '<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.CurrentBudget.MonthDelta) + '<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">EAC</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EAC.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EAC.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">EAC Variance</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EACVariance.Cumulative) + '<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.EACVariance.MonthDelta) + '<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '<tr><th style="padding: 0 3px;"><span class="font-bold">To current month</span></th>';
				content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Cumulative</span></th>';
				content+= '<th style="text-align: center; padding: 0 3px;"><span class="font-bold">Month</span> &Delta;</th></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">Commitment</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Commitment.Cumulative) + '<span style="color: #fbaa1b; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.Commitment.MonthDelta) + '<span style="color: #fbaa1b; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">VOWD</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.VOWD.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.VOWD.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">VOWD / EAC %</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReportForCost(reportAllWorkstreamDetail[i].CostProgress.VOWD_By_EAC_Percent.Cumulative) + '%<span style="color: #ffffff; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + SchCountReportForCost(reportAllWorkstreamDetail[i].CostProgress.VOWD_By_EAC_Percent.MonthDelta) + '%<span style="color: #ffffff; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '<tr><td style="padding: 0 3px; line-height: 8pt;">ETC VOWD</td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.ETC_VOWD.Cumulative) + '<span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></td>';
				content+= '<td style="text-align: right; padding: 0 3px; line-height: 8pt;">' + filterCostData(reportAllWorkstreamDetail[i].CostProgress.ETC_VOWD.MonthDelta) + '<span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></td></tr>';
				content+= '</table>';
				content+= '</td></tr></table>';	
			}
			content+= '</td>';
			content+= '<td class="p-col-2" valign="top">';				
			for (var k =0; k< reportAllWorkstreamDetail[i].Insights.length; k++) {
				content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="data-table">';					
				if (dataOptions.moduleAccessPermissions.insightPermissions.showModule && reportAllWorkstreamDetail[i].Insights[k].InsightList.length > 0) {
					content+= '<tr><th class="top-head" style="text-align:left; text-transform: uppercase;">' + reportAllWorkstreamDetail[i].Insights[k].InsightTypeName + '</th></tr><tr><td style="padding: 3px; border: 0;">';
					content+= '<div><table border="0" cellspacing="0" cellpadding="0" width="100%" class="insight-table">';
					for (var l =0; l< reportAllWorkstreamDetail[i].Insights[k].InsightList.length; l++) {
						if (((!dataOptions.checkSensitive && !reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag) ||
								(!dataOptions.checkSensitive && reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag) ||
								(dataOptions.checkSensitive && !reportAllWorkstreamDetail[i].Insights[k].InsightList[l].ExternalFlag))) {
						content+= '<tr><td style="border-bottom : solid 1px #999999;"><div>' + reportAllWorkstreamDetail[i].Insights[k].InsightList[l].Insight + '</div></td></tr>';
						}
					}
					content+= '</table></div>';
					content+= '</td></tr>';
				}
				content+= '</table></div>';
			}
			content+= '</td>';
			content+= '</tr></table></div>';
		}
		content+= '</div>';
			if (dataOptions.checkShowCostSchDetailReport) {
				content+= '<br clear="all" style="page-break-before:always;">';
			}
		}

	}
	if (dataOptions.checkShowCostSchDetailReport) {
		if (dataOptions.checkShowWSDetailReport || dataOptions.checkShowSummaryReport) {
			content+= '<div style="page-break-before:always;" class="Section3">';
			} else {
			content+= '<div class="Section3">';
		}
		content+= '<div class="sectionHeader"><table border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td style="padding-right: 4px; padding-top: 0;"><table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 0;"><tr>';
		content+= '<th class="p-col-3" align="left" valign="top">' + resultData.ReportName + '</th>';
		content+= '<th class="p-col-3" colspan="2" align="center" valign="top">Cost and Schedule Detailed Report</th>';
		content+= '<th class="p-col-3" align="right" valign="top">' + resultData.monthName + '</th></tr><tr>';
		content+= '<td class="p-col-3" align="left" valign="top">Project Phase / Gate:  <span class="font-bold">' + resultData.ProjectPhase + '</span></td>';
		content+= '<td class="p-col-6" align="right" valign="top">Business Unit:</td>';
		content+= '<td class="p-col-6" valign="top"><div class="font-bold">' + resultData.BusinessUnitName + '</div></td>';
		content+= '<td class="p-col-3" align="right" valign="top">Approved by: <span class="font-bold">' + resultData.ProjectOwner + '</span></td></tr><tr>';
		content+= '<td class="p-col-3" align="left" valign="top">Project Number: <span class="font-bold">' + resultData.ProjectNumber + '</span></td>';
		content+= '<td class="p-col-6" align="right" valign="top">Joint Venture Partners:</td>';
		content+= '<td class="p-col-3" valign="top" colspan="3"><div class="font-bold">' + resultData.JVAPartnerName + '</div></td></tr></table></td></tr></table></div>';
		content+= '<div class="cost-sch-detail">';
		content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%"><tr>';
		content+= '<td class="p-col-sch" valign="top">';
		if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
			content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="cont-detail-table"><tr><th>SCHEDULE PROGRESS DETAILS</th></tr><tr><td style="padding: 3px;">';
			content+= '<img src="data:image/png;base64,' + responseforSchProgressImg + '" width="480" height="150" alt=""></td></tr></table>';
		}
		content+= '</td><td class="p-col-gap">&nbsp;</td><td class="p-col-cost" valign="top">';
		if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
			content+= '<table border="0" cellspacing="0" cellpadding="0" width="100%" class="cont-detail-table"><tr><th>COST DETAILS (' + costCurrency + '/TOTAL SHARE)</th></tr><tr><td style="padding: 3px;">';
			content+= '<img src="data:image/png;base64,' + responseforCostLargeAllImg + '" width="580" height="150" alt=""></td></tr></table>';
		}
		content+= '</td></tr><tr><td colspan="3" style="border-left: solid 1px #999999; border-right: solid 1px #999999; padding: 0;"><table border="0" cellspacing="0" cellpadding="0" width="100%" class="detail-table"><tr class="top-header">';
		//if (dataOptions.moduleAccessPermissions.schedulePermissions.showModule) {
			content+= '<th class="bdr-right" style="border-bottom: 0;">&nbsp;</th>';
			content+= '<th class="bdr-right" style="border-bottom: 0;font-weight: bold;"> Weight </th>';
			content+= '<th class="bdr-right" colspan="3" style="font-weight: bold;"> Period Progress</th>';
			content+= '<th class="bdr-right" colspan="4" style="font-weight: bold;"> Cumulative Progress</th>';
			content+= '<th class="gap">&nbsp;</th>';
			content+= '<th class="bdr-left bdr-right" colspan="3" style="font-weight: bold;"> Baseline and Budget </th>';
			content+= '<th class="bdr-right" colspan="3" style="font-weight: bold;"> EAC </th>';
			content+= '<th class="bdr-right" colspan="2" style="font-weight: bold;">Commitments </th>';
			content+= '<th colspan="3" style="font-weight: bold;"> VOWD </th>';
		//}
		content+= '</tr><tr class="top-header">';
		//if (dataOptions.moduleAccessPermissions.costPermissions.showModule) {
			content+= '<th class="bdr-right" style="width: 196px;">&nbsp;</th>';
			content+= '<th class="bdr-right" style="width: 70px;">&nbsp;</th>';
			content+= '<th style="width: 60px; vertical-align: bottom;">Original Baseline</th>';
			content+= '<th style="width: 60px; vertical-align: bottom;">Control Baseline</th>';
			content+= '<th class="bdr-right" style="width: 60px; vertical-align: bottom;">Actual</th>';
			content+= '<th style="width: 60px; vertical-align: bottom;">Original Baseline</th>';
			content+= '<th style="width: 60px; vertical-align: bottom;">Control Baseline</th>';
			content+= '<th style="width: 60px; vertical-align: bottom;">Actual</th>';
			content+= '<th class="bdr-right" valign="bottom" style="width: 60px; vertical-align: bottom;"> &Delta; Control Baseline</th>';
			content+= '<th class="gap">&nbsp;</th>';
			content+= '<th class="bdr-left" valign="bottom" style="width: 70px;">Cost Baseline</th>';
			content+= '<th valign="bottom" style="width: 70px;">Current Baseline</th>';
			content+= '<th class="bdr-right" valign="bottom" style="width: 70px;">Current Budget</th>';
			content+= '<th valign="bottom" style="width: 70px;">EAC</th>';
			content+= '<th valign="bottom" style="width: 70px;">EAC Movement</th>';
			content+= '<th class="bdr-right" valign="bottom" style="width: 70px;">&Delta; Current Baseline </th>';
			content+= '<th valign="bottom" style="width: 90px;"> Period Commitment </th>';
			content+= '<th class="bdr-right" valign="bottom" style="width: 90px;"> Cumulative Commitment</th>';
			content+= '<th valign="bottom" style="width: 70px;"> Period VOWD </th>';
			content+= '<th valign="bottom" style="width: 70px;"> Cumulative VOWD </th>';
			content+= '<th valign="bottom" style="width: 70px;"> ETC VOWD </th>';
			content+= '</tr>';
			content+= '<tr>';
			content+= '<th class="bdr-right" style="font-style: italic; text-align: left;"> Legend </th>';
			content+= '<th class="bdr-right">&nbsp;</th>';
			content+= '<th valign="bottom">&nbsp;</th>';
			content+= '<th valign="bottom">&nbsp;</th>';
			content+= '<th class="bdr-right" valign="bottom">&nbsp;</th>';
			content+= '<th valign="bottom"><span style="color: #cccccc; font-size: 12pt;">&#9644;</span></th>';
			content+= '<th valign="bottom"><span style="color: #434343; font-size: 12pt;">&#9644;</span></th>';
			content+= '<th valign="bottom"><span style="color: #5d81b5; font-size: 12pt;">&#9644;</span></th>';
			content+= '<th class="bdr-right" valign="bottom">&nbsp;</th>';
			content+= '<th class="gap">&nbsp;</th>';
			content+= '<th class="bdr-left" valign="bottom"><span style="color: #cccccc; font-size: 11pt;">&#9644;</span></th>';
			content+= '<th valign="bottom"><span style="color: #434343; font-size: 11pt;">&#9644;</span></th>';
			content+= '<th class="bdr-right" valign="bottom">&nbsp;</th>';
			content+= '<th valign="bottom">&nbsp;</th>';
			content+= '<th valign="bottom">&nbsp;</th>';
			content+= '<th class="bdr-right" valign="bottom">&nbsp;</th>';
			content+= '<th valign="bottom">&nbsp;</th>';
			content+= '<th class="bdr-right" valign="bottom"><span style="color: #fbaa1b; font-size: 11pt;">&#9644;</span></th>';
			content+= '<th valign="bottom"><span style="color: #5d81b5; font-size: 14pt;">&#9632;</span></th>';
			content+= '<th valign="bottom"><span style="color: #5d81b5; font-size: 11pt;">&#9644;</span></th>';
			content+= '<th valign="bottom"><span style="color: #5d81b5; font-size: 14pt;">&#8943;</span></th>';
			content+= '</tr>';
			content+= '</table>';
		//}
		content+= '</td></tr>';
		content+= '</table></div>';
		content+= '</div>';
	}
	printContent.content = content;
	return printContent;
}

function createNewsfeedPrintHtml(resultData, dataOptions, currDay, currMonth, currYear, responseforNFImg) {
	var date = new Date();
	var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	var printDate = currDay+ ' ' +months[currMonth]+ ' ' +currYear;
	var s3URL=S3Config.url+S3Config.bucket+'/';
	logger.debug("s3URL = " + s3URL);
	var printContent = {};
	var domainurl = process.env.URL;
	printContent.headerContents = '<div class="print-header">'+printDate+'<span class="right-element red-text">Confidential</span></div>';
	printContent.footerContents = '<div class="print-footer"><span class="right-element">{{page}}</span></div>';
	//var fontPathArial="file://"+dirNameBase+"/public/fonts/arial.ttf";
	//var fontPathArial="./fonts/arial.ttf";
	//var fontPathArialbd="./fonts/arialbd.ttf";
	var fontPathArial="fonts/arial.ttf";
	var fontPathArialbd="fonts/arialbd.ttf";
	//const ttf1 = require("../../public/fonts/arial.ttf");
	//const ttf2 = require("./public/fonts/arial.ttf");
	//var fontPathArialbd="file://"+dirNameBase+"/public/fonts/arialbd.ttf";
	//logger.info("fontPathArial in newsfdd is "+fontPathArial);
	logger.info('createNewsfeedPrintHtml:: - fontsShareDir= '+fontsShareDir+' fontPathArial= '+fontPathArial+' fontPathArialbd= '+fontPathArialbd);
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
	for(var a = 0; a < resultData.length; a++){
		content+= '<h1>'+resultData[a].CommunityName;
		if(dataOptions.dateRange === "Custom Range"){
			if (dataOptions.filterRange === "Specific Month") {
				content+= '<span> &ndash; '+dataOptions.month+'</span>';
			} else if (dataOptions.filterRange === "Date Range") {
				content+= '<span> &ndash; '+dataOptions.startDate+ ' to  ' +dataOptions.endDate+ '</span>';
			}
		}else if(dataOptions.dateRange){
			content+= '<span> &ndash; '+dataOptions.dateRange+'</span>';
		}else{
			content+= '<span> &ndash; All</span>';
		}
		content+= '</h1>';

		var postlist = resultData[a].postList;
		for(var b = 0; b < postlist.length; b++){
			if(b > 0 && dataOptions.isBreak){
				content+= '<h1>'+resultData[a].CommunityName;
				if(dataOptions.dateRange === "Custom Range"){
					if (dataOptions.filterRange === "Specific Month") {
						content+= '<span> &ndash; '+dataOptions.month+'</span>';
					} else if (dataOptions.filterRange === "Date Range") {
						content+= '<span> &ndash; '+dataOptions.startDate+ ' to  ' +dataOptions.endDate+ '</span>';
					}
				}else if(dataOptions.dateRange){
					content+= '<span> &ndash; '+dataOptions.dateRange+'</span>';
				}else{
					content+= '<span> &ndash; All</span>';
				}
				content+= '</h1>';
			}
			content+= '<h2>'+postlist[b].PostAuthor;
			if(postlist[b].Title){
				content+= '<span> &ndash; '+postlist[b].Title+'</span>';
			}
			content+= '</h2>';

			var insights = postlist[b].InsightList;
			for(var c = 0; c < insights.length; c++){
				content+= '<h3>'+insights[c].InsightTypeName+'</h3>';
				content+= '<ul>';
				var newsfeed = insights[c].NewsfeedList;
				for(var d = 0; d < newsfeed.length; d++){
					content+= '<li>' + newsfeed[d].NewsfeedDesc;
					if (dataOptions.isIncDate) {
						content+= '<sub class="datetime-color"> &ndash; '+newsfeed[d].dateTimeLog +'</sub>';
					}
					if(newsfeed[d].attachments && dataOptions.isPrintImage){
						content+= '<div>';
						var images = newsfeed[d].attachments;
						for(var e = 0; e < images.length; e++){
							var url = images[e].url;
							if (url.indexOf('pdf') === -1) {
								var elemRemove = 0;
								for (var j =0; j< responseforNFImg.length; j++) {
									if (newsfeed[d].NewsfeedID == responseforNFImg[j].nfId) {
										elemRemove = j;
										content+= '<div class="newsfeed-img"><img src="data:image/png;base64,' + responseforNFImg[j].nfImg + '" alt=""></div>';
										break;
									}
								}
								var responseforNFImgToBeRemoved = responseforNFImg[elemRemove];
								responseforNFImg.splice(elemRemove, 1);
								responseforNFImg.push(responseforNFImgToBeRemoved);
							}
						}
						content+= '<div class="clearfix"></div></div>'
					}
					content+= '</li>';
				}
				content+= '</ul>';
			}
			if(b <= postlist.length-2 && dataOptions.isBreak){
				content+= '<div class="page-break"></div>';
			}
		}
		if(a <= resultData.length-2){
			content+= '<div class="page-break"></div>';
		}
	}
	content+='</div>';
	printContent.content = content;

	return printContent;
}

function writeToPdf(html, options, callback) {
	logger.debug('########## html = ' + html);
	if (html.indexOf('<script') == 1 || html.indexOf('<SCRIPT') == 1) {
		//logger.debug('error - html containig malicious script tag');
		//return res.status(500).send('error - html containig malicious script tag');
		return callback('html containing malicious script tag');
	}

	pdf.create(html, options).toStream(callback);
}




module.exports = router;