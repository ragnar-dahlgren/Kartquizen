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
console.log("Firebase initialized - VERSION 13 LOADED (Persistence + Control Flow)");

// --- Global State ---
let currentPlayer = { id: null, name: null, score: 0 };
let currentRoomId = null;
let currentQuizId = null; // New for persistence
let map = null;
let tempMarker = null;
let quizDraft = [];
let selectedLocation = null;
let isGlobalHost = false;
let isDryRun = false;
let gameQuestions = [];
let currentQIndex = 0;
let timerInterval = null;
let playerGuessMarker = null;
let correctMarker = null;
let answerLine = null;

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const hostScreen = document.getElementById('host-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const mapPickerUI = document.getElementById('map-picker-ui');
const statusMessage = document.getElementById('status-message');
const loadQuizSection = document.getElementById('load-quiz-section'); // New

// Game UI Elements
const questionOverlay = document.getElementById('question-overlay');
const questionBox = document.querySelector('.question-box');
const gameQuestionText = document.getElementById('game-question-text');
const gameImageContainer = document.getElementById('game-image-container');
const gameQuestionImage = document.getElementById('game-question-image');
const timerFill = document.getElementById('timer-fill');
const timerText = document.getElementById('timer-text');
const feedbackOverlay = document.getElementById('feedback-overlay');
const feedbackText = document.getElementById('feedback-text');
const feedbackSubtext = document.getElementById('feedback-subtext');
const nextQuestionBtn = document.getElementById('next-question-btn');
const gotoLeaderboardBtn = document.getElementById('goto-leaderboard-btn'); // New
const leaderboardOverlay = document.getElementById('leaderboard-overlay'); // New
const liveLeaderboardList = document.getElementById('live-leaderboard-list'); // New
const submitGuessBtn = document.getElementById('submit-guess-btn');
const pickerInstruction = document.getElementById('picker-instruction');

// Buttons & Inputs
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
const testRunBtn = document.getElementById('test-run-btn');
const saveQuizBtn = document.getElementById('save-quiz-btn'); // New
const loadQuizBtn = document.getElementById('load-quiz-btn'); // New

const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const quizLoadCode = document.getElementById('quiz-load-code'); // New
const currentQuizIdDisplay = document.getElementById('current-quiz-id'); // New

const qText = document.getElementById('q-text');
const qImage = document.getElementById('q-image');
const qTime = document.getElementById('q-time');
const qLat = document.getElementById('q-lat');
const qLng = document.getElementById('q-lng');
const questionsList = document.getElementById('questions-list');
const qCount = document.getElementById('q-count');
const pickerLat = document.getElementById('picker-lat');
const pickerLng = document.getElementById('picker-lng');
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

        // "Greenwich utzoomat" - Standard view
        map.setView([20, 0], 2);

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

function enableMapInteraction() {
    if (!map) return;
    map.off('click');
    map.on('click', onMapClick);
    document.getElementById('map').style.cursor = "crosshair";
}

function disableMapInteraction() {
    if (!map) return;
    map.off('click');
    document.getElementById('map').style.cursor = "default";
}


// --- Navigation & Basic Logic ---
hostModeBtn.addEventListener('click', () => {
    // Toggle Load Quiz Section
    if (loadQuizSection.classList.contains('hidden')) {
        loadQuizSection.classList.remove('hidden');
    } else {
        startScreen.classList.add('hidden');
        hostScreen.classList.remove('hidden');
    }
});

backToStartBtn.addEventListener('click', () => {
    hostScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
});

// --- PERSISTENCE LOGIC (Save/Load) ---

saveQuizBtn.addEventListener('click', () => {
    if (quizDraft.length === 0) { alert("Inga frågor att spara!"); return; }

    // Generate new ID if not existing
    if (!currentQuizId) {
        currentQuizId = "QUIZ-" + Math.floor(1000 + Math.random() * 9000); // Ex: QUIZ-4521
    }

    db.ref('quizzes/' + currentQuizId).set({
        questions: quizDraft,
        created: Date.now()
    }).then(() => {
        currentQuizIdDisplay.textContent = `ID: ${currentQuizId} (Sparat!)`;
        alert(`Quiz sparat!\nID: ${currentQuizId}\n\nSpara detta ID för att ladda quizet senare.`);
    });
});

loadQuizBtn.addEventListener('click', () => {
    const id = quizLoadCode.value.trim().toUpperCase();
    if (!id) { alert("Ange ett Quiz-ID!"); return; }

    db.ref('quizzes/' + id).once('value', snap => {
        if (snap.exists()) {
            const data = snap.val();
            quizDraft = data.questions || [];
            currentQuizId = id;
            updateQuestionsList();

            // Go to Host Screen
            startScreen.classList.add('hidden');
            hostScreen.classList.remove('hidden');
            currentQuizIdDisplay.textContent = `ID: ${currentQuizId}`;
        } else {
            alert("Hittade inget quiz med det IDt.");
        }
    });
});


// --- Map Picker (Host Mode) ---
pickLocationBtn.addEventListener('click', () => {
    hostScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    mapPickerUI.classList.remove('hidden');
    submitGuessBtn.classList.add('hidden');
    confirmLocationBtn.classList.remove('hidden');
    initMap(true);

    // If saving/loading coordinates
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
    if (pickerLat) updatePickerDisplay(e.latlng.lat, e.latlng.lng);
}

function updatePickerDisplay(lat, lng) {
    if (pickerLat) pickerLat.textContent = "Lat: " + lat.toFixed(4);
    if (pickerLng) pickerLng.textContent = "Lng: " + lng.toFixed(4);
}

confirmLocationBtn.addEventListener('click', () => {
    if (!selectedLocation && (!tempMarker)) { alert("Klicka på kartan först!"); return; }
    if (tempMarker) selectedLocation = tempMarker.getLatLng();
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
    if (!gameQuestions.length || ((isGlobalHost && !isDryRun) && gameQuestions.length > 0)) {
        hostScreen.classList.remove('hidden');
    }
    if (tempMarker) map.removeLayer(tempMarker);
});

// --- Host Form Logic ---
function syncManualCoords() {
    const lat = parseFloat(qLat.value);
    const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) {
        selectedLocation = { lat: lat, lng: lng };
    }
}
qLat.addEventListener('change', syncManualCoords);
qLng.addEventListener('change', syncManualCoords);

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
    testRunBtn.disabled = quizDraft.length === 0;
    saveQuizBtn.disabled = quizDraft.length === 0;
}

