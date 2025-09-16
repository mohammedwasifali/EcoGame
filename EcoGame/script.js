// —— Backend leaderboard API ——
async function fetchLeaderboard() {
    try {
    const res = await fetch('http://10.63.2.120:3000/api/leaderboard');
        return await res.json();
    } catch {
        return [];
    }
}

async function getPlayerTotal(name) {
    const lb = await fetchLeaderboard();
    const key = String(name || '').toLowerCase();
    const p = lb.find(x => (x.name || '').toLowerCase() === key);
    return p ? (p.total || 0) : 0;
}

async function upsertAndAddScore(name, delta) {
    try {
    await fetch('http://10.63.2.120:3000/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, total: delta })
        });
        return await fetchLeaderboard();
    } catch {
        return [];
    }
}

// —— Game state ——
let playerName = "";
let sessionScore = 0;

// Map items to bins (exactly the 14 listed)
const correctMap = {
    banana: "compost",
    battery: "hazardous",
    paper: "recycle",
    bottle: "recycle",
    apple: "compost",
    fishbone: "compost",
    plasticbag: "recycle",
    chips: "recycle",
    phone: "hazardous",
    cloth: "recycle",
    glass: "recycle",
    cardboard: "recycle",
    joystick: "hazardous",
    bone: "compost"
};

// On load
document.addEventListener("DOMContentLoaded", () => {
    const sb = document.getElementById("startBtn");
    if (sb) sb.addEventListener("click", startGame);
    const fb = document.getElementById("finishBtn");
    if (fb) fb.addEventListener("click", finishGameAndSave);
    const ab = document.getElementById("againBtn");
    if (ab) ab.addEventListener("click", playAgain);
    enableDnD();
    enableKeyboardDrops();
    writeScore(0);
    window.addEventListener("resize", () => keepInBounds(getVisibleItems()));
});

// Start flow
async function startGame() {
    const input = document.getElementById("playerName");
    playerName = (input && input.value ? input.value.trim() : "") || "Player";
    resetRound(true);
    const already = await getPlayerTotal(playerName);
    writeScore(already);
    showStartFlash();
    showFirstRunHint();
    document.getElementById("againBtn").style.display = "none";
}

// Reset round: randomize positions and show ALL items
function resetRound(doToast) {
    sessionScore = 0;
    const all = getAllItems();
    setRandomPositions(all); // random placement each round
    all.forEach(el => el.style.display = "block");
    if (doToast) toast("Items randomized!");
}

// Finish and persist
async function finishGameAndSave() {
    if (!playerName) return toast("Enter name first");
    await upsertAndAddScore(playerName, sessionScore);
    const totalAfter = await getPlayerTotal(playerName);
    writeScore(totalAfter);
    sessionScore = 0;
    toast("congratiulations"); // exact wording requested
    document.getElementById("againBtn").style.display = "inline-block";
}

// Play again
async function playAgain() {
    resetRound(true);
    const total = playerName ? await getPlayerTotal(playerName) : 0;
    writeScore(total);
    document.getElementById("againBtn").style.display = "none";
}

// Items and bins helpers
function getAllItems() { return Array.from(document.querySelectorAll(".item")); }

function getVisibleItems() { return getAllItems().filter(el => el.style.display !== "none"); }

// DnD
function enableDnD() {
    const items = getAllItems();
    const bins = document.querySelectorAll(".bin");

    items.forEach(item => {
        item.addEventListener("dragstart", e => {
            if (!e.dataTransfer) return;
            e.dataTransfer.setData("text/plain", e.target.id);
            e.dataTransfer.effectAllowed = "move";
        });
    });

    bins.forEach(bin => {
        ["dragenter", "dragover"].forEach(type => {
            bin.addEventListener(type, e => {
                e.preventDefault();
                bin.classList.add("drag-over");
                if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            });
        });
        bin.addEventListener("dragleave", () => bin.classList.remove("drag-over"));
        bin.addEventListener("drop", e => {
            e.preventDefault();
            bin.classList.remove("drag-over");
            const dt = e.dataTransfer;
            const id = dt ? dt.getData("text/plain") : "";
            const item = id ? document.getElementById(id) : null;
            if (!item) return;
            handleDrop(item, bin.dataset.type);
        });
    });
}

// Shared drop logic — round ends when all 14 items are sorted
async function handleDrop(itemEl, binType) {
    const id = itemEl.id;
    const isCorrect = correctMap[id] === binType;

    if (isCorrect) {
        sessionScore += 10;
        itemEl.style.display = "none";
        toast(praiseMessage(binType));
    } else {
        sessionScore = Math.max(0, sessionScore - 5);
        toast(critiqueMessage(id, binType));
    }

    const totalNow = (playerName ? await getPlayerTotal(playerName) : 0) + sessionScore;
    writeScore(totalNow);

    // If all items are done, show finish prompt (no respawns)
    if (getVisibleItems().length === 0) {
        toast("All items sorted! Click Finish to save.");
        document.getElementById("againBtn").style.display = "inline-block";
    }
}

