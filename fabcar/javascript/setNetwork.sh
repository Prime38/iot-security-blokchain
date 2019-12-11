cd ..
./killNetwork.sh 
./startFabric.sh
cd javascript
rm -rf wallet
node enrollAdmin.js
node registerUser.js
node generateManufacturer.js
