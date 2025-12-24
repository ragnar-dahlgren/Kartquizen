// Firebase Configuration
// Using standard firebaseio.com (US-Central1) based on trouble with EU region previously.
const firebaseConfig = {
    apiKey: "AIzaSyBaMWSAZ8mO9-ss_TNMIBXjPR6r4ZKU5So",
    authDomain: "kartquizen.firebaseapp.com",
    databaseURL: "https://kartquizen-default-rtdb.firebaseio.com",
    projectId: "kartquizen",
    storageBucket: "kartquizen.firebasestorage.app",
    messagingSenderId: "876893652386",
    appId: "1:876893652386:web:8b86b11b95d86dbd045efb",
    measurementId: "G-1CQLEKYKMD"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Explicitly get database reference
// We try the default US URL first as a hypothesis fix.
const db = firebase.database();

console.log("Firebase initialized");

// DOM Elements
const startScreen = document.getElementById('start-screen');
const statusMessage = document.getElementById('status-message');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');

// Test Connection immediately
const connectedRef = db.ref(".info/connected");
connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
        console.log("Connected to Firebase!");
        statusMessage.textContent = "Ansluten till server ✓";
        statusMessage.style.color = "#4caf50";
        createRoomBtn.disabled = false;
        joinRoomBtn.disabled = false;
    } else {
        console.log("Disconnected from Firebase");
        statusMessage.textContent = "Ansluter...";
        statusMessage.style.color = "#ffeb3b";
    }
});

// Basic Button Logic (Placeholder for full game)
createRoomBtn.addEventListener('click', () => {
    const name = document.getElementById('username-input').value;
    if (!name) { alert("Vänligen ange namn"); return; }
    console.log("Creating room for " + name);
    // TODO: Implement Create Room
});

joinRoomBtn.addEventListener('click', () => {
    const name = document.getElementById('username-input').value;
    if (!name) { alert("Vänligen ange namn"); return; }
    const code = document.getElementById('room-code-input').value;
    console.log("Joining room " + code);
    // TODO: Implement Join Room
});
