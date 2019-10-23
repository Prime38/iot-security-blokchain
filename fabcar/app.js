var express = require("express");
var app = express();
var http = require("http");
const server = http.createServer(app);
const path = require('path');
var bodyparser = require("body-parser");

var multer  = require('multer')
   , cp = require('child_process')
   , ursa = require('ursa')
   , fs = require('fs')
   , msg
// for uploading private key file
var upload = multer({ dest: 'uploads/' })
var upload = multer()
// define what app will use 
app.use(express.json());
app.use(express.static(__dirname + "/public"));
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({
    extended: false
}));


// set view engine and views path for app
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')


// //set network configuaration
// const { FileSystemWallet, Gateway } = require('fabric-network');
// const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
// const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
// const ccp = JSON.parse(ccpJSON);


//to show real time data changes
var io = require('socket.io')(server);


var port = process.env.PORT || 3000;
var temp = null
var humidity = null
var piID=null


// Home route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html')
});
app.post('/', (req, res) => {

    data = req.body
    console.log("data recieved from pi : ====================================");
    console.log(data);
    console.log('====================================');
    //res.sendFile(__dirname+"/index.html")
    if (data.temp != '') {
        temp = data.temp
        humidity = data.humidity
        piID=data.piID
    }
    var Fabric_Client = require('fabric-client');
    var util = require('util');
    var fabric_client = new Fabric_Client();
    // setup the fabric network
    var channel = fabric_client.newChannel('mychannel');
    var peer = fabric_client.newPeer('grpc://localhost:7051');
    channel.addPeer(peer);
    var order = fabric_client.newOrderer('grpc://localhost:7050')
    channel.addOrderer(order);
    //
    var member_user = null;
    var store_path = path.join(__dirname, 'hfc-key-store');
    console.log('Store path:' + store_path);
    var tx_id = null;

    // create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
    Fabric_Client.newDefaultKeyValueStore({
        path: store_path
    }).then((state_store) => {
        // assign the store to the fabric client
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({
            path: store_path
        });
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('user1', true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user1 from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user1.... run registerUser.js');
        }

        // get a transaction id object based on the current user assigned to fabric client
        tx_id = fabric_client.newTransactionID();
        console.log("Assigning transaction_id: ", tx_id._transaction_id);

        // createCar chaincode function - requires 5 args, ex: args: ['CAR12', 'Honda', 'Accord', 'Black', 'Tom'],
        // changeCarOwner chaincode function - requires 2 args , ex: args: ['CAR10', 'Dave'],
        // must send the proposal to endorsing peers
        var request = {
            //targets: var default to the peer assigned to the client
            chaincodeId: 'fabcar',
            fcn: 'sensorData',
            args: [temp, humidity,piID],
            chainId: 'mychannel',
            txId: tx_id
        };
        console.log("request");
        console.log("--------------------");
        console.log(request);
        
        
        
        // send the transaction proposal to the peers
        return channel.sendTransactionProposal(request);
    }).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
        var isProposalGood = false;
        if (proposalResponses && proposalResponses[0].response &&
            proposalResponses[0].response.status === 200) {
            isProposalGood = true;
            console.log('Transaction proposal was good');
        } else {
            console.error('Transaction proposal was bad');
        }
        if (isProposalGood) {
            console.log(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                proposalResponses[0].response.status, proposalResponses[0].response.message));

            // build up the request for the orderer to have the transaction committed
            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal
            };

            // set the transaction listener and set a timeout of 30 sec
            // if the transaction did not get committed within the timeout period,
            // report a TIMEOUT status
            var transaction_id_string = tx_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
            var promises = [];

            var sendPromise = channel.sendTransaction(request);
            promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

            // get an eventhub once the fabric client has a user assigned. The user
            // is required bacause the event registration must be signed
            var event_hub = channel.newChannelEventHub(peer);

            // using resolve the promise so that result status may be processed
            // under the then clause rather than having the catch clause process
            // the status
            var txPromise = new Promise((resolve, reject) => {
                var handle = setTimeout(() => {
                    event_hub.unregisterTxEvent(transaction_id_string);
                    event_hub.disconnect();
                    resolve({
                        event_status: 'TIMEOUT'
                    }); //we could use reject(new Error('Trnasaction did not compvare within 30 seconds'));
                }, 3000);
                event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                        // this is the callback for transaction event status
                        // first some clean up of event listener
                        clearTimeout(handle);

                        // now var the application know what happened
                        var return_status = {
                            event_status: code,
                            tx_id: transaction_id_string
                        };
                        if (code !== 'VALID') {
                            console.error('The transaction was invalid, code = ' + code);
                            resolve(return_status); // we could use reject(new Error('Problem with the tranaction, event status ::'+code));
                        } else {
                            console.log('The transaction has been committed on peer ' + event_hub.getPeerAddr());
                            resolve(return_status);
                        }
                    }, (err) => {
                        //this is the callback if something goes wrong with the event registration or processing
                        reject(new Error('There was a problem with the eventhub ::' + err));
                    }, {
                        disconnect: true
                    } //disconnect when compvare
                );
                event_hub.connect();

            });
            promises.push(txPromise);

            return Promise.all(promises);
        } else {
            console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
        }
    }).then((results) => {
        console.log('Send transaction promise and event listener promise have compvared');
        // check the results in the order the promises were added to the promise all list
        if (results && results[0] && results[0].status === 'SUCCESS') {
            console.log('Successfully sent transaction to the orderer.');
        } else {
            console.error('Failed to order the transaction. Error code: ' + results[0].status);
        }

        if (results && results[1] && results[1].event_status === 'VALID') {
            console.log('Successfully committed the change to the ledger by the peer');
            res.sendFile(__dirname + '/index.html')
            latestData();
            //console.log("Response is ", JSON.stringify(results));
        } else {
            console.log('Transaction failed to be committed to the ledger due to ::' + results[1].event_status);
        }
    }).catch((err) => {
        console.error('Failed to invoke successfully :: ' + err);
    });

    
})

