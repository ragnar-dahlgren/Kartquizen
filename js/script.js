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
console.log("Firebase initialized - VERSION 16 LOADED (Polishing UI & Logic)");

// --- Global State ---
let currentPlayer = { id: null, name: null, score: 0 };
let currentRoomId = null;
let currentQuizId = null;
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
let editingIndex = -1;

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const hostScreen = document.getElementById('host-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const mapPickerUI = document.getElementById('map-picker-ui');
const statusMessage = document.getElementById('status-message');
const loadQuizSection = document.getElementById('load-quiz-section');

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
const gotoLeaderboardBtn = document.getElementById('goto-leaderboard-btn');
const leaderboardOverlay = document.getElementById('leaderboard-overlay');
const liveLeaderboardList = document.getElementById('live-leaderboard-list');
const submitGuessBtn = document.getElementById('submit-guess-btn');
const pickerInstruction = document.getElementById('picker-instruction');

const exitTestBtn = document.getElementById('exit-test-btn');
const prevTestBtn = document.getElementById('prev-test-btn');
const nextTestBtn = document.getElementById('next-test-btn');
const hostStartRoundBtn = document.getElementById('host-start-round-btn');

const hostModeBtn = document.getElementById('host-mode-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const backToStartBtn = document.getElementById('back-to-start-btn');
const pickLocationBtn = document.getElementById('pick-location-btn');
const addQuestionBtn = document.getElementById('add-question-btn');
const updateQuestionBtn = document.getElementById('update-question-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const startQuizBtn = document.getElementById('start-quiz-btn');
const confirmLocationBtn = document.getElementById('confirm-location-btn');
const cancelPickerBtn = document.getElementById('cancel-picker-btn');
const lobbyStartBtn = document.getElementById('lobby-start-btn');
const testRunBtn = document.getElementById('test-run-btn');
const saveQuizBtn = document.getElementById('save-quiz-btn');
const loadQuizBtn = document.getElementById('load-quiz-btn');
const testControls = document.getElementById('test-controls');

const usernameInput = document.getElementById('username-input');
const roomCodeInput = document.getElementById('room-code-input');
const quizLoadCode = document.getElementById('quiz-load-code');
const currentQuizIdDisplay = document.getElementById('current-quiz-id');

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
        statusMessage.classList.add('status-connected');
        joinRoomBtn.disabled = false;
    } else {
        statusMessage.textContent = "Ansluter...";
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
        map.setView([20, 0], 2);

        fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
            .then(res => res.json())
            .then(data => {
                L.geoJSON(data, {
                    style: function () {
                        return {
                            fillColor: '#E73C7E',
                            weight: 1,
                            opacity: 1,
                            color: '#23A6D5',
                            fillOpacity: 0.8
                        };
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

joinRoomBtn.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    const room = roomCodeInput.value.trim().toUpperCase();

    if (!name) { alert("Fyll i ditt namn!"); return; }
    if (!room) { alert("Fyll i rumskod!"); return; }

    db.ref('rooms/' + room).once('value', snapshot => {
        if (snapshot.exists()) {
            const userId = "player_" + Math.random().toString(36).substring(2, 8);
            currentPlayer = { id: userId, name: name, score: 0 };

            db.ref(`rooms/${room}/players/${userId}`).set({
                name: name,
                score: 0
            }).then(() => {
                enterLobby(room, false);
            });
        } else {
            alert("Rummet hittades inte!");
        }
    });
});


// --- PERSISTENCE ---
saveQuizBtn.addEventListener('click', () => {
    if (quizDraft.length === 0) { alert("Inga frågor att spara!"); return; }
    if (!currentQuizId) {
        currentQuizId = "QUIZ-" + Math.floor(1000 + Math.random() * 9000);
    }
    db.ref('quizzes/' + currentQuizId).set({
        questions: quizDraft,
        created: Date.now()
    }).then(() => {
        currentQuizIdDisplay.textContent = `ID: ${currentQuizId} (Sparat!)`;
        alert(`Quiz sparat!\nID: ${currentQuizId}`);
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
            startScreen.classList.add('hidden');
            hostScreen.classList.remove('hidden');
            currentQuizIdDisplay.textContent = `ID: ${currentQuizId}`;
        } else {
            alert("Hittade inget quiz.");
        }
    });
});

// --- HOST FORM ---
pickLocationBtn.addEventListener('click', () => {
    hostScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    mapPickerUI.classList.remove('hidden');
    submitGuessBtn.classList.add('hidden');
    confirmLocationBtn.classList.remove('hidden');
    testControls.classList.add('hidden');
    initMap(true);

    const lat = parseFloat(qLat.value);
    const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) {
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.marker([lat, lng]).addTo(map); // DEFAULT BLUE PIN IS BEST
        map.setView([lat, lng], 5);
        updatePickerDisplay(lat, lng);
    }
});

function onMapClick(e) {
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker(e.latlng).addTo(map); // Standard Blue Pin
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

qLat.addEventListener('change', () => {
    const lat = parseFloat(qLat.value);
    const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) selectedLocation = { lat: lat, lng: lng };
});
qLng.addEventListener('change', () => {
    const lat = parseFloat(qLat.value);
    const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) selectedLocation = { lat: lat, lng: lng };
});

function getFormData() {
    const text = qText.value.trim();
    if (!text) { alert("Skriv en fråga!"); return null; }
    if (!selectedLocation && !qLat.value) { alert("Ange koordinater!"); return null; }
    if (!selectedLocation) selectedLocation = { lat: parseFloat(qLat.value), lng: parseFloat(qLng.value) };
    return { id: Date.now(), text: text, image: qImage.value.trim(), timeLimit: parseInt(qTime.value), correctAnswer: selectedLocation };
}

addQuestionBtn.addEventListener('click', () => {
    const q = getFormData();
    if (q) { quizDraft.push(q); updateQuestionsList(); resetForm(); }
});
updateQuestionBtn.addEventListener('click', () => {
    if (editingIndex === -1) return;
    const q = getFormData();
    if (q) { quizDraft[editingIndex] = q; editingIndex = -1; updateQuestionsList(); resetForm(); }
});
cancelEditBtn.addEventListener('click', resetForm);

function resetForm() {
    qText.value = ""; qImage.value = ""; qTime.value = 30; qLat.value = ""; qLng.value = ""; selectedLocation = null; editingIndex = -1;
    addQuestionBtn.classList.remove('hidden'); updateQuestionBtn.classList.add('hidden'); cancelEditBtn.classList.add('hidden');
}

function updateQuestionsList() {
    questionsList.innerHTML = "";
    quizDraft.forEach((q, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="q-info"><span class="q-text-preview">${index + 1}. ${q.text}</span></div>
            <div class="q-controls">
                <button class="btn secondary small" onclick="moveQuestion(${index}, -1)">↑</button>
                <button class="btn secondary small" onclick="moveQuestion(${index}, 1)">↓</button>
                <button class="btn primary small" onclick="editQuestion(${index})">✎</button>
                <button class="btn warn small" onclick="removeQuestion(${index})">X</button>
            </div>`;
        questionsList.appendChild(li);
    });
    qCount.textContent = quizDraft.length;
    startQuizBtn.disabled = quizDraft.length === 0;
    testRunBtn.disabled = quizDraft.length === 0;
    saveQuizBtn.disabled = quizDraft.length === 0;
}

window.removeQuestion = (index) => { quizDraft.splice(index, 1); updateQuestionsList(); };
window.moveQuestion = (index, direction) => {
    if (direction === -1 && index > 0) [quizDraft[index], quizDraft[index - 1]] = [quizDraft[index - 1], quizDraft[index]];
    else if (direction === 1 && index < quizDraft.length - 1) [quizDraft[index], quizDraft[index + 1]] = [quizDraft[index + 1], quizDraft[index]];
    updateQuestionsList();
};
window.editQuestion = (index) => {
    const q = quizDraft[index];
    qText.value = q.text; qImage.value = q.image; qTime.value = q.timeLimit; qLat.value = q.correctAnswer.lat; qLng.value = q.correctAnswer.lng; selectedLocation = q.correctAnswer;
    editingIndex = index; addQuestionBtn.classList.add('hidden'); updateQuestionBtn.classList.remove('hidden'); cancelEditBtn.classList.remove('hidden');
};


// --- GAME ENGINE ---

testRunBtn.addEventListener('click', () => {
    gameQuestions = [...quizDraft];
    isGlobalHost = true;
    isDryRun = true;
    hostScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    testControls.classList.remove('hidden');
    initMap(false);

    currentQIndex = 0;
    document.getElementById('round-info').textContent = "TEST MODE";
    startQuestionPhase1();
});

prevTestBtn.addEventListener('click', () => { if (currentQIndex > 0) { currentQIndex--; startQuestionPhase1(); } });
nextTestBtn.addEventListener('click', () => { if (currentQIndex < gameQuestions.length - 1) { currentQIndex++; startQuestionPhase1(); } });
exitTestBtn.addEventListener('click', () => {
    isDryRun = false; isGlobalHost = false;
    if (timerInterval) clearInterval(timerInterval);
    gameScreen.classList.add('hidden'); questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden'); feedbackOverlay.classList.add('hidden'); leaderboardOverlay.classList.add('hidden'); testControls.classList.add('hidden');
    hostScreen.classList.remove('hidden');
});

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
        questionPhase: 'idle',
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

    // LOBBY PLAYER SYNC (Visuals for both Host & Player)
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

    if (isHost) {
        lobbyStartBtn.classList.remove('hidden');
        lobbyStatusText.textContent = "Du är Lekledare. Starta när alla är med.";
    } else {
        lobbyStartBtn.classList.add('hidden');
        lobbyStatusText.textContent = "Väntar på att Lekledaren ska starta spelet...";

        db.ref(`rooms/${roomId}/status`).on('value', (snap) => {
            const state = snap.val();
            if (state === 'game_active') {
                db.ref(`rooms/${roomId}/questions`).once('value', qSnap => {
                    gameQuestions = qSnap.val();
                    startGameFlow();
                });
            }
        });

        db.ref(`rooms/${roomId}/questionPhase`).on('value', (snap) => {
            const phase = snap.val();
            if (phase === 'action') {
                startQuestionPhase2(gameQuestions[currentQIndex]);
            }
        });
    }
}

lobbyStartBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    db.ref(`rooms/${currentRoomId}`).update({
        status: 'game_active',
        currentQuestionIndex: 0,
        questionPhase: 'preview'
    });
    startGameFlow();
});

function startGameFlow() {
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    testControls.classList.add('hidden');
    initMap(false);
    currentQIndex = 0;
    startQuestionPhase1();
}

function startQuestionPhase1() {
    if (currentQIndex >= gameQuestions.length) { endGame(); return; }
    if (map) map.setView([20, 0], 2);

    const question = gameQuestions[currentQIndex];
    document.getElementById('round-info').textContent = `Fråga: ${currentQIndex + 1}/${gameQuestions.length}`;

    // Cleanup
    if (playerGuessMarker) map.removeLayer(playerGuessMarker);
    if (correctMarker) map.removeLayer(correctMarker);
    if (answerLine) map.removeLayer(answerLine);
    if (tempMarker) map.removeLayer(tempMarker);

    disableMapInteraction();

    feedbackOverlay.classList.add('hidden'); leaderboardOverlay.classList.add('hidden');
    questionOverlay.classList.remove('hidden'); questionBox.classList.remove('minimized');
    mapPickerUI.classList.add('hidden');

    gameQuestionText.textContent = question.text;
    if (question.image) {
        gameQuestionImage.src = question.image;
        gameImageContainer.classList.remove('hidden'); gameImageContainer.classList.remove('mini-img');
    } else {
        gameImageContainer.classList.add('hidden');
    }

    timerText.textContent = "Läs frågan...";
    timerFill.style.width = "100%";

    if (isGlobalHost || isDryRun) {
        if (!isDryRun) db.ref(`rooms/${currentRoomId}/questionPhase`).set('preview');
        hostStartRoundBtn.classList.remove('hidden');
        hostStartRoundBtn.onclick = () => {
            if (!isDryRun) db.ref(`rooms/${currentRoomId}/questionPhase`).set('action');
            startQuestionPhase2(question);
        };
    } else {
        hostStartRoundBtn.classList.add('hidden');
    }
}

function startQuestionPhase2(question) {
    hostStartRoundBtn.classList.add('hidden');
    questionBox.classList.add('minimized');
    if (question.image) gameImageContainer.classList.add('mini-img');

    // mapPickerUI moved to top in CSS? Just unhide it here.
    mapPickerUI.classList.remove('hidden');

    if (isGlobalHost && !isDryRun) {
        submitGuessBtn.classList.add('hidden');
        pickerInstruction.textContent = "Spelarna gissar nu...";
        timerText.textContent = "Tid kvar";
        disableMapInteraction();
    } else {
        submitGuessBtn.classList.remove('hidden');
        confirmLocationBtn.classList.add('hidden');
        pickerInstruction.textContent = "Klicka på kartan nu!";
        enableMapInteraction();
    }

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

submitGuessBtn.addEventListener('click', () => {
    if (!tempMarker) { alert("Välj en plats först!"); return; }
    playerGuessMarker = tempMarker; tempMarker = null;
    disableMapInteraction();
    questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');
    feedbackOverlay.classList.remove('hidden');
    feedbackText.textContent = "Registrerat!"; feedbackSubtext.textContent = "Väntar på rättning...";

    if (isDryRun) { clearInterval(timerInterval); showRoundResult(); }
    else {
        // Multiplayer: Send guess to Firebase
        const lat = playerGuessMarker.getLatLng().lat;
        const lng = playerGuessMarker.getLatLng().lng;
        // Mock sync for now or just wait for timeout. 
        // Real implementation would be: db.ref(`rooms/${currentRoomId}/guesses/${currentPlayer.id}`).set({lat,lng});
    }
});

function timeIsUp() {
    disableMapInteraction();
    questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');
    feedbackText.textContent = "Tiden ute!"; feedbackSubtext.textContent = "Väntar på rättning...";
    showRoundResult();
}

function showRoundResult() {
    const question = gameQuestions[currentQIndex];
    const correctLatLng = question.correctAnswer;
    correctMarker = L.marker([correctLatLng.lat, correctLatLng.lng]).addTo(map); // BLUE DEFAULT PIN

    let roundPoints = 0; let distText = "Inget svar";
    if (playerGuessMarker) {
        const guessLatLng = playerGuessMarker.getLatLng();
        const distKm = calculateDistance(correctLatLng.lat, correctLatLng.lng, guessLatLng.lat, guessLatLng.lng);
        answerLine = L.polyline([guessLatLng, correctLatLng], { color: 'red', dashArray: '5, 10' }).addTo(map);
        map.fitBounds(answerLine.getBounds(), { padding: [50, 50] });
        distText = `${Math.round(distKm)} km`; roundPoints = Math.max(0, 1000 - Math.round(distKm / 2));
    } else { map.setView([correctLatLng.lat, correctLatLng.lng], 5); }

    if (!isGlobalHost || isDryRun) {
        currentPlayer.score += roundPoints;
        feedbackText.textContent = roundPoints > 0 ? `+${roundPoints} p` : "0 p"; feedbackSubtext.textContent = distText;
        document.getElementById('player-score').textContent = `Poäng: ${currentPlayer.score}`;

        // Multiplayer: Sync Score
        if (!isDryRun) db.ref(`rooms/${currentRoomId}/players/${currentPlayer.id}/score`).set(currentPlayer.score);
    } else {
        feedbackText.textContent = "RÄTT SVAR"; feedbackSubtext.textContent = "Visas på kartan";
    }

    if (isGlobalHost) { gotoLeaderboardBtn.classList.remove('hidden'); nextQuestionBtn.classList.add('hidden'); }
}

gotoLeaderboardBtn.addEventListener('click', () => {
    feedbackOverlay.classList.add('hidden'); leaderboardOverlay.classList.remove('hidden'); liveLeaderboardList.innerHTML = "";

    if (isDryRun) {
        const li = document.createElement('li'); li.innerHTML = `<strong>Jag</strong>: ${currentPlayer.score} p`; liveLeaderboardList.appendChild(li);
    } else {
        // Live Leaderboard Sync
        db.ref(`rooms/${currentRoomId}/players`).once('value', snap => {
            const players = snap.val() || {};
            const sorted = Object.values(players).sort((a, b) => b.score - a.score);
            sorted.forEach(p => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${p.name}</strong>: ${p.score} p`;
                liveLeaderboardList.appendChild(li);
            });
        });
    }
});

nextQuestionBtn.addEventListener('click', () => { leaderboardOverlay.classList.add('hidden'); currentQIndex++; startQuestionPhase1(); });
function endGame() {
    feedbackOverlay.classList.remove('hidden'); leaderboardOverlay.classList.add('hidden');
    feedbackText.textContent = "SPELET SLUT"; feedbackSubtext.textContent = "";
    gotoLeaderboardBtn.textContent = "Avsluta / Starta Om"; gotoLeaderboardBtn.classList.remove('hidden');
    gotoLeaderboardBtn.onclick = () => window.location.reload();
}
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c;
}
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) { roomCodeInput.value = roomParam; }
