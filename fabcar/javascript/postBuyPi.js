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
const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
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
module.exports.buyPi=function (req,res){
    console.log(req.body);
    // let details = req.body.details;
    //form pi object
    let pi = req.body;
    // do a invoke transaction
    // console.log(details.user)
    async function main(pi) {
        try {

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists('user1');
            if (!userExists) {
                console.log('An identity for the user "user1" does not exist in the wallet');

                return;
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {
                wallet,
                identity: 'user1',
                discovery: {
                    enabled: false
                }
            });

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('fabcar');


            let userid = 'user1'
            var piId = '4cf527c583e4404648be5975329b18fc90b98bca3eb699dc26390725ac1a7fba'
            let piIp = '10.100.32.142'
            var piPass = '41414141'
            var usercert = '-----BEGIN CERTIFICATE-----MIICkjCCAjmgAwIBAgIUXw7NYSyYh0XMrkT5oUnFrt0OzDgwCgYIKoZIzj0EAwIwczELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBGcmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xHDAaBgNVBAMTE2NhLm9yZzEuZXhhbXBsZS5jb20wHhcNMTkxMDI1MTIzNDAwWhcNMjAxMDI0MTIzOTAwWjBEMTAwDQYDVQQLEwZjbGllbnQwCwYDVQQLEwRvcmcxMBIGA1UECxMLZGVwYXJ0bWVudDExEDAOBgNVBAMTB3Nob3VtaWswWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQfFKLxJ5fu5/I68lw4cmwIz5xtgMnMDzGBqJQqEpmmW3dONaTwxfIcMJLBumnuYVeFu0IKZS97VeFShLLYo/IFo4HZMIHWMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBQg6RvsVtcHGt7oGGv+HBPz2VphRjArBgNVHSMEJDAigCBCOaoNzXba7ri6DNpwGFHRRQTTGq0bLd3brGpXNl5JfDBqBggqAwQFBgcIAQReeyJhdHRycyI6eyJoZi5BZmZpbGlhdGlvbiI6Im9yZzEuZGVwYXJ0bWVudDEiLCJoZi5FbnJvbGxtZW50SUQiOiJzaG91bWlrIiwiaGYuVHlwZSI6ImNsaWVudCJ9fTAKBggqhkjOPQQDAgNHADBEAiA0CcBZZFCiLzLnxWQnFDOWhJZPUbVL/wqXQN8+J0k8RQIgH/0/eAyVcw2Ov67J+nHr74kEvoaOEHJhIT08ngzKb/g=-----END CERTIFICATE-----'
            var userpubKey = '-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxSi8SeX7ufyOvJcOHJsCM+cbYDJzA8xgaiUKhKZplt3TjWk8MXyHDCSwbpp7mFXhbtCCmUve1XhUoSy2KPyBQ==-----END PUBLIC KEY-----'

            await contract.submitTransaction('buyPi', userid, usercert, userpubKey, piId, piIp, pi.piUserName, piPass);
            console.log('Transaction has been submitted');
            res.send('ownership confiremed')
            // Disconnect from the gateway.
            await gateway.disconnect();

        } catch (error) {
            console.error(`Failed to submit transaction: ${error}`);
            process.exit(1);
        }
    }
    main(pi)
}