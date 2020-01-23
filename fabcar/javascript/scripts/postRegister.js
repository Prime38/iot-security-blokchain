'use strict';

// all imports

let express = require('express'),
    http = require('http'),
    path = require('path'),
    bodyparser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    fs = require('fs'),
    shell = require('shelljs'),
    sha256 = require('js-sha256'),
    multer = require('multer'),
    request = require('request'),
    crypto = require('crypto');
const {
    FileSystemWallet,
    Gateway,
    X509WalletMixin
} = require('fabric-network');
const ccpPath = path.resolve(__dirname, '..', '..','..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);
// server
let app = express();
let server = http.createServer(app);
let port = process.env.PORT || 3000;
let io = require('socket.io')(server);
var temp = null
var humidity = null
var piID = null
// // for uploading private key file
// let upload = multer({
//     dest: 'uploads/'
// });
var upload = multer()

// define what app will use ;
app.use(express.json());
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/views/images'));
app.use(express.static(__dirname));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({
    extended: false
}));
let cookieOptions = {
    signed: true,
    maxAge: 999999999999
};
app.use(cookieParser('prime'));
// set view engine and views path for app
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
module.exports.getHome =function(req,res){
}