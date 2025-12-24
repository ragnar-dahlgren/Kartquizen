// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBaMWSAZ8mO9-ss_TNMIBXjPR6r4ZKU5So",
    authDomain: "kartquizen.firebaseapp.com",
    databaseURL: "https://kartquizen-default-rtdb.europe-west1.firebasedatabase.app", // EXPLICIT EU URL
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

// Explicitly get database reference with the EU URL
const db = firebase.app().database("https://kartquizen-default-rtdb.europe-west1.firebasedatabase.app");

console.log("Firebase initialized");

// Global State
let currentPlayer = {
    id: null,
    name: null,
    score: 0
};
let currentRoomId = null;
let map = null;
let markers = {};

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const statusMessage = document.getElementById('status-message');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const playerScoreEl = document.getElementById('player-score'); // Ensure this ID exists in HTML
const roundInfoEl = document.getElementById('round-info'); // Ensure this ID exists in HTML

// Test Connection
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

// --- Game Logic ---

function generateRoomId() {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function initMap() {
    if (map) return;
    map = L.map('map').setView([20, 0], 2); // Stockholm Default
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
}

function showGameScreen() {
    startScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initMap();
}

function createRoom() {
    const name = usernameInput.value.trim();
    if (!name) { alert("Ange ditt namn!"); return; }

    const roomId = generateRoomId();
    const userId = db.ref().child('rooms').push().key; // Generate unique ID

    currentPlayer.name = name;
    currentPlayer.id = userId;
    currentRoomId = roomId;

    const roomData = {
        host: name,
        status: 'waiting',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        players: {
            [userId]: {
                name: name,
                score: 0
            }
        }
    };

    db.ref('rooms/' + roomId).set(roomData)
        .then(() => {
            console.log("Room created:", roomId);
            enterRoom(roomId);
        })
        .catch((error) => {
            console.error("Error creating room:", error);
            alert("Kunde inte skapa rum: " + error.message);
        });
}

function joinRoom() {
    const name = usernameInput.value.trim();
    const roomId = roomCodeInput.value.trim().toUpperCase();

    if (!name) { alert("Ange ditt namn!"); return; }
    if (!roomId) { alert("Ange rumskod!"); return; }

    const userId = db.ref().child('rooms').push().key;
    currentPlayer.name = name;
    currentPlayer.id = userId;

    const roomRef = db.ref('rooms/' + roomId);

    roomRef.once('value', (snapshot) => {
        if (snapshot.exists()) {
            // Add player
            roomRef.child('players/' + userId).set({
                name: name,
                score: 0
            }).then(() => {
                currentRoomId = roomId;
                enterRoom(roomId);
            });
        } else {
            alert("Rummet hittades inte!");
        }
    });
}

function enterRoom(roomId) {
    showGameScreen();
    // Listen for room updates (e.g. other players)
    const playersRef = db.ref('rooms/' + roomId + '/players');
    playersRef.on('value', (snapshot) => {
        const players = snapshot.val();
        console.log("Players updated:", players);
        updateUI(players);
    });

    // Show Room ID in UI
    roundInfoEl.textContent = "Rum: " + roomId;
}

function updateUI(players) {
    // Here we can update the leaderboard or show markers for other players
    // For now, just logging
    let count = Object.keys(players || {}).length;
    playerScoreEl.textContent = `Spelare: ${count}`;
}

// Event Listeners
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
