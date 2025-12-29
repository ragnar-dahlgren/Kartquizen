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
console.log("Firebase initialized - VERSION 18 LOADED (Plus Codes)");

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

const waitOverlay = document.getElementById('wait-overlay');
const waitText = document.getElementById('wait-text');
const hostShowQuestionBtn = document.getElementById('host-show-question-btn');

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
const qPlusCode = document.getElementById('q-plus-code'); // NEW
const convertPlusBtn = document.getElementById('convert-plus-btn'); // NEW

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


// --- Basic Logic ---
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
    if (!name || !room) { alert("Fyll i namn och kod!"); return; }

    db.ref('rooms/' + room).once('value', snapshot => {
        if (snapshot.exists()) {
            const userId = "player_" + Math.random().toString(36).substring(2, 8);
            currentPlayer = { id: userId, name: name, score: 0 };
            db.ref(`rooms/${room}/players/${userId}`).set({ name: name, score: 0 }).then(() => {
                enterLobby(room, false);
            });
        } else {
            alert("Rummet hittades inte!");
        }
    });
});

saveQuizBtn.addEventListener('click', () => {
    if (quizDraft.length === 0) { alert("Inga frågor!"); return; }
    if (!currentQuizId) { currentQuizId = "QUIZ-" + Math.floor(1000 + Math.random() * 9000); }
    db.ref('quizzes/' + currentQuizId).set({ questions: quizDraft, created: Date.now() }).then(() => {
        currentQuizIdDisplay.textContent = `ID: ${currentQuizId} (Sparat!)`;
        alert(`Quiz sparat!\nID: ${currentQuizId}`);
    });
});

loadQuizBtn.addEventListener('click', () => {
    const id = quizLoadCode.value.trim().toUpperCase();
    if (!id) return;
    db.ref('quizzes/' + id).once('value', snap => {
        if (snap.exists()) {
            quizDraft = snap.val().questions || []; currentQuizId = id; updateQuestionsList();
            startScreen.classList.add('hidden'); hostScreen.classList.remove('hidden'); currentQuizIdDisplay.textContent = `ID: ${currentQuizId}`;
        } else { alert("Hittades inte."); }
    });
});

// --- Host Form Utils & Plus Codes ---

convertPlusBtn.addEventListener('click', () => {
    const code = qPlusCode.value.trim();
    if (code.length < 8) {
        alert("Ogiltig Plus Code. Måste vara minst 8 tecken (t.ex 9C3XGV00+).");
        return;
    }

    try {
        // Try decoding
        // If short code, we ideally need a reference loc, but for now expect full or try simple decode
        let fullCode = code;
        if (!code.includes('+')) fullCode += '+'; // Crude fix

        const codeArea = OpenLocationCode.decode(fullCode);
        const lat = codeArea.latitudeCenter;
        const lng = codeArea.longitudeCenter;

        qLat.value = lat.toFixed(6);
        qLng.value = lng.toFixed(6);
        selectedLocation = { lat: lat, lng: lng };
        alert(`Plats hittad!\nLat: ${lat.toFixed(4)}\nLng: ${lng.toFixed(4)}`);

    } catch (e) {
        alert("Kunde inte tyda Plus Code. Kontrollera formatet (ex. 8Q7X2222+22).");
        console.error(e);
    }
});

