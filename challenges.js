// --- Shared localStorage Score Functions ---
const LS_KEY = "ecogame.players";

function loadPlayers() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; } }

function savePlayers(players) { localStorage.setItem(LS_KEY, JSON.stringify(players)); }

function upsertAndAddScore(name, delta) {
    const players = loadPlayers();
    const key = String(name || "").trim();
    if (!key) return;
    const i = players.findIndex(p => (p.name || "").toLowerCase() === key.toLowerCase());
    if (i >= 0) {
        players[i].total = (players[i].total || 0) + (delta || 0);
        players[i].lastPlayed = Date.now();
    } else {
        players.push({ name: key, total: (delta || 0), lastPlayed: Date.now() });
    }
    players.sort((a, b) => (b.total || 0) - (a.total || 0));
    savePlayers(players);
}

// --- Imagga API Configuration ---
// IMPORTANT: PASTE YOUR IMAGGA API KEY AND SECRET HERE
const IMAGGA_API_KEY = 'acc_047c90904c482e5';
const IMAGGA_API_SECRET = '5698a744fafefd166bffc4bc5c351c8a';

const imaggaApiUrl = 'https://api.imagga.com/v2/tags';
// Create the authentication header required by Imagga
const imaggaAuthHeader = 'Basic ' + btoa(IMAGGA_API_KEY + ':' + IMAGGA_API_SECRET);


// --- Challenge Data ---
const challenges = [
    { id: 'plant-sapling', title: 'Plant a Sapling', description: 'Plant a tree in your garden or a community area.', points: 60, icon: '🌳', keywords: ['tree', 'plant', 'sapling', 'gardening', 'soil', 'leaf'] },
    { id: 'waste-free-day', title: 'Waste-Free Wednesday', description: 'Go an entire day without using any single-use plastics.', points: 60, icon: '♻️', keywords: ['reusable', 'bottle', 'cup', 'container', 'bag', 'flask'] },
    { id: 'mini-composter', title: 'Build a Mini Composter', description: 'Create a small compost bin for your kitchen scraps.', points: 60, icon: '🌱', keywords: ['compost', 'jar', 'soil', 'peel', 'food', 'bin'] }
];

// --- DOM Elements ---
const container = document.getElementById('challenge-container');
const imageUploader = document.getElementById('image-uploader');
const modal = document.getElementById('preview-modal');
const modalTitle = document.getElementById('modal-title');
const imagePreview = document.getElementById('image-preview');
const confirmBtn = document.getElementById('confirm-upload-btn');
const cancelBtn = document.getElementById('cancel-upload-btn');
const toastEl = document.getElementById('custom-toast');
const toastMessageEl = document.getElementById('toast-message');


let currentlyVerifyingChallenge = null;
let selectedFile = null;

// --- Core Functions ---
function renderChallenges() {
    container.innerHTML = '';
    challenges.forEach(challenge => {
        const card = document.createElement('div');
        card.className = 'challenge-card';
        card.innerHTML = `
            <div class="challenge-icon">${challenge.icon}</div>
            <div class="challenge-info">
                <h3>${challenge.title}</h3>
                <p>${challenge.description}</p>
            </div>
            <div class="challenge-action">
                <span class="challenge-points">+${challenge.points} PTS</span>
                <button class="btn-primary" data-challenge-id="${challenge.id}">Submit Proof</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// NEW: Custom Toast Notification Function
function showCustomToast(message, isSuccess) {
    toastMessageEl.textContent = message;
    toastEl.classList.remove('hidden', 'success', 'error');
    toastEl.classList.add(isSuccess ? 'success' : 'error');
    toastEl.classList.add('show');

    setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000); // Hide after 3 seconds
}


function showModal(challenge) {
    currentlyVerifyingChallenge = challenge;
    modalTitle.textContent = `Submit for "${challenge.title}"`;
    imageUploader.click();
}

function hideModal() {
    modal.classList.add('hidden');
    imagePreview.src = '#';
    selectedFile = null;
    currentlyVerifyingChallenge = null;
    imageUploader.value = '';
}

function verifyImage() {
    if (!selectedFile || !currentlyVerifyingChallenge) return;

    const button = document.querySelector(`button[data-challenge-id="${currentlyVerifyingChallenge.id}"]`);
    if (button) button.textContent = "Verifying...";
    confirmBtn.textContent = "Verifying...";
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;

    const reader = new FileReader();
    reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];

        // Create a FormData object to send to Imagga
        const formData = new FormData();
        formData.append('image_base64', base64Data);

        // Call the Imagga API
        fetch(imaggaApiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': imaggaAuthHeader
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.result && data.result.tags) {
                    const labels = data.result.tags.map(tag => tag.tag.en.toLowerCase());
                    console.log("Imagga AI Labels:", labels); // For debugging

                    const isMatch = currentlyVerifyingChallenge.keywords.some(keyword => labels.includes(keyword));

                    if (isMatch) {
                        const playerName = localStorage.getItem('ecogame.lastPlayer') || "Player";
                        upsertAndAddScore(playerName, currentlyVerifyingChallenge.points);
                        showCustomToast(`Verification Successful! +${currentlyVerifyingChallenge.points} PTS`, true);
                    } else {
                        showCustomToast("Verification Failed. The AI could not confirm.", false);
                    }
                } else {
                    console.error("Imagga API Error Response:", data);
                    showCustomToast("Could not analyze image.", false);
                }
            })
            .catch(error => {
                console.error("Imagga Fetch Error:", error);
                showCustomToast("An error occurred during verification.", false);
            })
            .finally(() => {
                if (button) button.textContent = "Submit Proof";
                confirmBtn.textContent = "Verify Image";
                confirmBtn.disabled = false;
                cancelBtn.disabled = false;
                hideModal();
            });
    };
    reader.readAsDataURL(selectedFile);
}

// --- Event Listeners ---
container.addEventListener('click', (e) => {
    if (e.target && e.target.matches('button[data-challenge-id]')) {
        const challengeId = e.target.dataset.challengeId;
        const challenge = challenges.find(c => c.id === challengeId);
        if (challenge) {
            showModal(challenge);
        }
    }
});

imageUploader.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        selectedFile = e.target.files[0];
        imagePreview.src = URL.createObjectURL(selectedFile);
        modal.classList.remove('hidden');
    } else {
        hideModal();
    }
});

confirmBtn.addEventListener('click', verifyImage);
cancelBtn.addEventListener('click', hideModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        hideModal();
    }
});

// Initial Render
renderChallenges();