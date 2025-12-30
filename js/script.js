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
console.log("Firebase initialized - VERSION 23 LOADED (Light Map & Host Shortcut)");

// --- Global State ---
let currentPlayer = { id: null, name: null, score: 0 };

// Version Tag (Immediate)
const vParams = document.createElement('div');
vParams.id = "version-tag";
vParams.style.cssText = "position:fixed; bottom:5px; left:5px; color:rgba(255,255,255,0.3); font-size:10px; z-index:9999; pointer-events:none;";
vParams.textContent = "v26 (Connected)";
document.body.appendChild(vParams);

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
// Old button ref, kept for safety but functionality moved
const nextQuestionBtn = document.getElementById('next-question-btn');

// NEW HOST CONTROLS
const hostResultControls = document.getElementById('host-result-controls');
const gotoLeaderboardBtn = document.getElementById('goto-leaderboard-btn');
const directNextBtn = document.getElementById('direct-next-btn');


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
const qPlusCode = document.getElementById('q-plus-code');
const convertPlusBtn = document.getElementById('convert-plus-btn');

const questionsList = document.getElementById('questions-list');
const qCount = document.getElementById('q-count');
const pickerLat = document.getElementById('picker-lat');
const pickerLng = document.getElementById('picker-lng');
const lobbyRoomCode = document.getElementById('lobby-room-code');
const lobbyPlayersList = document.getElementById('lobby-players-list');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyStatusText = document.getElementById('lobby-status-text');
const qrCodeContainer = document.getElementById('qrcode-container');

const playerScoreDisplay = document.getElementById('player-score');

// --- Initialization ---
const connectedRef = db.ref(".info/connected");
connectedRef.on("value", (snap) => {
    if (snap.val() === true) {
        statusMessage.textContent = "Ansluten till server ✓";
        statusMessage.classList.add('status-connected');
        joinRoomBtn.disabled = false;

        // CHECK PERSISTENCE (Fix for Host Reload)
        const savedHostRoom = localStorage.getItem('kartquizen_host_room');
        if (savedHostRoom) {
            console.log("Restoring Host Session for Room: " + savedHostRoom);
            // Verify if room still exists/is active
            db.ref(`rooms/${savedHostRoom}`).once('value', snap => {
                if (snap.exists()) {
                    isGlobalHost = true;
                    currentRoomId = savedHostRoom;
                    enterLobby(savedHostRoom, true);
                    // If game already started, jump to game screen
                    if (snap.val().status === 'game_active') {
                        // Restore game state
                        gameQuestions = snap.val().questions || [];
                        currentQIndex = snap.val().currentQuestionIndex || 0;
                        startGameFlow(true); // true = restoring
                    }
                } else {
                    localStorage.removeItem('kartquizen_host_room');
                }
            });
        }
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
            maxBounds: [[-90, -180], [90, 180]],
            zoomControl: false
        });

        // SWITCH TO TILE MAP (CartoDB VOYAGER No Labels)
        // Distinct beige/green map. Very light.
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        map.setView([20, 0], 2);

        // Add Version Tag if not exists
        if (!document.getElementById('version-tag')) {
            const v = document.createElement('div'); v.id = "version-tag"; v.textContent = "v24 (Voyager)";
            document.body.appendChild(v);
        }
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
    let input = qPlusCode.value.trim();
    const match = input.match(/([a-zA-Z0-9]{4,}\+[a-zA-Z0-9]{2,})/);
    let codeToUse = input;
    if (match) { codeToUse = match[0]; }

    if (codeToUse.length < 5 || !codeToUse.includes('+')) {
        alert("Kunde inte hitta en giltig Plus Code. (Försök klistra in exakt 'MXG7+R6')");
        return;
    }

    try {
        const codeArea = OpenLocationCode.decode(codeToUse);
        const lat = codeArea.latitudeCenter;
        const lng = codeArea.longitudeCenter;
        qLat.value = lat.toFixed(6); qLng.value = lng.toFixed(6);
        selectedLocation = { lat: lat, lng: lng };
        alert(`Plats hittad för kod: ${codeToUse}\nLat: ${lat.toFixed(4)}\nLng: ${lng.toFixed(4)}`);
    } catch (e) {
        alert("Kunde inte tolka koden. Prova att söka upp platsen manuellt."); console.error(e);
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
    playerScoreDisplay.textContent = "Startar...";
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
    db.ref('rooms/' + roomId).set(roomData).then(() => {
        isGlobalHost = true;
        isDryRun = false;
        localStorage.setItem('kartquizen_host_room', roomId); // SAVE SESSION
        enterLobby(roomId, true);
    });
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

        // --- PLAYER START SYNC ---
        // Only players need to auto-start when status becomes game_active
        db.ref(`rooms/${roomId}/status`).on('value', (snap) => {
            if (snap.val() === 'game_active') {
                // Load questions immediately
                db.ref(`rooms/${roomId}/questions`).once('value', qSnap => {
                    gameQuestions = qSnap.val();
                    lobbyScreen.classList.add('hidden'); gameScreen.classList.remove('hidden'); initMap(false);
                });
            }
        });
    }

    // --- GLOBAL SYNC (EVERYONE) ---
    // Moved OUT of else block so Host gets these too!
    db.ref(`rooms/${roomId}/currentQuestionIndex`).on('value', (snap) => {
        const newIndex = snap.val();
        if (newIndex !== null && newIndex !== undefined) {
            currentQIndex = newIndex;
        }
    });

    db.ref(`rooms/${roomId}/questionPhase`).on('value', (snap) => {
        const phase = snap.val();
        // Host has questions loaded locally usually, but on restore might need fetch check
        // Players usually load via status check above, but double safety:
        if (!gameQuestions || gameQuestions.length === 0) {
            db.ref(`rooms/${roomId}/questions`).once('value', qSnap => {
                gameQuestions = qSnap.val();
                if (gameQuestions && gameQuestions.length > 0) handlePhase(phase);
            });
            return;
        }
        handlePhase(phase);
    });
}

