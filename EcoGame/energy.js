// Shared leaderboard key (same as the waste game)
var LS_KEY = "ecogame.players";

// Local persistence helpers (no optional chaining)
// Backend API helpers
async function fetchLeaderboard() {
    try {
    const res = await fetch('http://10.63.2.120:3000/api/leaderboard');
        return await res.json();
    } catch {
        return [];
    }
}

async function addScore(name, delta) {
    try {
    const res = await fetch('http://10.63.2.120:3000/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, total: delta })
        });
        if (res.ok) {
            // Get updated leaderboard and return player's total
            const lb = await fetchLeaderboard();
            const player = lb.find(p => (p.name || '').toLowerCase() === String(name || '').toLowerCase());
            return player ? player.total : delta;
        }
    } catch {}
    return delta;
}

// Unbiased Fisher–Yates shuffle
function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a;
}

// State
var playerName = "";
var lock = false;
var first = null;
var second = null;
var moves = 0;
var roundScore = 0;
var pairsFound = 0;

// Pairs: id duplicated once as bad (red) and once as good (green)
var PAIRS = [
    { id: "lights", type: "bad", text: "Leave lights on" },
    { id: "lights", type: "good", text: "Turn off lights" },
    { id: "water", type: "bad", text: "Long shower" },
    { id: "water", type: "good", text: "5‑minute shower" },
    { id: "charger", type: "bad", text: "Charger always plugged" },
    { id: "charger", type: "good", text: "Unplug when full" },
    { id: "ac", type: "bad", text: "AC at 18°C" },
    { id: "ac", type: "good", text: "Set 24–26°C" },
    { id: "laundry", type: "bad", text: "Half‑load hot" },
    { id: "laundry", type: "good", text: "Full‑load cold" },
    { id: "transport", type: "bad", text: "Short car trip" },
    { id: "transport", type: "good", text: "Walk / cycle" }
];

// DOM
var grid = document.getElementById("grid");
var startBtn = document.getElementById("startBtn");
var restartBtn = document.getElementById("restartBtn");
var movesEl = document.getElementById("moves");
var scoreEl = document.getElementById("score");
var toastEl = document.getElementById("toast");

// UI helpers
function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function() { toastEl.classList.remove("show"); }, 1400);
}

function setMoves(v) { if (movesEl) movesEl.textContent = "Moves: " + v; }

function setRoundScore(v) { if (scoreEl) scoreEl.textContent = "+" + v; }

// Build and render deck
function buildDeck() {
    var deck = PAIRS.map(function(p, idx) { return { id: p.id, type: p.type, text: p.text, key: p.id + "-" + p.type + "-" + idx }; });
    shuffle(deck);
    grid.innerHTML = deck.map(cardHTML).join("");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".card"));
    cards.forEach(function(card) {
        card.addEventListener("click", function() { onFlip(card); });
        card.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault();
                onFlip(card); }
        });
    });
}

function cardHTML(c) {
    var frontClass = c.type === "good" ? "front good" : "front bad";
    return '<div class="card" tabindex="0" data-id="' + c.id + '" data-type="' + c.type + '" aria-label="Memory card">' +
        '<div class="card-inner">' +
        '<div class="face back">Energy Saver</div>' +
        '<div class="face ' + frontClass + '">' + c.text + '</div>' +
        '</div>' +
        '</div>';
}

// Game flow
function startGame() {
    var input = document.getElementById("playerName");
    playerName = (input && input.value ? input.value.trim() : "") || "Player";
    lock = false;
    first = null;
    second = null;
    moves = 0;
    roundScore = 0;
    pairsFound = 0;
    setMoves(0);
    setRoundScore(0);
    buildDeck();
    if (startBtn) startBtn.style.display = "none";
    if (restartBtn) restartBtn.style.display = "inline-block";
    toast("Find matching pairs!");
}

function onFlip(card) {
    if (lock) return;
    if (card.classList.contains("flipped")) return;
    card.classList.add("flipped");
    if (!first) { first = card; return; }
    second = card;
    lock = true;
    moves++;
    setMoves(moves);

    var match = first.getAttribute("data-id") === second.getAttribute("data-id") && first !== second;
    if (match) {
        pairsFound++;
        roundScore += 2;
        setRoundScore(roundScore);
        lock = false;
        first = null;
        second = null;

        if (pairsFound === PAIRS.length / 2) {
            var efficiency = Math.max(0, 6 - Math.max(0, moves - PAIRS.length)); // small bonus
            roundScore += efficiency;
            setRoundScore(roundScore);
            var total = addScore(playerName, roundScore);
            toast("Saved! +" + roundScore + " (Total: " + total + ")");
            if (startBtn) startBtn.style.display = "inline-block";
            if (restartBtn) restartBtn.style.display = "inline-block";
        }
    } else {
        setTimeout(function() {
            first.classList.remove("flipped");
            second.classList.remove("flipped");
            lock = false;
            first = null;
            second = null;
        }, 700);
    }
}

function restart() {
    lock = false;
    first = null;
    second = null;
    moves = 0;
    roundScore = 0;
    pairsFound = 0;
    setMoves(0);
    setRoundScore(0);
    buildDeck();
    toast("Shuffled!");
}

// Wire events without optional chaining
if (startBtn) startBtn.addEventListener("click", startGame);
if (restartBtn) restartBtn.addEventListener("click", restart);