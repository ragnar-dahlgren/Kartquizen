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
console.log("Firebase initialized - VERSION 9 LOADED (Coords & Lobby Logic)");

// --- Global State ---
let currentPlayer = { id: null, name: null };
let currentRoomId = null;
let map = null;
let tempMarker = null;
let quizDraft = [];
let selectedLocation = null;

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const hostScreen = document.getElementById('host-screen');
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

// Inputs
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
    // Optional: Ask for name if not set, but not strictly required for just authoring
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

    // Pre-fill if lat/lng exists manually
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

    // Sync back to inputs
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

// Sync Manual Inputs to SelectedLocation object
function syncManualCoords() {
    const lat = parseFloat(qLat.value);
    const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) {
        selectedLocation = { lat: lat, lng: lng };
    }
}
qLat.addEventListener('change', syncManualCoords);
qLng.addEventListener('change', syncManualCoords);


// Test Question Flow
testQuestionBtn.addEventListener('click', () => {
    const text = qText.value.trim();
    const img = qImage.value.trim();

    if (!text) { alert("Skriv en fråga att testa!"); return; }

    alert(`PREVIEW:\nFråga: ${text}\nBild: ${img ? "JA" : "NEJ"}\nTid: ${qTime.value}s\n\n(Detta är bara ett test, inget sparas)`);
});


// Add Question Flow
addQuestionBtn.addEventListener('click', () => {
    syncManualCoords(); // Ensure manual inputs are captured
    const text = qText.value.trim();
    const time = parseInt(qTime.value);

    if (!text) { alert("Skriv en fråga!"); return; }
    if (!selectedLocation) { alert("Ange koordinater (karta eller siffror)!"); return; }

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

// Start Game Flow
startQuizBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim() || "Host"; // Fallback name
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    const roomData = {
        host: name,
        status: 'lobby', // Important: Lobby state!
        questions: quizDraft,
        currentQuestionIndex: -1,
        players: {}
    };

    db.ref('rooms/' + roomId).set(roomData)
        .then(() => {
            console.log("Room created:", roomId);
            enterLobby(roomId, true); // true = isHost
        });
});

function enterLobby(roomId, isHost) {
    hostScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    // For now, simpler game screen usage
    gameScreen.classList.remove('hidden');
    initMap(false); // Map view only

    alert(`LOBBY STARTED!\nRoom Code: ${roomId}\n(Delas med vänner)\n\nHost kan snart starta spelet härifrån.`);
    document.getElementById('round-info').textContent = `Lobby: ${roomId}`;
}

// Join Room Logic
joinRoomBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();

    if (!name || !code) { alert("Fyll i namn och kod!"); return; }

    // Check if room exists
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