window.removeQuestion = (index) => {
    quizDraft.splice(index, 1);
    updateQuestionsList();
};


// --- GAME ENGINE ---

testRunBtn.addEventListener('click', () => {
    gameQuestions = [...quizDraft];
    isGlobalHost = true;
    isDryRun = true;
    hostScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initMap(false);

    currentQIndex = 0;
    document.getElementById('round-info').textContent = "TEST MODE";
    startQuestionPhase1();
});

// Lobby Start (Real Game)
startQuizBtn.addEventListener('click', () => {
    gameQuestions = [...quizDraft];
    const name = usernameInput.value.trim() || "Lekledare";
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    currentRoomId = roomId;

    const roomData = {
        host: name,
        status: 'lobby',
        questions: gameQuestions,
        currentQuestionIndex: -1,
        players: {}
    };

    db.ref('rooms/' + roomId).set(roomData)
        .then(() => {
            isGlobalHost = true;
            isDryRun = false;
            enterLobby(roomId, true);
        });
});

function enterLobby(roomId, isHost) {
    startScreen.classList.add('hidden');
    hostScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');

    lobbyRoomCode.textContent = roomId;
    qrCodeContainer.innerHTML = "";
    new QRCode(qrCodeContainer, { text: window.location.href.split('?')[0] + "?room=" + roomId, width: 128, height: 128 });

    if (isHost) {
        lobbyStartBtn.classList.remove('hidden');
        lobbyStatusText.textContent = "Du är Lekledare. Starta när alla är med.";
    } else {
        lobbyStartBtn.classList.add('hidden');
        lobbyStatusText.textContent = "Väntar på att Lekledaren ska starta spelet...";

        db.ref(`rooms/${roomId}/status`).on('value', (snap) => {
            // Game State Sync for Players
            const state = snap.val();
            if (state === 'game_active') {
                // Trigger fetch questions if not saving them locally
                db.ref(`rooms/${roomId}/questions`).once('value', qSnap => {
                    gameQuestions = qSnap.val();
                    startGameFlow();
                });
            }
        });
    }
}

lobbyStartBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    db.ref(`rooms/${currentRoomId}`).update({
        status: 'game_active',
        currentQuestionIndex: 0
    });
    startGameFlow();
});

function startGameFlow() {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    initMap(false);
    currentQIndex = 0;
    startQuestionPhase1();
}

// --- PHASE 1: PREVIEW (Reading) ---
function startQuestionPhase1() {
    if (currentQIndex >= gameQuestions.length) {
        endGame();
        return;
    }

    // MAP RESET (Crucial Requirement)
    if (map) map.setView([20, 0], 2);

    const question = gameQuestions[currentQIndex];
    document.getElementById('round-info').textContent = `Fråga: ${currentQIndex + 1}/${gameQuestions.length}`;

    // Clear State
    if (playerGuessMarker) map.removeLayer(playerGuessMarker);
    if (correctMarker) map.removeLayer(correctMarker);
    if (answerLine) map.removeLayer(answerLine);
    if (tempMarker) map.removeLayer(tempMarker);

    disableMapInteraction();

    // UI: Maximize Overlay
    feedbackOverlay.classList.add('hidden');
    leaderboardOverlay.classList.add('hidden'); // Clear leaderboard
    questionOverlay.classList.remove('hidden');
    questionBox.classList.remove('minimized');
    mapPickerUI.classList.add('hidden');

    gameQuestionText.textContent = question.text;

    if (question.image) {
        gameQuestionImage.src = question.image;
        gameImageContainer.classList.remove('hidden');
        gameImageContainer.classList.remove('mini-img');
    } else {
        gameImageContainer.classList.add('hidden');
    }

    timerText.textContent = "Läs frågan...";
    timerFill.style.width = "100%";

    setTimeout(() => {
        startQuestionPhase2(question);
    }, 4000);
}

