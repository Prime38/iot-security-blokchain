/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
let sh = require('shelljs'),

sha256 = require('js-sha256')
const { FileSystemWallet, Gateway, X509WalletMixin } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

var user = {
    name: 'Manufacturer',
    mspId: 'Org1MSP',
    affiliation: 'org1.department1',
    password: sha256('manufacturer')
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
    
    
    return sendInfo(user)
}).then((isSuccess) => {
    console.log();
    console.log('Transaction status isSuccessful : ', isSuccess)
}).catch((err) => {
    console.error('Failed to register at blockchain network : ' + err);
});