function handlePhase(phase) {
    if (phase === 'prep') startQuestionPhasePrep();
    else if (phase === 'preview') startQuestionPhase1();
    else if (phase === 'action') startQuestionPhase2();
}

lobbyStartBtn.addEventListener('click', () => {
    if (!currentRoomId) return;
    db.ref(`rooms/${currentRoomId}`).update({ status: 'game_active', currentQuestionIndex: 0, questionPhase: 'prep' });
    startGameFlow();
});

function startGameFlow(restoring = false) {
    lobbyScreen.classList.add('hidden'); gameScreen.classList.remove('hidden'); testControls.classList.add('hidden'); initMap(false);

    // FORCE ZOOM OUT FOR PLAYERS
    if (map) map.setView([20, 0], 2);

    if (!restoring) {
        currentQIndex = 0;
        playerScoreDisplay.textContent = "Poäng: 0";
        startQuestionPhasePrep();
    } else {
        console.log("Game restored - waiting for phase listener.");
    }
}

// --- PHASE 0: PREP (Wait) ---
function startQuestionPhasePrep() {
    console.log("Phase: PREP");
    if (currentQIndex >= gameQuestions.length) { endGame(); return; }
    if (map) map.setView([20, 0], 2); // Force Zoom Out

    feedbackOverlay.classList.add('hidden'); leaderboardOverlay.classList.add('hidden');
    questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');

    // Clear map layers
    if (playerGuessMarker) map.removeLayer(playerGuessMarker);
    if (correctMarker) map.removeLayer(correctMarker);
    if (answerLine) map.removeLayer(answerLine);
    if (tempMarker) map.removeLayer(tempMarker);
    map.eachLayer((layer) => { if (layer instanceof L.CircleMarker) map.removeLayer(layer); });

    waitOverlay.classList.remove('hidden');
    waitText.textContent = "Snart börjar spelet. Sätt ut nålen så nära målet som möjligt!";

    updateHostControls('prep');
}

// --- PHASE 1: PREVIEW (Read) ---
function startQuestionPhase1() {
    console.log("Phase: PREVIEW");
    waitOverlay.classList.add('hidden');
    questionOverlay.classList.remove('hidden'); questionBox.classList.remove('minimized');

    const question = gameQuestions[currentQIndex];
    gameQuestionText.textContent = question.text;
    if (question.image) { gameQuestionImage.src = question.image; gameImageContainer.classList.remove('hidden'); gameImageContainer.classList.remove('mini-img'); }
    else { gameImageContainer.classList.add('hidden'); }

    // Reset Timer
    const timerDisplay = document.getElementById('big-timer');
    if (timerDisplay) timerDisplay.textContent = "";
    timerText.textContent = ""; timerFill.style.width = "100%";

    updateHostControls('preview');
}

