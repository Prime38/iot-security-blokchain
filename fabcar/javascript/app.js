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
// let io = require('socket.io')(server);
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

// initialize pidata;
// let temp=null,
//     humidity=null,
//     piID=null;


// all get routes
app.get('/', (req, res) => {
    let details = req.signedCookies.details;
    if (details) {
        console.log('details found in home page');
    } else {
        details = {};
        console.log('details created in home page', details);
    }
    res.cookie('details', details, cookieOptions);
    res.render('pages/index', {
        details: details
    });
});
app.get('/register', (req, res) => {
    // let details = req.body.details;
    // res.cookie(('details', details, cookieOptions));
    // res.render('pages/index', {
    //     details: details
    // });
    res.render('pages/form');
});
app.get('/login', (req, res) => {
    let details = req.body.details;
    res.cookie(('details', details, cookieOptions));
    res.render('pages/index', {
        details: details
    });
});

app.get('/profile', (req, res) => {
    let details = req.body.details;
    let devices = [{
        piId: 'pi1'
    }, {
        piId: 'pi1'
    }];
    if (details) {
        let user = details.user;
        user = {
            OwnedDevices: devices
        };
        console.log(details);
        details.user = user;
        res.cookie(('details', details, cookieOptions));
        res.render('pages/profile', {
            details: details
        });
    }
});

// all post routes
app.post('/', (req, res) => {
    
});


let mspId = "Org1MSP"
let affiliation = "org1.department1"

// Registration is complete 
app.post('/register', (req, res) => {
    var user = {
        name: req.body.name,
        mspId: req.body.mspId,
        affiliation: req.body.affiliation,
        password: sha256(req.body.pass)
    }
    async function main(user) {
        try {

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            // console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(user.name);
            if (userExists) {
                console.log('An identity for the user ' + user.name + ' already exists in the wallet');
                return;
            }

            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (!adminExists) {
                console.log('An identity for the admin user "admin" does not exist in the wallet');
                console.log('Run the enrollAdmin.js application before retrying');
                return;
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {
                wallet,
                identity: 'admin',
                discovery: {
                    enabled: false
                }
            });

            // Get the CA client object from the gateway for interacting with the CA.
            const ca = gateway.getClient().getCertificateAuthority();
            const adminIdentity = gateway.getCurrentIdentity();

            // Register the user, enroll the user, and import the new identity into the wallet.
            const secret = await ca.register({
                affiliation: user.affiliation,
                enrollmentID: user.name,
                enrollmentSecret: user.password,
                role: 'client'
            }, adminIdentity);
            const enrollment = await ca.enroll({
                enrollmentID: user.name,
                enrollmentSecret: secret
            });
            const userIdentity = X509WalletMixin.createIdentity(user.mspId, enrollment.certificate, enrollment.key.toBytes());
            await wallet.import(user.name, userIdentity);

            return enrollment.certificate
        } catch (error) {
            console.error('Failed to register user ' + user.name + ' : ${error} : ' + error);
            process.exit(1);
        }
    }
    async function sendInfo(user) {
        var isSuccess = false
        try {
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            // console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(user.name);
            if (!userExists) {
                console.log('An identity for the user ' + user.name + ' does not exist in the wallet');
                return;
            }
            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {
                wallet,
                identity: user.name,
                discovery: {
                    enabled: false
                }
            });

            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');

            // Get the contract from the network.
            const contract = network.getContract('fabcar');

            // Submit the specified transaction.
            var userId = user.name
            var cert = user.certificate
            var pubKey = user.publicKey
            let pass = user.password
            await contract.submitTransaction('register', userId, cert, pubKey, pass);
            isSuccess = true
            // Disconnect from the gateway.
            await gateway.disconnect();
            return isSuccess

        } catch (error) {
            return isSuccess
            console.error(`Failed to submit transaction: ${error}`);
            process.exit(1);
        }
    }
    // calling all function 
    main(user).then((certificate) => {
        //console.log(certificate)
        user.certificate = certificate
        console.log('Successfully registered and enrolled user ' + user.name + ' and imported it into the wallet');
        var pathUrl = __dirname + '/wallet/' + user.name + '/'
        var buf = fs.readFileSync(pathUrl + user.name)
        // console.log(user.name + ' identity file : ', buf.toString())
        var pubfileName = JSON.parse(buf.toString()).enrollment.signingIdentity //find pubkeyfilename 
        buf = fs.readFileSync(pathUrl + pubfileName + '-pub')
        return buf.toString()
    }).then((pubKey) => {
        user.publicKey = pubKey
        console.log('user having cerificate and public key : ', user);
        let details = req.signedCookies.details;
        if (details) {
            details.user = user;
        } else {
            details = {
                user: user
            };
        }
        res.cookie('details', details, cookieOptions);
        res.render('pages/profile', {
            details: details
        });
        return sendInfo(user)
    }).then((isSuccess) => {
        console.log();
        console.log('Transaction status isSuccessful : ', isSuccess)
    }).catch((err) => {
        console.error('Failed to register at blockchain network : ' + err);
    });
})

