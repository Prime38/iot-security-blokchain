console.log("firebaseRTDB.js file loaded");

// TODO: Replace the following with your app's Firebase project configuration
var firebaseConfig = {
    apiKey: "AIzaSyAond5Qk3u5eTzw5Xv6YClXeO4h-WgdD3o",
    authDomain: "betabase-8e34f.firebaseapp.com",
    databaseURL: "https://betabase-8e34f.firebaseio.com",
    projectId: "betabase-8e34f",
    storageBucket: "betabase-8e34f.appspot.com",
    messagingSenderId: "954186561935",
    appId: "1:954186561935:web:a690142f5d0266238173fa",
    measurementId: "G-XV126SJZSK"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
// let preObject = document.getElementById('object')
// let ulList=document.getElementById('list')

// // Get a reference to the database service
// const database = firebase.database();

// let dbRefObject = firebase.database().ref().child('notifications')

// dbRefObject.on('value', (snap) => {
//     console.log(snap.val());

// })
// dbRefObject.child('shoumik').on('child_added',snap=>{
//     let li=document.createElement('li')
//     li.innerText=snap.val()
//     ulList.appendChild(li)
// })

// function writeData(name, time, data){
//     firebase.database().ref('notifications').child(name).child(time).set(data)
// }
// writeData('shoumik',new Date().toUTCString(),"hello")