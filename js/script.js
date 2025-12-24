// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBaMWSAZ8mO9-ss_TNMIBXjPR6r4ZKU5So",
    authDomain: "kartquizen.firebaseapp.com",
    databaseURL: "https://kartquizen-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "kartquizen",
    storageBucket: "kartquizen.firebasestorage.app",
    messagingSenderId: "876893652386",
    appId: "1:876893652386:web:8b86b11b95d86dbd045efb",
    measurementId: "G-1CQLEKYKMD"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.app().database("https://kartquizen-default-rtdb.europe-west1.firebasedatabase.app");
console.log("Firebase initialized - VERSION 10 LOADED (Lobby + QR)");

// --- Global State ---
let currentPlayer = { id: null, name: null };
let currentRoomId = null;
let map = null;
let tempMarker = null;
let quizDraft = [];
let selectedLocation = null;
let isGlobalHost = false;

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const hostScreen = document.getElementById('host-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const mapPickerUI = document.getElementById('map-picker-ui');
const statusMessage = document.getElementById('status-message');

// Buttons
const hostModeBtn = document.getElementById('host-mode-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const backToStartBtn = document.getElementById('back-to-start-btn');
const pickLocationBtn = document.getElementById('pick-location-btn');
const addQuestionBtn = document.getElementById('add-question-btn');
const startQuizBtn = document.getElementById('start-quiz-btn');
const confirmLocationBtn = document.getElementById('confirm-location-btn');
const cancelPickerBtn = document.getElementById('cancel-picker-btn');
const testQuestionBtn = document.getElementById('test-question-btn');
const lobbyStartBtn = document.getElementById('lobby-start-btn');

// Inputs & Displays
const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const qText = document.getElementById('q-text');
const qImage = document.getElementById('q-image');
const qTime = document.getElementById('q-time');
const qLat = document.getElementById('q-lat');
const qLng = document.getElementById('q-lng');
const questionsList = document.getElementById('questions-list');
const qCount = document.getElementById('q-count');
const pickerLat = document.getElementById('picker-lat');
const pickerLng = document.getElementById('picker-lng');

// Lobby Elements
const lobbyRoomCode = document.getElementById('lobby-room-code');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyStatusText = document.getElementById('lobby-status-text');
const qrCodeContainer = document.getElementById('qrcode-container');

// --- Initialization ---
const connectedRef = db.ref(".info/connected");
connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
        statusMessage.textContent = "Ansluten till server ✓";
        statusMessage.style.color = "#4caf50";
        joinRoomBtn.disabled = false;
    } else {
        statusMessage.textContent = "Ansluter...";
        statusMessage.style.color = "#ffeb3b";
    }
});

function initMap(interactive = false) {
    if (!map) {
        map = L.map('map', {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            maxBounds: [[-90, -180], [90, 180]]
        });

        fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
            .then(res => res.json())
            .then(data => {
                L.geoJSON(data, {
                    style: function () {
                        return { fillColor: '#2E4A28', weight: 1, opacity: 1, color: '#34522F', fillOpacity: 1 };
                    }
                }).addTo(map);
            });
    }

    map.off('click');
    if (interactive) {
        map.on('click', onMapClick);
        document.getElementById('map').style.cursor = "crosshair";
    } else {
        document.getElementById('map').style.cursor = "grab";
    }
}

// --- Host Mode Logic ---
hostModeBtn.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    hostScreen.classList.remove('hidden');
});

backToStartBtn.addEventListener('click', () => {
    hostScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// Map Picker Flow
pickLocationBtn.addEventListener('click', () => {
    hostScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    mapPickerUI.classList.remove('hidden');
    initMap(true);

    const lat = parseFloat(qLat.value);
    const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) {
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.marker([lat, lng]).addTo(map);
        map.setView([lat, lng], 5);
        updatePickerDisplay(lat, lng);
    }
});

function onMapClick(e) {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker(e.latlng).addTo(map);
    selectedLocation = e.latlng;
    updatePickerDisplay(e.latlng.lat, e.latlng.lng);
}

function updatePickerDisplay(lat, lng) {
    pickerLat.textContent = "Lat: " + lat.toFixed(4);
    pickerLng.textContent = "Lng: " + lng.toFixed(4);
}

confirmLocationBtn.addEventListener('click', () => {
    if (!selectedLocation && (!tempMarker)) { alert("Klicka på kartan först!"); return; }

    if (tempMarker) {
        selectedLocation = tempMarker.getLatLng();
    }
    qLat.value = selectedLocation.lat.toFixed(6);
    qLng.value = selectedLocation.lng.toFixed(6);

    gameScreen.classList.add('hidden');
    mapPickerUI.classList.add('hidden');
    hostScreen.classList.remove('hidden');
    if (tempMarker) map.removeLayer(tempMarker);
});

cancelPickerBtn.addEventListener('click', () => {
    gameScreen.classList.add('hidden');
    mapPickerUI.classList.add('hidden');
    hostScreen.classList.remove('hidden');
    if (tempMarker) map.removeLayer(tempMarker);
});

function syncManualCoords() {
    const lat = parseFloat(qLat.value);
    const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) {
        selectedLocation = { lat: lat, lng: lng };
    }
}
qLat.addEventListener('change', syncManualCoords);
qLng.addEventListener('change', syncManualCoords);