// Keyboard accessibility: focus item, press 1/2/3 to drop to bins
function enableKeyboardDrops() {
    document.addEventListener("keydown", (e) => {
        const active = document.activeElement;
        if (!active || !active.classList || !active.classList.contains("item")) return;
        let bin = null;
        if (e.key === "1") bin = "compost";
        if (e.key === "2") bin = "recycle";
        if (e.key === "3") bin = "hazardous";
        if (!bin) return;
        e.preventDefault();
        handleDrop(active, bin);
    });
}

// UI helpers
function writeScore(val) {
    const el = document.getElementById("score");
    if (el) el.textContent = String(val);
}

function showStartFlash() {
    const el = document.getElementById("startFlash");
    if (!el) return;
    el.classList.add("show");
    clearTimeout(showStartFlash._t);
    showStartFlash._t = setTimeout(() => el.classList.remove("show"), 900);
}

function showFirstRunHint() {
    const HINT_KEY = "ecogame.hintShown";
    try {
        if (localStorage.getItem(HINT_KEY)) return;
        const el = document.getElementById("hint");
        if (!el) return;
        el.textContent = "Tip: 1 = Compost, 2 = Recycle, 3 = Hazardous. Drag with mouse or use keys.";
        el.classList.add("show");
        setTimeout(() => el.classList.remove("show"), 3000);
        localStorage.setItem(HINT_KEY, "1");
    } catch {}
}

function toast(msg) {
    let box = document.querySelector(".toast");
    if (!box) {
        box = document.createElement("div");
        box.className = "toast";
        document.body.appendChild(box);
    }
    box.textContent = msg;
    box.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => box.classList.remove("show"), 1400);
}

// Messages
function praiseMessage(type) {
    const lines = {
        recycle: "Great! Recycling saves energy.",
        compost: "Nice! Compost turns scraps into soil.",
        hazardous: "Good job! Hazardous waste kept safe."
    };
    return lines[type] || "Well done!";
}

function critiqueMessage(id, target) {
    const why = {
        banana: "Food scraps belong in compost.",
        battery: "Batteries are hazardous—never bin normally.",
        paper: "Paper goes to recycling.",
        bottle: "Plastics go to recycling.",
        apple: "Food scraps belong in compost.",
        fishbone: "Organic waste should be composted.",
        plasticbag: "Bags go to recycling.",
        chips: "Wrappers go to recycling if accepted.",
        phone: "E-waste is hazardous; use e-waste bins.",
        cloth: "Textiles: send to textile recycling if available.",
        glass: "Glass belongs in recycling.",
        cardboard: "Cardboard goes to recycling.",
        joystick: "E-waste is hazardous; use e-waste bins.",
        bone: "Bones are organic; compost them."
    };
    const targetText = target === "recycle" ? "recycling" : target;
    return (why[id] || "Not quite.") + ` Try ${targetText}.`;
}

// —— Randomization ——
// Fisher–Yates shuffle (unbiased) [11][6]
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Keep visible items inside bounds after resize
function keepInBounds(items) {
    items.forEach(el => {
        const leftPct = Math.min(98, Math.max(0, parseFloat(el.style.left) || 0));
        const topPct = Math.min(98, Math.max(0, parseFloat(el.style.top) || 0));
        el.style.left = leftPct + "%";
        el.style.top = topPct + "%";
    });
}

// Random positions within game area, away from bottom bins with light de-clumping
function setRandomPositions(items) {
    const game = document.getElementById("game");
    if (!game) return;

    const gameRect = game.getBoundingClientRect();
    const itemW = 72,
        itemH = 72;
    const pad = 16;
    const bottomSafe = 140;

    const maxLeft = Math.max(0, gameRect.width - itemW - pad * 2);
    const maxTop = Math.max(0, gameRect.height - bottomSafe - itemH - pad * 2);

    const placed = [];
    const shuffled = shuffle(items.slice());

    shuffled.forEach(el => {
        let tries = 0,
            x, y;
        do {
            x = Math.random() * maxLeft + pad;
            y = Math.random() * maxTop + pad;
            tries++;
        } while (tries < 12 && placed.some(p => Math.hypot(p.x - x, p.y - y) < 60));

        placed.push({ x, y });
        const leftPct = (x / gameRect.width) * 100;
        const topPct = (y / gameRect.height) * 100;
        el.style.left = leftPct.toFixed(2) + "%";
        el.style.top = topPct.toFixed(2) + "%";
    });
}