pickLocationBtn.addEventListener('click', () => {
    hostScreen.classList.add('hidden'); gameScreen.classList.remove('hidden');
    mapPickerUI.classList.remove('hidden'); submitGuessBtn.classList.add('hidden'); confirmLocationBtn.classList.remove('hidden'); testControls.classList.add('hidden'); initMap(true);
    const lat = parseFloat(qLat.value); const lng = parseFloat(qLng.value);
    if (!isNaN(lat) && !isNaN(lng)) {
        if (tempMarker) map.removeLayer(tempMarker); tempMarker = L.marker([lat, lng]).addTo(map); map.setView([lat, lng], 5);
    }
});
function onMapClick(e) {
    if (tempMarker) map.removeLayer(tempMarker); tempMarker = L.marker(e.latlng).addTo(map); selectedLocation = e.latlng;
    if (pickerLat) { pickerLat.textContent = "Lat: " + e.latlng.lat.toFixed(4); pickerLng.textContent = "Lng: " + e.latlng.lng.toFixed(4); }
}
confirmLocationBtn.addEventListener('click', () => {
    if (!selectedLocation && !tempMarker) { alert("Välj plats!"); return; }
    if (tempMarker) selectedLocation = tempMarker.getLatLng();
    qLat.value = selectedLocation.lat.toFixed(6); qLng.value = selectedLocation.lng.toFixed(6);
    gameScreen.classList.add('hidden'); mapPickerUI.classList.add('hidden'); hostScreen.classList.remove('hidden');
});
cancelPickerBtn.addEventListener('click', () => {
    gameScreen.classList.add('hidden'); mapPickerUI.classList.add('hidden'); hostScreen.classList.remove('hidden');
});
addQuestionBtn.addEventListener('click', () => {
    const q = getFormData(); if (q) { quizDraft.push(q); updateQuestionsList(); resetForm(); }
});
updateQuestionBtn.addEventListener('click', () => {
    if (editingIndex !== -1) { quizDraft[editingIndex] = getFormData(); editingIndex = -1; updateQuestionsList(); resetForm(); }
});
cancelEditBtn.addEventListener('click', resetForm);
function getFormData() {
    const text = qText.value.trim(); const lat = parseFloat(qLat.value); const lng = parseFloat(qLng.value);
    if (!text || isNaN(lat)) { alert("Fråga och Plats krävs!"); return null; }
    return { id: Date.now(), text: text, image: qImage.value.trim(), timeLimit: parseInt(qTime.value), correctAnswer: { lat, lng } };
}
function resetForm() {
    qText.value = ""; qImage.value = ""; qTime.value = 30; qLat.value = ""; qLng.value = ""; qPlusCode.value = ""; selectedLocation = null; editingIndex = -1;
    addQuestionBtn.classList.remove('hidden'); updateQuestionBtn.classList.add('hidden'); cancelEditBtn.classList.add('hidden');
}
function updateQuestionsList() {
    questionsList.innerHTML = "";
    quizDraft.forEach((q, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="q-info"><span class="q-text-preview">${index + 1}. ${q.text}</span></div>
            <div class="q-controls"> <button class="btn secondary small" onclick="moveQuestion(${index}, -1)">↑</button> <button class="btn secondary small" onclick="moveQuestion(${index}, 1)">↓</button> <button class="btn primary small" onclick="editQuestion(${index})">✎</button> <button class="btn warn small" onclick="removeQuestion(${index})">X</button> </div>`;
        questionsList.appendChild(li);
    });
    qCount.textContent = quizDraft.length;
    startQuizBtn.disabled = quizDraft.length === 0; testRunBtn.disabled = quizDraft.length === 0; saveQuizBtn.disabled = quizDraft.length === 0;
}
window.removeQuestion = (i) => { quizDraft.splice(i, 1); updateQuestionsList(); };
window.moveQuestion = (i, d) => { if ((d === -1 && i > 0) || (d === 1 && i < quizDraft.length - 1)) { [quizDraft[i], quizDraft[i + d]] = [quizDraft[i + d], quizDraft[i]]; updateQuestionsList(); } };
window.editQuestion = (i) => {
    const q = quizDraft[i]; qText.value = q.text; qImage.value = q.image; qTime.value = q.timeLimit; qLat.value = q.correctAnswer.lat; qLng.value = q.correctAnswer.lng; editingIndex = i;
    addQuestionBtn.classList.add('hidden'); updateQuestionBtn.classList.remove('hidden'); cancelEditBtn.classList.remove('hidden');
};


// --- GAME ENGINE ---

testRunBtn.addEventListener('click', () => {
    gameQuestions = [...quizDraft]; isGlobalHost = true; isDryRun = true;
    hostScreen.classList.add('hidden'); gameScreen.classList.remove('hidden'); testControls.classList.remove('hidden');
    initMap(false); currentQIndex = 0;
    // Enter Prep Phase
    startQuestionPhasePrep();
});

prevTestBtn.addEventListener('click', () => { if (currentQIndex > 0) { currentQIndex--; startQuestionPhasePrep(); } });
nextTestBtn.addEventListener('click', () => { if (currentQIndex < gameQuestions.length - 1) { currentQIndex++; startQuestionPhasePrep(); } });
exitTestBtn.addEventListener('click', () => {
    isDryRun = false; isGlobalHost = false; if (timerInterval) clearInterval(timerInterval);
    gameScreen.classList.add('hidden'); questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden'); feedbackOverlay.classList.add('hidden'); leaderboardOverlay.classList.add('hidden'); testControls.classList.add('hidden'); waitOverlay.classList.add('hidden');
    hostScreen.classList.remove('hidden');
});

startQuizBtn.addEventListener('click', () => {
    gameQuestions = [...quizDraft];
    const name = usernameInput.value.trim() || "Lekledare";
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    currentRoomId = roomId;

    const roomData = {
        host: name, status: 'lobby', questions: gameQuestions,
        currentQuestionIndex: 0, questionPhase: 'idle', players: {}
    };
    db.ref('rooms/' + roomId).set(roomData).then(() => { isGlobalHost = true; isDryRun = false; enterLobby(roomId, true); });
});

function enterLobby(roomId, isHost) {
    startScreen.classList.add('hidden'); hostScreen.classList.add('hidden'); lobbyScreen.classList.remove('hidden');
    lobbyRoomCode.textContent = roomId; qrCodeContainer.innerHTML = "";
    new QRCode(qrCodeContainer, { text: window.location.href.split('?')[0] + "?room=" + roomId, width: 128, height: 128 });

    db.ref(`rooms/${roomId}/players`).on('value', (snap) => {
        lobbyPlayersList.innerHTML = ""; const players = snap.val() || {};
        lobbyPlayerCount.textContent = Object.keys(players).length;
        Object.values(players).forEach(p => { const li = document.createElement('li'); li.textContent = p.name; lobbyPlayersList.appendChild(li); });
    });

    if (isHost) {
        lobbyStartBtn.classList.remove('hidden'); lobbyStatusText.textContent = "Du är Lekledare. Starta när alla är med.";
    } else {
        lobbyStartBtn.classList.add('hidden'); lobbyStatusText.textContent = "Väntar på att Lekledaren ska starta spelet...";

        // --- PLAYER LISTENERS ---
        // 1. Status Check
        db.ref(`rooms/${roomId}/status`).on('value', (snap) => {
            if (snap.val() === 'game_active') {
                // Load questions once
                db.ref(`rooms/${roomId}/questions`).once('value', qSnap => {
                    gameQuestions = qSnap.val();
                    lobbyScreen.classList.add('hidden'); gameScreen.classList.remove('hidden'); initMap(false);
                });
            }
        });

        // 2. Question Index Sync
        db.ref(`rooms/${roomId}/currentQuestionIndex`).on('value', (snap) => {
            const newIndex = snap.val();
            if (newIndex !== null && newIndex !== undefined) {
                currentQIndex = newIndex;
                // Don't auto start, wait for phase
            }
        });

        // 3. Phase Sync (The Source of Truth)
        db.ref(`rooms/${roomId}/questionPhase`).on('value', (snap) => {
            const phase = snap.val();
            if (!gameQuestions || gameQuestions.length === 0) return; // Wait for questions

            if (phase === 'prep') startQuestionPhasePrep();
            else if (phase === 'preview') startQuestionPhase1();
            else if (phase === 'action') startQuestionPhase2();
        });
    }
}

lobbyStartBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    db.ref(`rooms/${currentRoomId}`).update({ status: 'game_active', currentQuestionIndex: 0, questionPhase: 'prep' });
    startGameFlow();
});

function startGameFlow() {
    lobbyScreen.classList.add('hidden'); gameScreen.classList.remove('hidden'); testControls.classList.add('hidden'); initMap(false);
    currentQIndex = 0;
    startQuestionPhasePrep();
}

// --- PHASE 0: PREP (Wait) ---
function startQuestionPhasePrep() {
    if (currentQIndex >= gameQuestions.length) { endGame(); return; }
    if (map) map.setView([20, 0], 2); // Reset Map

    // Clean UI
    feedbackOverlay.classList.add('hidden'); leaderboardOverlay.classList.add('hidden');
    questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');

    // Cleanup Markers
    if (playerGuessMarker) map.removeLayer(playerGuessMarker);
    if (correctMarker) map.removeLayer(correctMarker);
    if (answerLine) map.removeLayer(answerLine);
    if (tempMarker) map.removeLayer(tempMarker);

    waitOverlay.classList.remove('hidden'); // Show Wait Screen

    if (isGlobalHost || isDryRun) {
        if (!isDryRun) db.ref(`rooms/${currentRoomId}/questionPhase`).set('prep');

        waitText.textContent = `Fråga ${currentQIndex + 1}/${gameQuestions.length}`;
        hostShowQuestionBtn.classList.remove('hidden');
        hostShowQuestionBtn.onclick = () => {
            // Go to Preview
            if (!isDryRun) db.ref(`rooms/${currentRoomId}/questionPhase`).set('preview');
            startQuestionPhase1();
        };
    } else {
        waitText.textContent = "Lekledaren laddar frågan...";
        hostShowQuestionBtn.classList.add('hidden');
    }
}

// --- PHASE 1: PREVIEW (Read) ---
function startQuestionPhase1() {
    waitOverlay.classList.add('hidden'); // Hide wait
    questionOverlay.classList.remove('hidden'); questionBox.classList.remove('minimized');

    const question = gameQuestions[currentQIndex];
    gameQuestionText.textContent = question.text;
    if (question.image) { gameQuestionImage.src = question.image; gameImageContainer.classList.remove('hidden'); gameImageContainer.classList.remove('mini-img'); }
    else { gameImageContainer.classList.add('hidden'); }

    timerText.textContent = "Läs frågan..."; timerFill.style.width = "100%";

    if (isGlobalHost || isDryRun) {
        hostStartRoundBtn.classList.remove('hidden');
        hostStartRoundBtn.onclick = () => {
            // Go to Action
            if (!isDryRun) db.ref(`rooms/${currentRoomId}/questionPhase`).set('action');
            startQuestionPhase2();
        };
    } else {
        hostStartRoundBtn.classList.add('hidden');
    }
}

// --- PHASE 2: ACTION (Guess) ---
function startQuestionPhase2() {
    const question = gameQuestions[currentQIndex];
    hostStartRoundBtn.classList.add('hidden');
    questionBox.classList.add('minimized'); if (question.image) gameImageContainer.classList.add('mini-img');
    mapPickerUI.classList.remove('hidden');

    if (isGlobalHost && !isDryRun) {
        submitGuessBtn.classList.add('hidden'); pickerInstruction.textContent = "Spelarna gissar nu..."; disableMapInteraction();
    } else {
        submitGuessBtn.classList.remove('hidden'); confirmLocationBtn.classList.add('hidden'); pickerInstruction.textContent = "Klicka på kartan nu!"; enableMapInteraction();
    }

    // Timer
    let timeLeft = question.timeLimit || 30;
    timerText.textContent = timeLeft;
    if (timerInterval) clearInterval(timerInterval);
    const totalTime = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--; timerText.textContent = timeLeft; timerFill.style.width = (timeLeft / totalTime * 100) + "%";
        if (timeLeft <= 0) { clearInterval(timerInterval); timeIsUp(); }
    }, 1000);
}

submitGuessBtn.addEventListener('click', () => {
    if (!tempMarker) { alert("Välj plats!"); return; }
    playerGuessMarker = tempMarker; tempMarker = null; disableMapInteraction();
    questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');
    feedbackOverlay.classList.remove('hidden'); feedbackText.textContent = "Registrerat!"; feedbackSubtext.textContent = "Väntar på rättning...";

    if (isDryRun) { clearInterval(timerInterval); showRoundResult(); }
    else {
        // Multiplayer: Sync Guess
        const lat = playerGuessMarker.getLatLng().lat; const lng = playerGuessMarker.getLatLng().lng;
        db.ref(`rooms/${currentRoomId}/guesses/${currentPlayer.id}`).set({ lat, lng });
    }
});

function timeIsUp() {
    disableMapInteraction(); questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');
    feedbackText.textContent = "Tiden ute!"; feedbackSubtext.textContent = "Hämtar resultat...";

    // In multiplayer, Host should probably trigger result analysis, 
    // but for now let's just show local result or wait for host
    if (isGlobalHost || isDryRun) {
        showRoundResult();
    } else {
        // Players wait for host or show local
        showRoundResult();
    }
}

function showRoundResult() {
    const question = gameQuestions[currentQIndex];
    const correctLatLng = question.correctAnswer;
    correctMarker = L.marker([correctLatLng.lat, correctLatLng.lng]).addTo(map);

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

nextQuestionBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.add('hidden');
    currentQIndex++;

    if (isDryRun) {
        startQuestionPhasePrep();
    } else {
        // Update Index AND Phase in Firebase
        db.ref(`rooms/${currentRoomId}`).update({
            currentQuestionIndex: currentQIndex,
            questionPhase: 'prep'
        });
        startQuestionPhasePrep();
    }
});

function endGame() {
    feedbackOverlay.classList.remove('hidden'); leaderboardOverlay.classList.add('hidden'); waitOverlay.classList.add('hidden');
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
