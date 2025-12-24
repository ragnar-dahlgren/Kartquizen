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
console.log("Firebase initialized - VERSION 8 LOADED (Host Mode)");

// --- Global State ---
let currentPlayer = { id: null, name: null };
let currentRoomId = null;
let map = null;
let tempMarker = null; // For map picker
let quizDraft = []; // Stores questions being created
let selectedLocation = null; // {lat, lng} for current question

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

// Inputs
const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const qText = document.getElementById('q-text');
const qImage = document.getElementById('q-image');
const qTime = document.getElementById('q-time');
const locationStatus = document.getElementById('location-status');
const questionsList = document.getElementById('questions-list');
const qCount = document.getElementById('q-count');

// --- Initialization ---
const connectedRef = db.ref(".info/connected");
connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
        statusMessage.textContent = "Ansluten till server ✓";
        statusMessage.style.color = "#4caf50";
        hostModeBtn.disabled = false;
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

    // Map Interaction Logic
    map.off('click'); // Clear old listeners
    if (interactive) {
        map.on('click', onMapClick);
        document.getElementById('map').style.cursor = "crosshair";
    } else {
        document.getElementById('map').style.cursor = "grab";
    }
}

// --- Host Mode Logic ---

hostModeBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (!name) { alert("Ange ditt namn först!"); return; }
    currentPlayer.name = name;

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
    initMap(true); // Enable interaction
});

function onMapClick(e) {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker(e.latlng).addTo(map);
    selectedLocation = e.latlng;
}

confirmLocationBtn.addEventListener('click', () => {
    if (!selectedLocation) { alert("Klicka på kartan först!"); return; }

    // Return to Host Screen
    gameScreen.classList.add('hidden');
    mapPickerUI.classList.add('hidden');
    hostScreen.classList.remove('hidden');

    locationStatus.textContent = "Vald ✓";
    locationStatus.style.color = "#4caf50";
    if (tempMarker) map.removeLayer(tempMarker);
});

cancelPickerBtn.addEventListener('click', () => {
    gameScreen.classList.add('hidden');
    mapPickerUI.classList.add('hidden');
    hostScreen.classList.remove('hidden');
    selectedLocation = null;
    if (tempMarker) map.removeLayer(tempMarker);
});

// Add Question Flow
addQuestionBtn.addEventListener('click', () => {
    const text = qText.value.trim();
    const time = parseInt(qTime.value);

    if (!text) { alert("Skriv en fråga!"); return; }
    if (!selectedLocation) { alert("Välj en plats!"); return; }

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
    selectedLocation = null;
    locationStatus.textContent = "Ännu ej vald";
    locationStatus.style.color = "white";
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
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();

    const roomData = {
        host: currentPlayer.name,
        status: 'lobby',
        questions: quizDraft,
        currentQuestionIndex: -1,
        players: {} // Add host as observer? Or just player?
    };

    db.ref('rooms/' + roomId).set(roomData)
        .then(() => {
            console.log("Room created:", roomId);
            alert("Quiz skapat! Rum: " + roomId);
            // TODO: Navigate to Lobby (Next Step)
        });
});

// --- Join Room (Legacy Support for now) ---
joinRoomBtn.addEventListener('click', () => {
    alert("Funktion under konstruktion för nya systemet.");
});