// --- PHASE 2: ACTION (Guess) ---
function startQuestionPhase2() {
    console.log("Phase: ACTION");
    const question = gameQuestions[currentQIndex];
    questionBox.classList.add('minimized'); if (question.image) gameImageContainer.classList.add('mini-img');
    mapPickerUI.classList.remove('hidden');

    // Player View
    if (!isGlobalHost) {
        submitGuessBtn.classList.remove('hidden'); confirmLocationBtn.classList.add('hidden'); pickerInstruction.textContent = "Klicka på kartan nu!"; enableMapInteraction();
    } else {
        submitGuessBtn.classList.add('hidden'); pickerInstruction.textContent = "Spelarna gissar nu..."; disableMapInteraction();
        // Live Pins
        db.ref(`rooms/${currentRoomId}/guesses`).on('child_added', (snapshot) => {
            const guess = snapshot.val();
            L.circleMarker([guess.lat, guess.lng], { radius: 8, fillColor: "#ffeb3b", color: "#000", weight: 1, opacity: 1, fillOpacity: 0.8 }).addTo(map);
        });
    }

    // Timer Logic
    let timeLeft = question.timeLimit || 30;
    const timerDisplay = document.getElementById('big-timer');
    if (timerDisplay) timerDisplay.textContent = timeLeft;

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) timerDisplay.textContent = timeLeft;
        if (timerFill) timerFill.style.width = (timeLeft / (question.timeLimit || 30) * 100) + "%";
        if (timeLeft <= 0) { clearInterval(timerInterval); timeIsUp(); }
    }, 1000);

    updateHostControls('action');
}

// --- HOST ACTION BAR LOGIC ---
function updateHostControls(phase) {
    const bar = document.getElementById('host-action-bar');
    const content = document.getElementById('host-action-content');

    if (!isGlobalHost && !isDryRun) {
        bar.classList.add('hidden');
        return;
    }

    // Show Bar for Host
    bar.classList.remove('hidden');
    content.innerHTML = ""; // Clear previous buttons

    if (phase === 'prep') {
        const btn = document.createElement('button');
        btn.className = "btn success";
        btn.innerHTML = "Visa Fråga 👁️";
        btn.onclick = () => {
            if (!isDryRun) db.ref(`rooms/${currentRoomId}/questionPhase`).set('preview');
            else startQuestionPhase1();
        };
        content.appendChild(btn);
    }
    else if (phase === 'preview') {
        const btn = document.createElement('button');
        btn.className = "btn success";
        btn.innerHTML = "Starta Gissning ▶";
        btn.onclick = () => {
            if (!isDryRun) db.ref(`rooms/${currentRoomId}/questionPhase`).set('action');
            else startQuestionPhase2();
        };
        content.appendChild(btn);
    }
    else if (phase === 'action') {
        const btn = document.createElement('button');
        btn.className = "btn warn";
        btn.innerHTML = "⏹ Avsluta Tid";
        btn.onclick = () => {
            clearInterval(timerInterval);
            timeIsUp();
        };
        content.appendChild(btn);
    }
}

submitGuessBtn.addEventListener('click', () => {
    if (!tempMarker) { alert("Välj plats!"); return; }
    playerGuessMarker = tempMarker; tempMarker = null; disableMapInteraction();
    questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');
    feedbackOverlay.classList.remove('hidden'); feedbackText.textContent = "Registrerat!"; feedbackSubtext.textContent = "Väntar på rättning...";

    if (isDryRun) { clearInterval(timerInterval); showRoundResult(); }
    else {
        const lat = playerGuessMarker.getLatLng().lat; const lng = playerGuessMarker.getLatLng().lng;
        // Host will see this via the listener above
        db.ref(`rooms/${currentRoomId}/guesses/${currentPlayer.id}`).set({ lat, lng });
    }
});

