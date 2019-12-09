/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';
let sha256 = require('js-sha256')
const { FileSystemWallet, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

async function main() {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists('user1');
        if (!userExists) {
            console.log('An identity for the user "user1" does not exist in the wallet');
            console.log('Run the registerUser.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'user1', discovery: { enabled: false } });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('mychannel');

        // Get the contract from the network.
        const contract = network.getContract('fabcar');

        // Submit the specified transaction.
        var piId = 'Pi0'
        var pass = '10101010'
	    var cert = '-----BEGIN CERTIFICATE-----MIICkjCCAjmgAwIBAgIUXw7NYSyYh0XMrkT5oUnFrt0OzDgwCgYIKoZIzj0EAwIwczELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExFjAUBgNVBAcTDVNhbiBGcmFuY2lzY28xGTAXBgNVBAoTEG9yZzEuZXhhbXBsZS5jb20xHDAaBgNVBAMTE2NhLm9yZzEuZXhhbXBsZS5jb20wHhcNMTkxMDI1MTIzNDAwWhcNMjAxMDI0MTIzOTAwWjBEMTAwDQYDVQQLEwZjbGllbnQwCwYDVQQLEwRvcmcxMBIGA1UECxMLZGVwYXJ0bWVudDExEDAOBgNVBAMTB3Nob3VtaWswWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAAQfFKLxJ5fu5/I68lw4cmwIz5xtgMnMDzGBqJQqEpmmW3dONaTwxfIcMJLBumnuYVeFu0IKZS97VeFShLLYo/IFo4HZMIHWMA4GA1UdDwEB/wQEAwIHgDAMBgNVHRMBAf8EAjAAMB0GA1UdDgQWBBQg6RvsVtcHGt7oGGv+HBPz2VphRjArBgNVHSMEJDAigCBCOaoNzXba7ri6DNpwGFHRRQTTGq0bLd3brGpXNl5JfDBqBggqAwQFBgcIAQReeyJhdHRycyI6eyJoZi5BZmZpbGlhdGlvbiI6Im9yZzEuZGVwYXJ0bWVudDEiLCJoZi5FbnJvbGxtZW50SUQiOiJzaG91bWlrIiwiaGYuVHlwZSI6ImNsaWVudCJ9fTAKBggqhkjOPQQDAgNHADBEAiA0CcBZZFCiLzLnxWQnFDOWhJZPUbVL/wqXQN8+J0k8RQIgH/0/eAyVcw2Ov67J+nHr74kEvoaOEHJhIT08ngzKb/g=-----END CERTIFICATE-----'
	    var pubKey = '-----BEGIN PUBLIC KEY-----MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEHxSi8SeX7ufyOvJcOHJsCM+cbYDJzA8xgaiUKhKZplt3TjWk8MXyHDCSwbpp7mFXhbtCCmUve1XhUoSy2KPyBQ==-----END PUBLIC KEY-----'
        var namePass = sha256(piId+pass)
        await contract.submitTransaction('registerPi', piId, cert, pubKey, namePass);
        console.log('Transaction has been submitted');

        // Disconnect from the gateway.
        await gateway.disconnect();

    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        process.exit(1);
    }
}

main();