// show register page when we go /register url
app.get('/register', (req,res)=>{
    res.render('form')
  })

 // actions after submiting registration form 
 app.post('/register', (req, res) => {

    var username = req.body.username 
    var  msp_id = req.body.msp_id
    var affiliation = req.body.affiliation
    var password = req.body.password
    console.log('welcome '+ username +  ' msp_id : ' + msp_id+ ' affiliation : ' + affiliation + ' password : ' + password )
   
    
                  /*
          * Register and Enroll a user
          */
            // async function main() {
            //     try {

            //         // Create a new file system based wallet for managing identities.
            //         const walletPath = path.join(process.cwd(), 'wallet');
            //         const wallet = new FileSystemWallet(walletPath);
            //         console.log(`Wallet path: ${walletPath}`);

            //         // Check to see if we've already enrolled the user.
            //         const userExists = await wallet.exists(username);
            //         if (userExists) {
            //             console.log('An identity for the user '+username+' already exists in the wallet');
            //             return;
            //         }

            //         // Check to see if we've already enrolled the admin user.
            //         const adminExists = await wallet.exists('admin');
            //         if (!adminExists) {
            //             console.log('An identity for the admin user "admin" does not exist in the wallet');
            //             console.log('Run the enrollAdmin.js application before retrying');
            //             return;
            //         }

            //         // Create a new gateway for connecting to our peer node.
            //         const gateway = new Gateway();
            //         await gateway.connect(ccp, { wallet, identity: 'admin', discovery: { enabled: false } });

            //         // Get the CA client object from the gateway for interacting with the CA.
            //         const ca = gateway.getClient().getCertificateAuthority();
            //         const adminIdentity = gateway.getCurrentIdentity();

            //         // Register the user, enroll the user, and import the new identity into the wallet.
            //         const secret = await ca.register({ affiliation: affiliation, enrollmentID: username, role: 'client' ,enrollmentSecret: password  }, adminIdentity);
            //         const enrollment = await ca.enroll({ enrollmentID: username, enrollmentSecret: secret });
            //         const userIdentity = X509WalletMixin.createIdentity(msp_id, enrollment.certificate, enrollment.key.toBytes());
            //         wallet.import(username, userIdentity);
            //         console.log('Successfully registered and enrolled user '+username+' and imported it into the wallet');
            //         res.send('Successfully registered and enrolled user '+username)
                    
            //         //  /******** now I have to send username, pubkey,cert to chaincode *********/
            //         //  const privkey =  enrollment.key.toBytes()
            //         //  const cert = enrollment.certificate
            //         //  // But how to get public key???? 
            //         //  //one way -> reading from wallet path ..That's why I am using 1.4 version
            //         //  cp.exec( 'cat wallet/'+username+'/*-pub' , function (err, pubKey, stderr) {
            //         //       console.log('pubkey: ',pubKey)
            //         //       await contract.submitTransaction('register', username,pubkey, cert );
            //         //       console.log('Transaction has been submitted');
  
            //         //       // Disconnect from the gateway.
            //         //       await gateway.disconnect();
            //         //  })
           

            //     } catch (error) {
            //         console.error('Failed to register user' + username+' : ${error} ');
            //         process.exit(1);
            //     }
            // }

            // main();
        

          
})
  
// show login form when go /login url
    app.get('/login', (req,res)=>{
        res.render('login')
    })

/**** we have to do next  two things together at any cost ****/
// actions after submitting username ,password in login page
    app.post('/login', (req,res)=>{
  
      var username = req.body.username
      var password = req.body.password
  
      
      msg = 'username: '+username+'password: '+password 
      console.log('msg: ',msg)
  
      //load public key from chaincode 
      // now we just load it from our current local directory
  
      res.render('login')
    })
  