function timeIsUp() {
    disableMapInteraction(); questionOverlay.classList.add('hidden'); mapPickerUI.classList.add('hidden');
    feedbackText.textContent = "Tiden ute!"; feedbackSubtext.textContent = "Hämtar resultat...";
    if (isGlobalHost || isDryRun) showRoundResult();
    else setTimeout(showRoundResult, 1000);
}

// ROUND RESULT (Summary)
function showRoundResult() {
    const question = gameQuestions[currentQIndex];
    const correctLatLng = question.correctAnswer;
    correctMarker = L.marker([correctLatLng.lat, correctLatLng.lng]).addTo(map);

    // Calculate My Distance (For Player)
    let myDistMeter = 0;
    if (!isGlobalHost && playerGuessMarker) {
        const guessLatLng = playerGuessMarker.getLatLng();
        const distKm = calculateDistance(correctLatLng.lat, correctLatLng.lng, guessLatLng.lat, guessLatLng.lng);
        myDistMeter = Math.round(distKm * 1000);

        answerLine = L.polyline([guessLatLng, correctLatLng], { color: 'red', dashArray: '5, 10' }).addTo(map);
        map.fitBounds(answerLine.getBounds(), { padding: [50, 50] });
    } else if (!isGlobalHost) {
        myDistMeter = 20000000; // Max penalty
    }

    // Update Score locally
    if (!isGlobalHost || isDryRun) {
        currentPlayer.score += myDistMeter;
        if (!isDryRun) db.ref(`rooms/${currentRoomId}/players/${currentPlayer.id}/score`).set(currentPlayer.score);
        playerScoreDisplay.textContent = `Avstånd: ${formatDistance(currentPlayer.score)}`;
    }

    // Populate Round Summary List (For Everyone)
    const summaryContainer = document.getElementById('round-summary-container');
    const summaryList = document.getElementById('round-results-list');
    summaryContainer.classList.remove('hidden'); summaryList.innerHTML = "Laddar resultat...";

    // Fetch all players and guesses to build the list
    if (isDryRun) {
        summaryList.innerHTML = `<li><strong>Jag</strong>: ${formatDistance(myDistMeter)}</li>`;
        feedbackText.textContent = "Resultat (Runda)"; feedbackSubtext.textContent = "";
    } else {
        Promise.all([
            db.ref(`rooms/${currentRoomId}/players`).once('value'),
            db.ref(`rooms/${currentRoomId}/guesses`).once('value')
        ]).then(([pSnap, gSnap]) => {
            const players = pSnap.val() || {};
            const guesses = gSnap.val() || {};
            summaryList.innerHTML = "";

            Object.values(players).forEach(p => {
                const g = guesses[p.id]; // Assuming player object has ID or mapped key
                // Note: p is {name, score}, key is ID. We need ID.
                // Fix: Player loop needs Keys. 
            });

            // Re-do loop structure for Keys
            summaryList.innerHTML = "";
            Object.keys(players).forEach(pid => {
                const p = players[pid];
                const g = guesses[pid];
                let dist = 20000000;
                if (g) {
                    const km = calculateDistance(correctLatLng.lat, correctLatLng.lng, g.lat, g.lng);
                    dist = Math.round(km * 1000);
                }
                const li = document.createElement('li');
                li.style.borderBottom = "1px solid rgba(255,255,255,0.1)"; li.style.padding = "5px 0";
                li.innerHTML = `<strong>${p.name}</strong>: ${formatDistance(dist)}`;
                summaryList.appendChild(li);
            });
        });

        feedbackText.textContent = "Resultat"; feedbackSubtext.textContent = `Rätt svar: ${question.text}`;
    }

    if (isGlobalHost) {
        // hostResultControls.classList.remove('hidden'); // OLD OVERLAY CONTROLS
        const bar = document.getElementById('host-action-bar');
        const content = document.getElementById('host-action-content');
        bar.classList.remove('hidden');
        content.innerHTML = "";

        const btn = document.createElement('button');
        btn.className = "btn success";
        btn.innerHTML = "Visa Highscore →";
        btn.onclick = () => {
            gotoLeaderboardBtn.click(); // Reuse logic
        };
        content.appendChild(btn);

    } else {
        hostResultControls.classList.add('hidden');
    }
}

function formatDistance(meters) {
    if (meters > 10000) return Math.round(meters / 1000) + " km";
    return meters + " m";
}