// --- PHASE 2: ACTION (Guessing) ---
function startQuestionPhase2(question) {
    questionBox.classList.add('minimized');
    if (question.image) gameImageContainer.classList.add('mini-img');

    mapPickerUI.classList.remove('hidden');
    submitGuessBtn.classList.remove('hidden');
    confirmLocationBtn.classList.add('hidden');

    enableMapInteraction();
    pickerInstruction.textContent = "Klicka på kartan nu!";

    let timeLeft = question.timeLimit || 30;
    timerText.textContent = timeLeft;

    if (timerInterval) clearInterval(timerInterval);
    const totalTime = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft--;
        timerText.textContent = timeLeft;
        timerFill.style.width = (timeLeft / totalTime * 100) + "%";

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timeIsUp();
        }
    }, 1000);
}

// Player Guess Logic
submitGuessBtn.addEventListener('click', () => {
    if (!tempMarker) { alert("Välj en plats först!"); return; }
    playerGuessMarker = tempMarker;
    tempMarker = null;
    disableMapInteraction();

    questionOverlay.classList.add('hidden');
    mapPickerUI.classList.add('hidden');

    feedbackOverlay.classList.remove('hidden');
    feedbackText.textContent = "Registrerat!";
    feedbackSubtext.textContent = "Väntar på rättning...";

    // In multiplayer, here we would push to Firebase: rooms/{id}/guesses/{uid} = latlng

    if (isDryRun) {
        clearInterval(timerInterval);
        showRoundResult();
    }
});

function timeIsUp() {
    disableMapInteraction();
    questionOverlay.classList.add('hidden');
    mapPickerUI.classList.add('hidden');
    feedbackText.textContent = "Tiden ute!";
    feedbackSubtext.textContent = "Väntar på rättning...";
    showRoundResult();
}

// --- RESULT & LEADERBOARD FLOW ---

function showRoundResult() {
    const question = gameQuestions[currentQIndex];
    const correctLatLng = question.correctAnswer;

    // Show Correct Answer
    correctMarker = L.marker([correctLatLng.lat, correctLatLng.lng], {
        icon: L.divIcon({ className: 'correct-marker', html: '📍', iconSize: [30, 30] })
    }).addTo(map);

    // Calc score for THIS player (Local logic for now, multiplayer needs sync)
    let roundPoints = 0;
    let distText = "Inget svar";

    if (playerGuessMarker) {
        const guessLatLng = playerGuessMarker.getLatLng();
        const distKm = calculateDistance(correctLatLng.lat, correctLatLng.lng, guessLatLng.lat, guessLatLng.lng);

        answerLine = L.polyline([guessLatLng, correctLatLng], { color: 'red', dashArray: '5, 10' }).addTo(map);
        map.fitBounds(answerLine.getBounds(), { padding: [50, 50] });

        distText = `${Math.round(distKm)} km`;
        roundPoints = Math.max(0, 1000 - Math.round(distKm / 2));
    } else {
        map.setView([correctLatLng.lat, correctLatLng.lng], 5);
        // Clean view of correct location
    }

    currentPlayer.score += roundPoints;

    feedbackOverlay.classList.remove('hidden');
    feedbackText.textContent = roundPoints > 0 ? `+${roundPoints} p` : "0 p";
    feedbackSubtext.textContent = distText;
    document.getElementById('player-score').textContent = `Poäng: ${currentPlayer.score}`;

    // Host controls flow to LEADERBOARD
    if (isGlobalHost) {
        gotoLeaderboardBtn.classList.remove('hidden');
        nextQuestionBtn.classList.add('hidden'); // Ensure next btn (in leaderboard) is hidden till then
    }
}

gotoLeaderboardBtn.addEventListener('click', () => {
    // Transition to Leaderboard State
    feedbackOverlay.classList.add('hidden');
    leaderboardOverlay.classList.remove('hidden');

    // Update Leaderboard List
    liveLeaderboardList.innerHTML = "";

    // Dry Run / Local: Just show me
    // Multiplyer: Fetch from Firebase players list sorted by score
    // Mocking for Dry Run:
    const li = document.createElement('li');
    li.innerHTML = `<strong>${currentPlayer.name || "Jag"}</strong>: ${currentPlayer.score} p`;
    liveLeaderboardList.appendChild(li);

    // The "Next Question" button is inside the leaderboard overlay
});

nextQuestionBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.add('hidden');
    currentQIndex++;
    startQuestionPhase1(); // Loop back to Phase 1
});


function endGame() {
    feedbackOverlay.classList.remove('hidden');
    leaderboardOverlay.classList.add('hidden'); // Ensure hidden
    feedbackText.textContent = "SPELET SLUT";
    feedbackSubtext.textContent = `Din totalpoäng: ${currentPlayer.score}`;

    // Hijack the goto button for restart
    gotoLeaderboardBtn.textContent = "Avsluta / Starta Om";
    gotoLeaderboardBtn.classList.remove('hidden');
    gotoLeaderboardBtn.onclick = () => window.location.reload();
}

// --- Utilities ---
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