// actions after uploading private key file in login page
  app.post('/upload', upload.single('keyFile'), function (req, res, next) {

    buf = req.file.buffer
    data = buf.toString('utf8')
    console.log(data);
    let privkey = ursa.createPrivateKey(buf);
    let encryptedMsg = privkey.privateEncrypt(msg, 'utf8', 'base64'); 
    console.log('encrypted message: ', encryptedMsg)

     //load public key from chaincode database
  //    async function main() {
  //     try {
  
  //         // Create a new file system based wallet for managing identities.
  //         const walletPath = path.join(process.cwd(), 'wallet');
  //         const wallet = new FileSystemWallet(walletPath);
  //         console.log(`Wallet path: ${walletPath}`);
  
  //         // Check to see if we've already enrolled the user.
  //         const userExists = await wallet.exists(username);
  //         if (!userExists) {
  //             console.log('An identity for the user "user1" does not exist in the wallet');
  //             console.log('Run the registerUser.js application before retrying');
  //             return;
  //         }
  
  //         // Create a new gateway for connecting to our peer node.
  //         const gateway = new Gateway();
  //         await gateway.connect(ccp, { wallet, identity: username, discovery: { enabled: false } });
  
  //         // Get the network (channel) our contract is deployed to.
  //         const network = await gateway.getNetwork('mychannel');
  
  //         // Get the contract from the network.
  //         const contract = network.getContract('fabcar');
  
  //         // send request to get public key of user
  //         /****** have to write getPubKey() function in chaincode */
  //         const result = await contract.evaluateTransaction('getPubKey',username);
  //         console.log(`Transaction has been evaluated, result is: ${result.toString()}`);
  
  //     } catch (error) {
  //         console.error(`Failed to evaluate transaction: ${error}`);
  //         process.exit(1);
  //     }
  // }
  
  // main();
   
  // //verify user signature after getting pubKey
  // // if pubKey is not in buffer form convert it 
  // let pubkey = ursa.createPublicKey(buf);
  // let decryptedMsg = pubkey.publicDecrypt(encryptedMsg, 'base64', 'utf8');
  
  // if (decryptedMsg == msg){
  //   //signature Valid
  // }
  // otherwise not

})
  

var finalData={
    DocID:'',
    Doctype:'',
    PiID:'',
    Humidity:'',
    Temp:''
    
}
function latestData() {
    var Fabric_Client = require('fabric-client');
    var path = require('path');
    var util = require('util');
    var os = require('os');

    //
    var fabric_client = new Fabric_Client();

    // setup the fabric network
    var channel = fabric_client.newChannel('mychannel');
    var peer = fabric_client.newPeer('grpc://localhost:7051');
    channel.addPeer(peer);

    //
    var member_user = null;
    var store_path = path.join(__dirname, 'hfc-key-store');
    console.log('Store path:' + store_path);
    var tx_id = null;

    // create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
    Fabric_Client.newDefaultKeyValueStore({
        path: store_path
    }).then((state_store) => {
        // assign the store to the fabric client
        fabric_client.setStateStore(state_store);
        var crypto_suite = Fabric_Client.newCryptoSuite();
        // use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept)
        var crypto_store = Fabric_Client.newCryptoKeyStore({
            path: store_path
        });
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // get the enrolled user from persistence, this user will sign all requests
        return fabric_client.getUserContext('user1', true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user1 from persistence');
            member_user = user_from_store;
        } else {
            throw new Error('Failed to get user1.... run registerUser.js');
        }

        // queryCar chaincode function - requires 1 argument, ex: args: ['CAR4'],
        // queryAllCars chaincode function - requires no arguments , ex: args: [''],
        const request = {
            //targets : --- varting this default to the peers assigned to the channel
            chaincodeId: 'fabcar',
            fcn: 'lastData',
            args: ['']
        };

        // send the query proposal to the peer
        return channel.queryByChaincode(request);
    }).then((query_responses) => {
        console.log("Query has compvared, checking results");
        // query_responses could have more than one  results if there multiple peers were used as targets
        if (query_responses && query_responses.length == 1) {
            if (query_responses[0] instanceof Error) {
                console.error("error from query = ", query_responses[0]);
            } else {
                console.log("latestDataResponse is :", JSON.parse(query_responses[0]));
                finalData=JSON.parse(query_responses[0])
                console.log('====================================');
                console.log("finalData ",finalData);
                console.log('====================================');
                 io.emit('data',finalData)
            }
        } else {
            console.log("No payloads were returned from query");
        }
    }).catch((err) => {
        console.error('Failed to query successfully :: ' + err);
    });
}


function showIP() {
    var os = require('os');
    var ifaces = os.networkInterfaces();

    Object.keys(ifaces).forEach(function (ifname) {
        var alias = 0;

        ifaces[ifname].forEach(function (iface) {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
                return;
            }

            if (alias >= 1) {
                // this single interface has multiple ipv4 addresses
                console.log(ifname + ':' + alias, iface.address);
            } else {
                // this interface has only one ipv4 adress
                console.log(ifname, iface.address);
            }
            ++alias;
        });
    });

}
io.on('connection', function (socket) {
    console.log('a user connected');
    socket.on('disconnect', function () {
        console.log('user disconnected');
    })
});


showIP()
server.listen(port, err => {
    if (err) {
        throw err
    } else {
        console.log('server started on port :3000');
    }

})