app.post('/login', upload.single('keyFile'), (req, res, next) => {

    let privBuf = req.file.buffer
    let user = {
        msg: req.body,
        name: req.body.name,
        password: sha256(req.body.pass),
        privateKey: privBuf
    };
    async function getUserInfo(user) {
        try {

            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const userExists = await wallet.exists(user.name);
            if (!userExists) {
                console.log('An identity for the user ' + user.name + ' does not exist in the wallet');
                return;
            }

            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {
                wallet,
                identity: user.name,
                discovery: {
                    enabled: false
                }
            });
            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');
            // Get the contract from the network.
            const contract = network.getContract('fabcar');

            const result = await contract.evaluateTransaction('login', user.name, user.password);

            let jsonUser = JSON.parse(result.toString())
            return jsonUser

        } catch (error) {
            console.error(`Failed to evaluate transaction: ${error}`);
            process.exit(1);
            // response here
        }
    }

    async function verifySign(user) {


        const message = JSON.stringify(user.msg)
        const signer = crypto.createSign('sha256');
        signer.update(message);
        signer.end();

        const signature = signer.sign(user.privateKey)
        const signature_hex = signature.toString('hex')

        const verifier = crypto.createVerify('sha256');
        verifier.update(message);
        verifier.end();

        const verified = verifier.verify(user.publicKey, signature);

        console.log(JSON.stringify({
            message: message,
            signature: signature_hex,
            verified: verified,
        }, null, 2));

        return verified
    }
    getUserInfo(user).then((jsonUser) => {
        console.log("--------------------");
        console.log(jsonUser);

        console.log("----------------------");


        console.log('Transaction has been evaluated, ' + user.name + '\'s  public key is: ', jsonUser.PubKey);
        user.certificate = jsonUser.Cert
        user.publicKey = jsonUser.PubKey;
        return verifySign(user)
    }).then((verified) => {
        let details = req.signedCookies.details;
        if (details) {
            details.user = user;
        } else {
            details = {
                user: user
            };
        }
        res.cookie('details', details, cookieOptions);
        res.render('pages/profile', {
            details: details
        });

    }).catch((err) => {
        console.log(err)
    })



    // res.cookie('details', details, cookieOptions);
    // res.render('pages/profile', {
    //     details: details
    // });

});