testQuestionBtn.addEventListener('click', () => {
    const text = qText.value.trim();
    const img = qImage.value.trim();
    if (!text) { alert("Skriv en fråga att testa!"); return; }
    alert(`PREVIEW:\nFråga: ${text}\nBild: ${img ? "JA" : "NEJ"}\nTid: ${qTime.value}s\n\n(Detta är bara ett test, inget sparas)`);
});

addQuestionBtn.addEventListener('click', () => {
    syncManualCoords();
    const text = qText.value.trim();
    const time = parseInt(qTime.value);

    if (!text) { alert("Skriv en fråga!"); return; }
    if (!selectedLocation) { alert("Ange koordinater!"); return; }

    const question = {
        id: Date.now(),
        text: text,
        image: qImage.value.trim(),
        timeLimit: time,
        correctAnswer: selectedLocation
    };

    quizDraft.push(question);
    updateQuestionsList();
    resetForm();
});

function resetForm() {
    qText.value = "";
    qImage.value = "";
    qTime.value = 30;
    qLat.value = "";
    qLng.value = "";
    selectedLocation = null;
}

function updateQuestionsList() {
    questionsList.innerHTML = "";
    quizDraft.forEach((q, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}. ${q.text}</span> <button class="btn small failed" onclick="removeQuestion(${index})">X</button>`;
        questionsList.appendChild(li);
    });
    qCount.textContent = quizDraft.length;
    startQuizBtn.disabled = quizDraft.length === 0;
}

window.removeQuestion = (index) => {
    quizDraft.splice(index, 1);
    updateQuestionsList();
};

// --- Lobby Logic ---

startQuizBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim() || "Host";
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    const roomData = {
        host: name,
        status: 'lobby',
        questions: quizDraft,
        currentQuestionIndex: -1,
        players: {}
    };

    db.ref('rooms/' + roomId).set(roomData)
        .then(() => {
            console.log("Room created:", roomId);
            isGlobalHost = true;
            enterLobby(roomId, true);
        });
});

function enterLobby(roomId, isHost) {
    currentRoomId = roomId;
    startScreen.classList.add('hidden');
    hostScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');

    lobbyRoomCode.textContent = roomId;
    qrCodeContainer.innerHTML = "";

    // Generate QR Code
    const joinUrl = window.location.href.split('?')[0] + "?room=" + roomId;
    new QRCode(qrCodeContainer, {
        text: joinUrl,
        width: 128,
        height: 128
    });

    if (isHost) {
        lobbyStartBtn.classList.remove('hidden');
        lobbyStatusText.textContent = "Du är Host. Starta när alla är med.";
    } else {
        lobbyStartBtn.classList.add('hidden');
        lobbyStatusText.textContent = "Väntar på att Host ska starta spelet...";
    }

    // Listen for players
    db.ref(`rooms/${roomId}/players`).on('value', (snapshot) => {
        lobbyPlayersList.innerHTML = "";
        const players = snapshot.val() || {};
        const count = Object.keys(players).length;
        lobbyPlayerCount.textContent = count;

        Object.values(players).forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name;
            lobbyPlayersList.appendChild(li);
        });
    });

    // Listen for Game Start (Status Change)
    db.ref(`rooms/${roomId}/status`).on('value', (snap) => {
        const status = snap.val();
        if (status === 'game_active') {
            startGameFlow();
        }
    });
}

lobbyStartBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    db.ref(`rooms/${currentRoomId}`).update({
        status: 'game_active',
        currentQuestionIndex: 0
    });
});

function startGameFlow() {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initMap(true);

    // Placeholder logic for now
    document.getElementById('round-info').textContent = "Spelet har startat! (Logic Loading...)";

    // Here we will hook into the Game Loop next
}

// Join Room Logic
joinRoomBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();

    if (!name || !code) { alert("Fyll i namn och kod!"); return; }

    db.ref('rooms/' + code).once('value', snap => {
        if (snap.exists()) {
            const userId = db.ref().child('rooms').push().key;
            db.ref(`rooms/${code}/players/${userId}`).set({
                name: name,
                score: 0
            }).then(() => {
                enterLobby(code, false);
            });
        } else {
            alert("Rummet finns inte!");
        }
    });
});

// Auto-join if URL param exists (Optional polish)
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
    roomCodeInput.value = roomParam;
}