// Ensure this button only goes to Highscore
gotoLeaderboardBtn.onclick = () => { // Or the function that handles this
    feedbackOverlay.classList.add('hidden');
    leaderboardOverlay.classList.remove('hidden');
    liveLeaderboardList.innerHTML = "Laddar...";

    // SETUP HOST CONTROLS FOR LEADERBOARD
    // Final Question Finished -> End Game
    if (currentQIndex >= gameQuestions.length - 1) {
        if (isGlobalHost) {
            const bar = document.getElementById('host-action-bar');
            const content = document.getElementById('host-action-content');
            bar.classList.remove('hidden');
            content.innerHTML = "";

            const btn = document.createElement('button');
            btn.className = "btn success";
            btn.innerHTML = "🏁 Avsluta Spelet (Till Redigering)";
            btn.onclick = () => {
                // Reset Room Status to 'closed' or just leave
                db.ref(`rooms/${currentRoomId}/status`).set('finished');
                returnToHostScreen();
            };
            content.appendChild(btn);
        }
    } else {
        // Normal Next Question
        if (isGlobalHost) {
            const bar = document.getElementById('host-action-bar');
            const content = document.getElementById('host-action-content');
            bar.classList.remove('hidden');
            content.innerHTML = "";

            const btn = document.createElement('button');
            btn.className = "btn primary";
            btn.innerHTML = "Nästa Fråga →";
            btn.onclick = () => {
                nextQuestionBtn.click();
            };
            content.appendChild(btn);
        }
    }

    if (isDryRun) {
        liveLeaderboardList.innerHTML = `<li><strong>Jag</strong>: ${formatDistance(currentPlayer.score)}</li>`;
    } else {
        db.ref(`rooms/${currentRoomId}/players`).orderByChild('score').once('value', (snap) => {
            const players = [];
            snap.forEach(c => players.push(c.val()));
            // Sort Descending Score (High is good? Or low distance? Logic says Score is points)
            // Current logic adds points based on closeness. So High Score is winner.
            players.sort((a, b) => b.score - a.score);

            liveLeaderboardList.innerHTML = "";
            let rank = 1;
            players.forEach(p => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>#${rank} ${p.name}</strong>: ${p.score} p`;
                if (rank === 1) li.style.color = "#ffd700"; // Gold
                liveLeaderboardList.appendChild(li);
                rank++;
            });
        });
    }
};

// ABORT BUTTON LOGIC
document.getElementById('host-abort-btn').addEventListener('click', () => {
    if (confirm("Vill du verkligen avbryta spelet och gå tillbaka till redigering? Alla spelare kommer kastas ut.")) {
        db.ref(`rooms/${currentRoomId}`).remove(); // Delete room or set status finished
        localStorage.removeItem('kartquizen_host_room');
        returnToHostScreen();
    }
});

function returnToHostScreen() {
    isGlobalHost = false;
    currentRoomId = null;
    gameScreen.classList.add('hidden');
    lobbyScreen.classList.add('hidden');
    hostScreen.classList.remove('hidden'); // Back to Editor

    // Clean up map
    if (map) map.remove(); map = null;
    location.reload(); // Easiest way to reset all state is a clean reload
}

// "Nästa Fråga" is NOW ONLY ON LEADERBOARD
nextQuestionBtn.addEventListener('click', () => {
    leaderboardOverlay.classList.add('hidden');
    currentQIndex++;
    if (isDryRun) startQuestionPhasePrep();
    else {
        db.ref(`rooms/${currentRoomId}`).update({ currentQuestionIndex: currentQIndex, questionPhase: 'prep' });
        // Clear Guesses for next round!
        db.ref(`rooms/${currentRoomId}/guesses`).remove();
        startQuestionPhasePrep();
    }
});

function endGame() {
    feedbackOverlay.classList.remove('hidden'); leaderboardOverlay.classList.add('hidden'); waitOverlay.classList.add('hidden');
    feedbackText.textContent = "SPELET SLUT"; feedbackSubtext.textContent = "";
    hostResultControls.classList.remove('hidden');
    gotoLeaderboardBtn.textContent = "Avsluta / Starta Om"; gotoLeaderboardBtn.classList.remove('hidden');
    directNextBtn.classList.add('hidden'); // Hide next, only Finish/Restart
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