app.post('/regPi', (req, res) => {
    let pi = req.body
    console.log("information of pi recieved");
    console.log(pi);
    async function main(pi) {
        try {
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            // console.log(`Wallet path: ${walletPath}`);
            // Check to see if we've already enrolled the user.
            const piExists = await wallet.exists(pi.piID);
            if (piExists) {
                console.log('An identity for the PI-> ' + pi.piID + ' already exists in the wallet');
                return;
            }
            // Check to see if we've already enrolled the admin user.
            const adminExists = await wallet.exists('admin');
            if (!adminExists) {
                console.log('An identity for the admin user "admin" does not exist in the wallet');
                console.log('Run the enrollAdmin.js application before retrying');
                return;
            }
            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {
                wallet,
                identity: 'admin',
                discovery: {
                    enabled: false
                }
            });
            // Get the CA client object from the gateway for interacting with the CA.
            const ca = gateway.getClient().getCertificateAuthority();
            const adminIdentity = gateway.getCurrentIdentity();
            // Register the user, enroll the user, and import the new identity into the wallet.
            const secret = await ca.register({
                affiliation: "org1.department1",
                enrollmentID: pi.piID,
                enrollmentSecret: pi.password,
                role: 'client'
            }, adminIdentity);
            const enrollment = await ca.enroll({
                enrollmentID: pi.piID,
                enrollmentSecret: pi.password
            });
            const piIdentity = X509WalletMixin.createIdentity(mspId, enrollment.certificate, enrollment.key.toBytes());
            await wallet.import(pi.piID, piIdentity);

            return enrollment.certificate
        } catch (error) {
            console.error('Failed to register PI-> ' + pi.piID + ' : ${error} : ' + error);
            process.exit(1);
        }
    }
    async function sendInfo(pi) {
        var isSuccess = false
        try {
            // Create a new file system based wallet for managing identities.
            const walletPath = path.join(process.cwd(), 'wallet');
            const wallet = new FileSystemWallet(walletPath);
            // console.log(`Wallet path: ${walletPath}`);

            // Check to see if we've already enrolled the user.
            const piExists = await wallet.exists(pi.piID);
            if (!piExists) {
                console.log('An identity for the PI-> ' + pi.piID + ' does not exist in the wallet');
                return;
            }
            // Create a new gateway for connecting to our peer node.
            const gateway = new Gateway();
            await gateway.connect(ccp, {
                wallet,
                identity: pi.piID,
                discovery: {
                    enabled: false
                }
            });
            // Get the network (channel) our contract is deployed to.
            const network = await gateway.getNetwork('mychannel');
            // Get the contract from the network.
            const contract = network.getContract('fabcar');
            // Submit the specified transaction
            await contract.submitTransaction('regPi', pi.piID, pi.ip, pi.username, pi.password, pi.port, pi.owner, pi.certificate, pi.publicKey);
            isSuccess = true
            // Disconnect from the gateway.
            await gateway.disconnect();
            return isSuccess
        } catch (error) {
            return isSuccess
            console.error(`Failed to submit transaction: ${error}`);
            process.exit(1);
        }
    }
    // calling all function 
    main(pi).then((certificate) => {
            pi.certificate = certificate
            console.log('Successfully registered and enrolled PI -> ' + pi.piID + ' and imported it into the wallet');
            var pathUrl = __dirname + '/wallet/' + pi.piID + '/'
            var buf = fs.readFileSync(pathUrl + pi.piID)

            var pubfileName = JSON.parse(buf.toString()).enrollment.signingIdentity //find pubkeyfilename 
            buf = fs.readFileSync(pathUrl + pubfileName + '-pub')
            return buf.toString()
        }).then((pubKey) => {
            pi.publicKey = pubKey

            return sendInfo(pi)
        }).then((isSuccess) => {
            console.log();
            console.log('Transaction status isSuccessful : ', isSuccess)
            var pathUrl = __dirname + '/wallet/' + pi.piID + '/'
            var buf = fs.readFileSync(pathUrl + pi.piID)
            let piIdentityFile = buf.toString();
            console.log(pi.piID + ' identity file : ', piIdentityFile)
            var pubfileName = JSON.parse(buf.toString()).enrollment.signingIdentity //find pubkeyfilename 
            buf = fs.readFileSync(pathUrl + pubfileName + '-priv')
            let privateKey = buf.toString()
            console.log("private key :" + privateKey);
            request({
                uri: "http://" + pi.ip + ':' + pi.port + '/',
                method: "POST",
                form: {
                    identity: piIdentityFile,
                    profilename: pubfileName,
                    privatekey: privateKey,
                    publicKey: pi.publicKey
                }
            }, function (error, response, body) {

                console.log(body);
                return true
            });
        })
        .then((isSuccess) => {
            console.log("Registration files sent to pi");
        })
        .catch((err) => {
            console.error('Failed to register at blockchain network : ' + err);
        });




})

app.post('/buyPi', (req, res) => {
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
})

// start server;
server.listen(port, err => {
    if (err) {
        throw err;
    } else {
        console.log('server started on port : ', port);
    }

});
