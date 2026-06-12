// Garden Focus / Task Tree State & Logic

const state = {
  trees: JSON.parse(localStorage.getItem('garden_focus_trees')) || [],
  currentTreeId: null,
  geminiApiKey: localStorage.getItem('gemini_api_key') || '',
  selectedTreeType: 'apple', // For the "Add Tree" Modal
  coins: parseInt(localStorage.getItem('garden_focus_coins')) || 0
};

// DOM Elements
const elements = {
  screenGarden: document.getElementById('screen-garden'),
  screenTreeDetail: document.getElementById('screen-tree-detail'),
  
  // Garden Screen
  treeGrid: document.getElementById('tree-grid'),
  addTreeTrigger: document.getElementById('add-tree-trigger'),
  openSettingsBtn: document.getElementById('open-settings-btn'),
  todayHarvestCount: document.getElementById('today-harvest-count'),
  openBasketBtn: document.getElementById('open-basket-btn'),
  coinCount: document.getElementById('coin-count'),
  
  // Detail Screen
  backToGardenBtn: document.getElementById('back-to-garden-btn'),
  editTreeNameBtn: document.getElementById('edit-tree-name-btn'),
  harvestTreeBtn: document.getElementById('harvest-tree-btn'),
  treeCanvas: document.getElementById('tree-canvas'),
  treeDetailName: document.getElementById('tree-detail-name'),
  treeDetailType: document.getElementById('tree-detail-type'),
  treeDetailProgressPercent: document.getElementById('tree-detail-progress-percent'),
  treeDetailProgressFraction: document.getElementById('tree-detail-progress-fraction'),
  taskInput: document.getElementById('task-input'),
  addTaskBtn: document.getElementById('add-task-btn'),
  tasksList: document.getElementById('tasks-list'),
  
  // Add Tree Modal
  addTreeModal: document.getElementById('add-tree-modal'),
  treeNameInput: document.getElementById('tree-name-input'),
  cancelAddTreeBtn: document.getElementById('cancel-add-tree-btn'),
  confirmAddTreeBtn: document.getElementById('confirm-add-tree-btn'),
  optionCards: document.querySelectorAll('.option-card'),
  
  // Settings Modal
  settingsModal: document.getElementById('settings-modal'),
  apiKeyInput: document.getElementById('api-key-input'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),

  // Basket Modal
  basketModal: document.getElementById('basket-modal'),
  closeBasketBtn: document.getElementById('close-basket-btn'),
  basketList: document.getElementById('basket-list')
};

// Particle Animation Variables for Task Completion (v4)
let activeParticles = [];
let particleAnimationId = null;
let lastTreeCoordinates = []; // To find leaf coordinates for particle spawning

// Ensure we have at least one tree in the garden by default
if (state.trees.length === 0) {
  state.trees.push({
    id: `${Date.now()}-first`,
    name: '最初の課題の木',
    type: 'apple',
    tasks: [
      { id: `${Date.now()}-t1`, text: 'タスクを追加してみる', status: 'todo' },
      { id: `${Date.now()}-t2`, text: 'タスクを「途中」にしてみる', status: 'doing' },
      { id: `${Date.now()}-t3`, text: 'タスクを「達成」にして開花させる', status: 'done' }
    ]
  });
  saveTrees();
}

function saveTrees() {
  localStorage.setItem('garden_focus_trees', JSON.stringify(state.trees));
}

function updateCoinCount() {
  if (elements.coinCount) {
    elements.coinCount.textContent = state.coins.toLocaleString();
  }
}

// Play synth sound using Web Audio API
function playSynthSound(type = 'default') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    let frequencies = [523.25]; // C5 default tick
    let duration = 0.12;
    let waveType = 'sine';
    
    if (type === 'success') {
      frequencies = [523.25, 659.25, 783.99, 1046.50]; // Sweet ascending chime C5, E5, G5, C6
      duration = 0.35;
    } else if (type === 'nudge') {
      frequencies = [329.63, 261.63]; // E4 -> C4 short drop
      duration = 0.18;
    } else if (type === 'harvest') {
      frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98]; // Joyful arpeggio C5 to G6
      duration = 0.55;
    }
    
    const now = ctx.currentTime;
    const noteTime = duration / frequencies.length;
    
    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, now + index * 0.07);
      
      gainNode.gain.setValueAtTime(0.12, now + index * 0.07);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + index * 0.07 + noteTime);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + index * 0.07);
      osc.stop(now + index * 0.07 + noteTime);
    });
  } catch (e) {
    console.warn("Synth audio feedback context could not initialize:", e);
  }
}

// ----------------------------------------------------
// CANVAS RENDERING ENGINE (MODERN VECTOR BACKGROUNDS & OVERLAYS)
// ----------------------------------------------------

// Deterministic random generation based on a seed value to prevent wiggling on re-renders
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Image cache for preloaded vector templates
const imageCache = {};

function getOrLoadImage(src, callback) {
  if (imageCache[src]) {
    if (imageCache[src].loaded) {
      return imageCache[src].img;
    } else {
      if (callback && !imageCache[src].callbacks.includes(callback)) {
        imageCache[src].callbacks.push(callback);
      }
      return null;
    }
  }
  const img = new Image();
  imageCache[src] = {
    img: img,
    loaded: false,
    callbacks: callback ? [callback] : []
  };
  img.onload = () => {
    imageCache[src].loaded = true;
    imageCache[src].callbacks.forEach(cb => {
      try { cb(); } catch (e) { console.error(e); }
    });
    imageCache[src].callbacks = [];
  };
  img.onerror = () => {
    console.error(`Failed to load image: ${src}`);
    imageCache[src].loaded = false;
  };
  img.src = src;
  return null;
}

// Coordinates mapping on a 600x600 grid for placing overlay task fruits/blossoms
const TREE_FRUIT_COORDINATES = {
  apple: {
    sapling: [
      { x: 300, y: 220 }, { x: 250, y: 310 }
    ],
    small: [
      { x: 300, y: 190 }, { x: 230, y: 270 }, { x: 370, y: 260 }, { x: 290, y: 320 }
    ],
    medium: [
      { x: 300, y: 170 }, { x: 220, y: 250 }, { x: 380, y: 240 }, { x: 270, y: 310 },
      { x: 340, y: 300 }, { x: 180, y: 290 }, { x: 420, y: 280 }, { x: 310, y: 240 }
    ],
    lush: [
      { x: 300, y: 140 }, { x: 220, y: 220 }, { x: 380, y: 210 }, { x: 250, y: 290 },
      { x: 350, y: 280 }, { x: 180, y: 270 }, { x: 420, y: 260 }, { x: 310, y: 200 },
      { x: 270, y: 170 }, { x: 330, y: 160 }, { x: 150, y: 320 }, { x: 450, y: 310 },
      { x: 290, y: 350 }, { x: 350, y: 350 }, { x: 200, y: 340 }
    ],
    grand: [
      { x: 300, y: 120 }, { x: 210, y: 200 }, { x: 390, y: 190 }, { x: 240, y: 270 },
      { x: 360, y: 260 }, { x: 170, y: 250 }, { x: 430, y: 240 }, { x: 310, y: 180 },
      { x: 260, y: 150 }, { x: 340, y: 140 }, { x: 140, y: 300 }, { x: 460, y: 290 },
      { x: 280, y: 330 }, { x: 340, y: 330 }, { x: 190, y: 320 }, { x: 410, y: 310 },
      { x: 220, y: 150 }, { x: 380, y: 140 }, { x: 110, y: 350 }, { x: 490, y: 340 },
      { x: 250, y: 380 }, { x: 350, y: 380 }, { x: 300, y: 240 }, { x: 160, y: 400 },
      { x: 440, y: 390 }
    ]
  },
  cherry: {
    sapling: [
      { x: 300, y: 230 }, { x: 260, y: 300 }
    ],
    small: [
      { x: 300, y: 195 }, { x: 235, y: 265 }, { x: 365, y: 255 }, { x: 285, y: 315 }
    ],
    medium: [
      { x: 300, y: 175 }, { x: 225, y: 245 }, { x: 375, y: 235 }, { x: 275, y: 305 },
      { x: 335, y: 295 }, { x: 185, y: 285 }, { x: 415, y: 275 }, { x: 315, y: 235 }
    ],
    lush: [
      { x: 300, y: 145 }, { x: 225, y: 215 }, { x: 375, y: 205 }, { x: 255, y: 285 },
      { x: 345, y: 275 }, { x: 185, y: 265 }, { x: 415, y: 255 }, { x: 315, y: 195 },
      { x: 275, y: 165 }, { x: 335, y: 155 }, { x: 155, y: 315 }, { x: 445, y: 305 },
      { x: 285, y: 345 }, { x: 345, y: 345 }, { x: 205, y: 335 }
    ],
    grand: [
      { x: 300, y: 125 }, { x: 215, y: 195 }, { x: 385, y: 185 }, { x: 245, y: 265 },
      { x: 355, y: 255 }, { x: 175, y: 245 }, { x: 425, y: 235 }, { x: 315, y: 175 },
      { x: 265, y: 145 }, { x: 345, y: 135 }, { x: 145, y: 295 }, { x: 455, y: 285 },
      { x: 285, y: 325 }, { x: 345, y: 325 }, { x: 195, y: 315 }, { x: 405, y: 305 },
      { x: 225, y: 145 }, { x: 375, y: 135 }, { x: 115, y: 345 }, { x: 485, y: 335 },
      { x: 255, y: 375 }, { x: 345, y: 375 }, { x: 305, y: 235 }, { x: 165, y: 395 },
      { x: 435, y: 385 }
    ]
  },
  cactus: {
    sapling: [
      { x: 300, y: 290 }, { x: 300, y: 220 }
    ],
    small: [
      { x: 300, y: 190 }, { x: 250, y: 250 }, { x: 350, y: 230 }, { x: 300, y: 290 }
    ],
    medium: [
      { x: 300, y: 160 }, { x: 210, y: 220 }, { x: 390, y: 200 },
      { x: 210, y: 290 }, { x: 390, y: 270 }, { x: 300, y: 280 },
      { x: 270, y: 350 }, { x: 330, y: 340 }
    ],
    lush: [
      { x: 300, y: 130 }, { x: 210, y: 190 }, { x: 390, y: 170 },
      { x: 150, y: 260 }, { x: 450, y: 240 },
      { x: 300, y: 230 }, { x: 210, y: 290 }, { x: 390, y: 270 },
      { x: 150, y: 350 }, { x: 450, y: 330 }, { x: 260, y: 360 },
      { x: 340, y: 350 }, { x: 300, y: 310 }, { x: 220, y: 390 },
      { x: 380, y: 380 }
    ],
    grand: [
      { x: 300, y: 100 }, { x: 210, y: 160 }, { x: 390, y: 140 },
      { x: 140, y: 230 }, { x: 460, y: 210 }, { x: 90, y: 300 },
      { x: 510, y: 280 },
      { x: 300, y: 190 }, { x: 210, y: 240 }, { x: 390, y: 220 },
      { x: 140, y: 310 }, { x: 460, y: 290 }, { x: 90, y: 380 },
      { x: 510, y: 360 }, { x: 250, y: 330 }, { x: 350, y: 320 },
      { x: 300, y: 270 }, { x: 210, y: 330 }, { x: 390, y: 310 },
      { x: 260, y: 400 }, { x: 340, y: 390 }, { x: 170, y: 380 },
      { x: 430, y: 370 }, { x: 300, y: 440 }, { x: 300, y: 360 }
    ]
  }
};

// Draw sprout when a tree has 0 tasks
function drawSprout(ctx, x, y) {
  // Ground
  ctx.beginPath();
  ctx.moveTo(x - 50, y);
  ctx.lineTo(x + 50, y);
  ctx.strokeStyle = '#8C8275';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Stem
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - 5, y - 25, x + 3, y - 40);
  ctx.strokeStyle = '#556B2F';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Sprout Leaf Left (Stylized Vector)
  ctx.beginPath();
  ctx.ellipse(x - 5, y - 40, 8, 4, -Math.PI / 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#8FBC8F';
  ctx.fill();
  ctx.strokeStyle = '#556B2F';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Sprout Leaf Right (Stylized Vector)
  ctx.beginPath();
  ctx.ellipse(x + 10, y - 43, 7, 4, Math.PI / 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#6B8E23';
  ctx.fill();
  ctx.strokeStyle = '#556B2F';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Ground grass bits
  ctx.beginPath();
  ctx.moveTo(x - 20, y);
  ctx.lineTo(x - 25, y - 10);
  ctx.moveTo(x + 20, y);
  ctx.lineTo(x + 23, y - 8);
  ctx.strokeStyle = '#8FBC8F';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Fallback Canvas vector cactus rendering for medium, lush and grand stages
function drawVectorCactus(ctx, width, height, maxDepth) {
  ctx.save();
  
  // Scale dynamically to 600x600 base coordinates
  const scale = width / 600;
  ctx.scale(scale, scale);
  
  const mainGreen = '#2E5A27';
  const lightGreen = '#4E8A43';
  const shadowGreen = '#1D3B18';
  const trunkY = 540; // 600 - 60 (soil level in 600px grid)

  function drawPillar(x, y, w, h) {
    ctx.save();
    
    // Draw outer stroke
    ctx.beginPath();
    ctx.roundRect(x - w/2, y - h, w, h, w/2);
    ctx.fillStyle = shadowGreen;
    ctx.fill();
    
    // Draw body
    ctx.beginPath();
    ctx.roundRect(x - w/2 + 2, y - h + 2, w - 4, h - 4, (w - 4)/2);
    const grad = ctx.createLinearGradient(x - w/2, 0, x + w/2, 0);
    grad.addColorStop(0, mainGreen);
    grad.addColorStop(0.5, lightGreen);
    grad.addColorStop(1, shadowGreen);
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Draw ribs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y - h + w/2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x - w/4, y - 4);
    ctx.lineTo(x - w/4, y - h + w/2 + 5);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(x + w/4, y - 4);
    ctx.lineTo(x + w/4, y - h + w/2 + 5);
    ctx.stroke();
    
    // Draw tiny needles
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    for (let ny = y - h + w/2; ny < y - 10; ny += 30) {
      ctx.beginPath();
      ctx.moveTo(x - 5, ny);
      ctx.lineTo(x + 5, ny);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(x - w/4 - 4, ny + 10);
      ctx.lineTo(x - w/4 + 4, ny + 10);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(x + w/4 - 4, ny + 10);
      ctx.lineTo(x + w/4 + 4, ny + 10);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // Draw base trunk and side arms based on complexity (coordinates mapped to 600x600 grid)
  if (maxDepth === 5) {
    // Medium Cactus: 1 center, 2 side arms
    ctx.beginPath();
    ctx.roundRect(220, trunkY - 210, 80, 40, 20);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(210, trunkY - 180, 32, 90);
    
    ctx.beginPath();
    ctx.roundRect(300, trunkY - 230, 90, 40, 20);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(390, trunkY - 200, 32, 80);
    
    drawPillar(300, trunkY, 52, 280);
  } 
  else if (maxDepth === 6) {
    // Lush Cactus: 5 columns
    ctx.beginPath();
    ctx.roundRect(160, trunkY - 190, 70, 34, 17);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(150, trunkY - 170, 26, 80);
    
    ctx.beginPath();
    ctx.roundRect(210, trunkY - 250, 90, 38, 19);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(210, trunkY - 220, 32, 100);
    
    ctx.beginPath();
    ctx.roundRect(370, trunkY - 210, 80, 34, 17);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(450, trunkY - 190, 26, 90);
    
    ctx.beginPath();
    ctx.roundRect(300, trunkY - 280, 90, 38, 19);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(390, trunkY - 250, 32, 120);
    
    drawPillar(300, trunkY, 58, 340);
  } 
  else {
    // Grand Cactus: 7 columns
    ctx.beginPath();
    ctx.roundRect(100, trunkY - 150, 80, 30, 15);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(90, trunkY - 130, 24, 70);
    
    ctx.beginPath();
    ctx.roundRect(140, trunkY - 240, 80, 34, 17);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(140, trunkY - 210, 28, 90);
    
    ctx.beginPath();
    ctx.roundRect(210, trunkY - 320, 90, 38, 19);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(210, trunkY - 290, 34, 130);
    
    ctx.beginPath();
    ctx.roundRect(420, trunkY - 170, 90, 30, 15);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(510, trunkY - 150, 24, 80);
    
    ctx.beginPath();
    ctx.roundRect(380, trunkY - 260, 80, 34, 17);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(460, trunkY - 230, 28, 100);
    
    ctx.beginPath();
    ctx.roundRect(300, trunkY - 350, 90, 38, 19);
    ctx.fillStyle = mainGreen;
    ctx.fill();
    drawPillar(390, trunkY - 320, 34, 150);
    
    drawPillar(300, trunkY, 64, 400);
  }
  
  ctx.restore();
}

// Main tree rendering function using pre-loaded images & dynamic vector overlays
function drawTree(canvas, type, tasks) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.clearRect(0, 0, width, height);

  let seed = 12345;

  // 0. DRAW BEAUTIFUL LUSH BACKDROP
  // Sky Gradient (Clean and modern)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#EAE2D5');
  skyGrad.addColorStop(0.7, '#FAF6F0');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft Background Hills
  ctx.fillStyle = '#E8DFD0';
  ctx.beginPath();
  ctx.arc(width * 0.25, height - 20, 180, Math.PI, 0, false);
  ctx.fill();

  ctx.fillStyle = '#E3D5CA';
  ctx.beginPath();
  ctx.arc(width * 0.75, height - 10, 160, Math.PI, 0, false);
  ctx.fill();

  // Soil/Ground area
  const soilGrad = ctx.createLinearGradient(0, height - 60, 0, height);
  soilGrad.addColorStop(0, '#C6AC93');
  soilGrad.addColorStop(1, '#9C846C');
  ctx.fillStyle = soilGrad;
  ctx.fillRect(0, height - 60, width, 60);

  // Tiny Grass & Flowers on the ground
  for (let i = 0; i < width; i += 12) {
    const grassHeight = 6 + seededRandom(seed++) * 10;
    ctx.beginPath();
    ctx.moveTo(i, height - 60);
    ctx.lineTo(i + 4, height - 60 - grassHeight);
    ctx.lineTo(i + 8, height - 60);
    ctx.fillStyle = seededRandom(seed++) > 0.4 ? '#8FBC8F' : '#6B8E23';
    ctx.fill();
  }

  // Draw little field flowers
  const fieldFlowerColors = ['#FFC0CB', '#FCE7F3', '#FEF3C7', '#FFE4E1'];
  for (let i = 0; i < 7; i++) {
    const fx = 25 + seededRandom(seed++) * (width - 50);
    const fy = height - 60 - seededRandom(seed++) * 6;
    ctx.beginPath();
    ctx.arc(fx, fy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = fieldFlowerColors[Math.floor(seededRandom(seed++) * fieldFlowerColors.length)];
    ctx.fill();
    // Center dot
    ctx.beginPath();
    ctx.arc(fx, fy, 1.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFE0';
    ctx.fill();
    // Stem
    ctx.beginPath();
    ctx.moveTo(fx, fy + 3);
    ctx.lineTo(fx, height - 60);
    ctx.strokeStyle = '#556B2F';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  if (tasks.length === 0) {
    drawSprout(ctx, width / 2, height - 60);
    return;
  }

  // Determine stage based on tasks count (70% scaled thresholds)
  let stage = 'sapling';
  let maxDepth = 3; 

  if (tasks.length === 1 || tasks.length === 2) {
    stage = 'sapling';
    maxDepth = 3;
  } else if (tasks.length === 3 || tasks.length === 4) {
    stage = 'small';
    maxDepth = 4;
  } else if (tasks.length >= 5 && tasks.length <= 8) {
    stage = 'medium';
    maxDepth = 5;
  } else if (tasks.length >= 9 && tasks.length <= 15) {
    stage = 'lush';
    maxDepth = 6;
  } else {
    stage = 'grand';
    maxDepth = 7;
  }

  const coordinates = TREE_FRUIT_COORDINATES[type][stage] || [];
  const scaleX = width / 600;
  const scaleY = height / 600;

  const isCactusVector = type === 'cactus' && (stage === 'medium' || stage === 'lush' || stage === 'grand');

  const drawOverlayElements = () => {
    const activeCoords = [];
    tasks.forEach((task, idx) => {
      const coordRaw = coordinates[idx % coordinates.length] || { x: 300, y: 300 };
      const coord = {
        x: coordRaw.x * scaleX,
        y: coordRaw.y * scaleY
      };
      activeCoords.push({ x: coord.x, y: coord.y });
      
      // Render dynamically scaled fruits matching canvas resolution
      ctx.save();
      ctx.translate(coord.x, coord.y);
      ctx.scale(scaleX, scaleY);
      drawLeafOrnament(ctx, 0, 0, type, task.status);
      ctx.restore();
    });
    lastTreeCoordinates = activeCoords;
  };

  if (isCactusVector) {
    drawVectorCactus(ctx, width, height, maxDepth);
    drawOverlayElements();
  } else {
    const imagePath = `assets/${type}_${stage}.png`;
    const redrawCallback = () => {
      if (canvas.isConnected) {
        drawTree(canvas, type, tasks);
      }
    };
    
    const img = getOrLoadImage(imagePath, redrawCallback);
    if (img) {
      ctx.drawImage(img, 0, 0, width, height);
      drawOverlayElements();
    } else {
      ctx.save();
      ctx.fillStyle = '#8C8275';
      ctx.font = `${14 * scaleX}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('画像をロード中...', width / 2, height / 2);
      ctx.restore();
    }
  }
}

// Draw leaf, bud, or flower/fruit depending on status (Refreshed for Modern Vector Theme)
function drawLeafOrnament(ctx, x, y, type, status) {
  ctx.save();

  if (status === 'todo') {
    // 1. TODO: Modern Green leaf
    ctx.beginPath();
    ctx.ellipse(x, y, 11, 5.5, Math.PI / 4, 0, 2 * Math.PI);
    
    const leafGrad = ctx.createLinearGradient(x - 5, y - 5, x + 5, y + 5);
    leafGrad.addColorStop(0, '#8FBC8F');
    leafGrad.addColorStop(1, '#556B2F');
    ctx.fillStyle = leafGrad;
    ctx.fill();
    
    ctx.strokeStyle = '#3E4F22';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Vein line
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6);
    ctx.lineTo(x + 5, y + 5);
    ctx.strokeStyle = '#3E4F22';
    ctx.stroke();
  } 
  
  else if (status === 'doing') {
    // 2. DOING: Colored Bud
    let budColorStart = '#FEF3C7';
    let budColorEnd = '#F59E0B';
    let strokeColor = '#D97706';
    
    if (type === 'cherry') {
      budColorStart = '#FFF1F2';
      budColorEnd = '#FDA4AF';
      strokeColor = '#F43F5E';
    } else if (type === 'cactus') {
      budColorStart = '#FEF9C3';
      budColorEnd = '#FACC15';
      strokeColor = '#CA8A04';
    }

    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.bezierCurveTo(x + 6, y - 9, x + 7, y + 1, x, y + 6);
    ctx.bezierCurveTo(x - 7, y + 1, x - 6, y - 9, x, y - 9);
    
    const budGrad = ctx.createRadialGradient(x - 2, y - 3, 1, x, y, 8);
    budGrad.addColorStop(0, budColorStart);
    budGrad.addColorStop(1, budColorEnd);
    
    ctx.fillStyle = budGrad;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.ellipse(x - 4, y + 6, 4, 2, -Math.PI/6, 0, 2*Math.PI);
    ctx.fillStyle = '#556B2F';
    ctx.fill();
  } 
  
  else if (status === 'done') {
    // 3. DONE: Bloom / Fruit (Highly stylized premium vector graphics)
    if (type === 'apple') {
      const drawAppleItem = (cx, cy, radius, rotateAngle) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotateAngle);

        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.4);
        ctx.bezierCurveTo(-radius * 0.8, -radius * 1.2, -radius * 1.3, -radius * 0.5, -radius * 1.3, radius * 0.3);
        ctx.bezierCurveTo(-radius * 1.3, radius * 1.1, -radius * 0.7, radius * 0.95, 0, radius * 0.9);
        ctx.bezierCurveTo(radius * 0.7, radius * 0.95, radius * 1.3, radius * 1.1, radius * 1.3, radius * 0.3);
        ctx.bezierCurveTo(radius * 1.3, -radius * 0.5, radius * 0.8, -radius * 1.2, 0, -radius * 0.4);
        
        const grad = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, radius * 0.2, 0, 0, radius * 1.2);
        grad.addColorStop(0, '#FF6B6B');
        grad.addColorStop(0.7, '#EE5253');
        grad.addColorStop(1, '#8B0000');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#5C1D1D';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(-radius * 0.4, -radius * 0.3, radius * 0.3, radius * 0.15, -Math.PI / 4, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.4);
        ctx.quadraticCurveTo(radius * 0.3, -radius * 1.1, radius * 0.5, -radius * 1.2);
        ctx.strokeStyle = '#5C4033';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(radius * 0.2, -radius * 0.85, radius * 0.4, radius * 0.18, -Math.PI / 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#6B8E23';
        ctx.fill();
        ctx.strokeStyle = '#3E4F22';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.restore();
      };
      
      drawAppleItem(x - 6, y + 4, 7.5, -Math.PI/12);
      drawAppleItem(x + 6, y + 2, 7.0, Math.PI/8);
    } 
    
    else if (type === 'cherry') {
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.quadraticCurveTo(x - 5, y - 2, x - 8, y + 6);
      ctx.moveTo(x, y - 6);
      ctx.quadraticCurveTo(x + 3, y - 2, x + 8, y + 4);
      ctx.strokeStyle = '#3A6B35';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(x + 3, y - 8, 4, 2, -Math.PI/6, 0, 2 * Math.PI);
      ctx.fillStyle = '#4D8A43';
      ctx.fill();

      const drawCherryItem = (cx, cy, radius) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        
        const grad = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.25, radius * 0.2, cx, cy, radius);
        grad.addColorStop(0, '#FF4D6D');
        grad.addColorStop(0.7, '#C71585');
        grad.addColorStop(1, '#5C0632');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = '#4A0528';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx - radius * 0.35, cy - radius * 0.35, radius * 0.2, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
        ctx.restore();
      };

      drawCherryItem(x - 8, y + 6, 6.5);
      drawCherryItem(x + 8, y + 4, 6.0);
    } 
    
    else if (type === 'cactus') {
      const fx = x;
      const fy = y;
      
      ctx.fillStyle = '#FF5E00';
      ctx.strokeStyle = '#CC3F00';
      ctx.lineWidth = 0.8;
      
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate((i * Math.PI) / 4);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-4, -13);
        ctx.lineTo(0, -16);
        ctx.lineTo(4, -13);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#CA8A04';
      ctx.lineWidth = 0.8;
      
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate((i * Math.PI) / 4 + Math.PI / 8);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-2.5, -9);
        ctx.lineTo(0, -11);
        ctx.lineTo(2.5, -9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(fx, fy, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFE0';
      ctx.fill();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(fx - 1, fy - 1, 1.2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }

  ctx.restore();
}

// ----------------------------------------------------
// UI CONTROLS & EVENT BINDINGS
// ----------------------------------------------------

function openAddTreeModal() {
  elements.treeNameInput.value = '';
  elements.addTreeModal.classList.remove('hidden');
}

function closeAddTreeModal() {
  elements.addTreeModal.classList.add('hidden');
}

function confirmAddTree() {
  const treeName = elements.treeNameInput.value.trim();
  if (!treeName) return;

  const newTree = {
    id: `${Date.now()}-${Math.random()}`,
    name: treeName,
    type: state.selectedTreeType,
    tasks: [],
    harvested: false,
    harvestedAt: null
  };

  state.trees.push(newTree);
  saveTrees();
  closeAddTreeModal();
  renderGarden();
}

function selectTreeType(e) {
  const card = e.currentTarget;
  elements.optionCards.forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  state.selectedTreeType = card.dataset.type;
}

// Navigation & detail screen loading
function loadTreeDetail(treeId) {
  state.currentTreeId = treeId;
  const tree = state.trees.find(t => t.id === treeId);
  if (!tree) return;

  elements.screenGarden.classList.add('hidden');
  elements.screenTreeDetail.classList.remove('hidden');

  elements.treeDetailName.textContent = tree.name;
  elements.treeDetailType.textContent = `木の種類: ${getTreeTypeName(tree.type)}`;

  // Setup detail Canvas size properly
  elements.treeCanvas.width = 600;
  elements.treeCanvas.height = 600;

  renderTreeDetail();
}

function getTreeTypeName(type) {
  switch (type) {
    case 'apple': return 'リンゴの木 🍎';
    case 'cherry': return 'サクラの木 🌸';
    case 'cactus': return 'サボテン 🌵';
    default: return '植物';
  }
}

function getTreeBadgeColor(type) {
  switch (type) {
    case 'apple': return 'background-color: #FEE2E2; color: #991B1B;';
    case 'cherry': return 'background-color: #FCE7F3; color: #9D174D;';
    case 'cactus': return 'background-color: #DCFCE7; color: #166534;';
    default: return 'background-color: #F3F4F6; color: #374151;';
  }
}

function renderTreeDetail() {
  const tree = state.trees.find(t => t.id === state.currentTreeId);
  if (!tree) return;

  // Render lists
  elements.tasksList.innerHTML = '';
  
  if (tree.tasks.length === 0) {
    elements.tasksList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🍃</div>
        <p class="empty-text">まだ課題（葉っぱ）がありません。<br>上のフォームからタスクを追加してください。</p>
      </div>
    `;
    elements.treeDetailProgressPercent.textContent = '0%';
    elements.treeDetailProgressFraction.textContent = '0/0';
    elements.harvestTreeBtn.classList.add('hidden');
  } else {
    // Populate list
    tree.tasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'task-item';
      
      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = task.text;
      if (task.status === 'done') {
        text.style.textDecoration = 'line-through';
        text.style.color = '#8C8275';
      }

      // Actions Area
      const actions = document.createElement('div');
      actions.className = 'task-actions';

      // Status Selector Triggers
      const selector = document.createElement('div');
      selector.className = 'status-selector';
      
      const statuses = [
        { id: 'todo', label: '未達成' },
        { id: 'doing', label: '途中' },
        { id: 'done', label: '達成' }
      ];

      statuses.forEach(s => {
        const btn = document.createElement('button');
        btn.className = `status-btn ${task.status === s.id ? 'active' : ''}`;
        btn.dataset.status = s.id;
        btn.textContent = s.label;
        
        btn.addEventListener('click', () => {
          updateTaskStatus(task.id, s.id);
        });
        
        selector.appendChild(btn);
      });

      // Delete Button
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-task-btn';
      delBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      `;
      delBtn.addEventListener('click', () => {
        deleteTask(task.id);
      });

      actions.appendChild(selector);
      actions.appendChild(delBtn);
      row.appendChild(text);
      row.appendChild(actions);

      elements.tasksList.appendChild(row);
    });

    // Update Progress Labels
    const total = tree.tasks.length;
    const done = tree.tasks.filter(t => t.status === 'done').length;
    const percent = Math.round((done / total) * 100) || 0;

    elements.treeDetailProgressPercent.textContent = `${percent}%`;
    elements.treeDetailProgressFraction.textContent = `${done}/${total}`;

    if (total > 0 && done === total && !tree.harvested) {
      elements.harvestTreeBtn.classList.remove('hidden');
    } else {
      elements.harvestTreeBtn.classList.add('hidden');
    }
  }

  // Redraw Canvas representation
  drawTree(elements.treeCanvas, tree.type, tree.tasks);
}

function editTreeName() {
  const tree = state.trees.find(t => t.id === state.currentTreeId);
  if (!tree) return;

  const newName = prompt("木の名前を変更:", tree.name);
  if (newName === null) return;

  const trimmed = newName.trim();
  if (!trimmed) {
    alert("名前は空にできません。");
    return;
  }

  tree.name = trimmed;
  saveTrees();
  elements.treeDetailName.textContent = tree.name;
  playSynthSound();
}

function updateTaskStatus(taskId, newStatus) {
  const tree = state.trees.find(t => t.id === state.currentTreeId);
  if (!tree) return;

  const task = tree.tasks.find(t => t.id === taskId);
  if (task) {
    const isDoneTransition = task.status !== 'done' && newStatus === 'done';
    if (newStatus === 'done') {
      task.doneAt = task.doneAt || Date.now();
    } else {
      delete task.doneAt;
    }
    task.status = newStatus;
    saveTrees();
    renderTreeDetail();
    
    // Play sweet synth chime sound on done
    if (isDoneTransition) {
      playSynthSound('success');
      
      // Spawn organic falling petals particles from the task node coordinate (v4)
      const idx = tree.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1 && lastTreeCoordinates.length > 0) {
        const step = Math.floor(lastTreeCoordinates.length / tree.tasks.length) || 1;
        const coordIdx = Math.min((idx * step) % lastTreeCoordinates.length, lastTreeCoordinates.length - 1);
        const coord = lastTreeCoordinates[coordIdx];
        if (coord) {
          spawnParticles(coord.x, coord.y, tree.type);
        }
      }
    } else {
      playSynthSound(); // short tick
    }
  }
}

function deleteTask(taskId) {
  const tree = state.trees.find(t => t.id === state.currentTreeId);
  if (!tree) return;

  tree.tasks = tree.tasks.filter(t => t.id !== taskId);
  saveTrees();
  renderTreeDetail();
  playSynthSound('nudge');
}

function addTask() {
  const taskText = elements.taskInput.value.trim();
  if (!taskText) return;

  const tree = state.trees.find(t => t.id === state.currentTreeId);
  if (!tree) return;

  // v3: Integrate AI task decomposition option
  // Check if string starts with specific AI token or just add normally
  // To keep it seamless, we add normal task, but we also check if AI trigger was hit
  tree.tasks.push({
    id: `${Date.now()}-${Math.random()}`,
    text: taskText,
    status: 'todo'
  });

  saveTrees();
  elements.taskInput.value = '';
  renderTreeDetail();
  playSynthSound(); // positive tick
}

// AI Task Decomposition triggers (v3)
async function tryAIDecomposeTask() {
  const taskText = elements.taskInput.value.trim();
  if (!taskText) return;

  elements.addTaskBtn.textContent = '分解中...';
  elements.addTaskBtn.disabled = true;

  const processSubtasks = (subtasks) => {
    const tree = state.trees.find(t => t.id === state.currentTreeId);
    if (!tree) return;

    subtasks.forEach(sub => {
      tree.tasks.push({
        id: `${Date.now()}-${Math.random()}`,
        text: sub.trim(),
        status: 'todo'
      });
    });

    saveTrees();
    elements.taskInput.value = '';
    renderTreeDetail();
    playSynthSound('success');
  };

  // Check for Gemini API key configuration
  if (state.geminiApiKey) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are GARDEN FOCUS, an organic task assistant. Analyze the task: "${taskText}". Decompose it into exactly 3 tiny, concrete, and actionable micro-steps that take less than 2 minutes each. Output only a JSON array of 3 strings. Example: ["Open mathematical text book", "Copy exercise equation", "Solve step 1 of calculation"]. Do not output markdown code blocks. Just output raw JSON.`
            }]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text.trim();
        const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed) && parsed.length === 3) {
          processSubtasks(parsed);
          finishAILoading();
          return;
        }
      }
    } catch (e) {
      console.error("Gemini API call failed, using offline fallback.", e);
    }
  }

  // Offline Fallback decomposition logic (v3)
  setTimeout(() => {
    const textLower = taskText.toLowerCase();
    let subtasks = [];

    if (textLower.includes('書') || textLower.includes('write') || textLower.includes('レポート') || textLower.includes('レポート') || textLower.includes('作文')) {
      subtasks = [
        `資料フォルダかエディタを立ち上げる`,
        `レポートの構成目次を1つ決める`,
        `最初の1行目を書き始める`
      ];
    } else if (textLower.includes('読') || textLower.includes('read') || textLower.includes('本') || textLower.includes('勉強') || textLower.includes('学習')) {
      subtasks = [
        `参考書や資料を開き、目次を眺める`,
        `最初の1ページ目だけ読み始める`,
        `気になったキーワードを1つメモする`
      ];
    } else if (textLower.includes('スライド') || textLower.includes('資料') || textLower.includes('作成') || textLower.includes('slide') || textLower.includes('ppt')) {
      subtasks = [
        `スライド作成ソフトを起動する`,
        `表紙に課題タイトルを入力する`,
        `スライド1枚目の構成構成案を下書きする`
      ];
    } else {
      subtasks = [
        `「${taskText}」のためのツール・道具を準備する`,
        `最初の2分間だけ手を動かす`,
        `次の明確なステップを整理する`
      ];
    }

    processSubtasks(subtasks);
    finishAILoading();
  }, 1000);
}

function finishAILoading() {
  elements.addTaskBtn.textContent = '追加';
  elements.addTaskBtn.disabled = false;
}

// ----------------------------------------------------
// GARDEN (HOME) SCREEN DRAWING & CARD LOOPS
// ----------------------------------------------------

function renderGarden() {
  elements.screenTreeDetail.classList.add('hidden');
  elements.screenGarden.classList.remove('hidden');

  // Clear all tree cards except the "Add Tree" trigger card
  const cards = elements.treeGrid.querySelectorAll('.tree-card');
  cards.forEach(c => c.remove());

  updateTodayHarvestCount();
  updateCoinCount();

  // Render cards for existing trees
  state.trees.forEach(tree => {
    if (tree.harvested) return;
    const card = document.createElement('div');
    card.className = 'tree-card';
    card.dataset.id = tree.id;

    // Progress metrics calculation
    const total = tree.tasks.length;
    const done = tree.tasks.filter(t => t.status === 'done').length;
    const percent = Math.round((done / total) * 100) || 0;

    card.innerHTML = `
      <div class="tree-card-header">
        <div>
          <h3 class="tree-card-title">${tree.name}</h3>
          <p class="tree-card-type">${getTreeTypeName(tree.type)}</p>
        </div>
        <span class="tree-card-badge" style="${getTreeBadgeColor(tree.type)}">
          ${percent}%
        </span>
      </div>
      <div class="tree-card-preview">
        <canvas id="preview-canvas-${tree.id}" width="240" height="180"></canvas>
      </div>
      <div class="tree-card-footer">
        <div class="progress-info" style="width: 100%;">
          <div class="flex" style="display: flex; justify-content: space-between;">
            <span>課題進捗</span>
            <span>${done}/${total} 完了</span>
          </div>
          <div class="progress-bar-wrapper">
            <div class="progress-bar-fill" style="width: ${percent}%;"></div>
          </div>
        </div>
      </div>
    `;

    // Add click handler to navigate to detailed view
    card.addEventListener('click', (e) => {
      if (e.target.tagName !== 'CANVAS' && e.target.className.includes('preview')) return; // let canvas click work
      loadTreeDetail(tree.id);
    });

    // Make the entire card block click trigger navigation except when specifically handled
    card.onclick = () => loadTreeDetail(tree.id);

    // Insert card before the trigger card
    elements.treeGrid.insertBefore(card, elements.addTreeTrigger);

    // Render mini preview tree onto card canvas
    setTimeout(() => {
      const canvas = document.getElementById(`preview-canvas-${tree.id}`);
      if (canvas) {
        canvas.width = 240;
        canvas.height = 180;
        drawTree(canvas, tree.type, tree.tasks);
      }
    }, 10);
  });
}

// ----------------------------------------------------
// SETTINGS & MODALS BINDINGS
// ----------------------------------------------------

function openSettings() {
  elements.apiKeyInput.value = state.geminiApiKey;
  elements.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  elements.settingsModal.classList.add('hidden');
}

function saveSettings() {
  state.geminiApiKey = elements.apiKeyInput.value.trim();
  localStorage.setItem('gemini_api_key', state.geminiApiKey);
  closeSettings();
}

// ----------------------------------------------------
// HARVEST & BASKET SYSTEM (v4)
// ----------------------------------------------------

function updateTodayHarvestCount() {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  let count = 0;
  state.trees.forEach(tree => {
    if (tree.tasks) {
      tree.tasks.forEach(task => {
        if (task.status === 'done' && task.doneAt && task.doneAt >= todayStart) {
          count++;
        }
      });
    }
  });
  if (elements.todayHarvestCount) {
    elements.todayHarvestCount.textContent = count;
  }
}

function harvestTree() {
  const tree = state.trees.find(t => t.id === state.currentTreeId);
  if (!tree) return;

  // Double check all tasks are done
  const total = tree.tasks.length;
  const done = tree.tasks.filter(t => t.status === 'done').length;
  if (total === 0 || done !== total) {
    alert("すべてのタスクが完了するまで収穫できません！");
    return;
  }

  // Calculate reward coins: 100 per task, minimum 1000 coins
  const rewardCoins = Math.max(tree.tasks.length * 100, 1000);

  tree.harvested = true;
  tree.harvestedAt = Date.now();
  saveTrees();

  // Add coins and save to local storage
  state.coins += rewardCoins;
  localStorage.setItem('garden_focus_coins', state.coins);
  updateCoinCount();

  // Play rich success sound
  playSynthSound('harvest');

  // Show a sweet alert
  alert(`🎉 「${tree.name}」を収穫しました！\n🎁 収穫報酬として 【 ${rewardCoins.toLocaleString()} ICHIGO 🍓 】 を獲得しました！\n収穫した木は収穫カゴに保管されました。`);

  // Go back to garden
  renderGarden();
}

function openBasket() {
  renderBasketList();
  elements.basketModal.classList.remove('hidden');
}

function closeBasket() {
  elements.basketModal.classList.add('hidden');
}

function renderBasketList() {
  elements.basketList.innerHTML = '';
  const harvestedTrees = state.trees.filter(t => t.harvested);

  if (harvestedTrees.length === 0) {
    elements.basketList.innerHTML = `
      <div class="basket-empty-state">
        <p>まだ収穫された木はありません。<br>すべての課題を達成して収穫してみましょう！</p>
      </div>
    `;
    return;
  }

  // Sort by harvest date descending
  harvestedTrees.sort((a, b) => b.harvestedAt - a.harvestedAt);

  harvestedTrees.forEach(tree => {
    const item = document.createElement('div');
    item.className = 'basket-item';

    const dateStr = new Date(tree.harvestedAt).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    let treeIcon = '🌱';
    if (tree.type === 'apple') treeIcon = '🍎';
    if (tree.type === 'cherry') treeIcon = '🌸';
    if (tree.type === 'cactus') treeIcon = '🌵';

    item.innerHTML = `
      <div class="basket-item-info">
        <span class="basket-item-name">${tree.name}</span>
        <span class="basket-item-meta">収穫日: ${dateStr} | 完了タスク: ${tree.tasks.length}個</span>
      </div>
      <div class="basket-item-badge">${treeIcon}</div>
    `;

    elements.basketList.appendChild(item);
  });
}

// ----------------------------------------------------
// PARTY PARTICLES ANIMATION (v4)
// ----------------------------------------------------

function spawnParticles(x, y, treeType) {
  activeParticles = [];
  let petalColor = '#FFC0CB'; // Pink cherry blossom petals
  if (treeType === 'apple') {
    petalColor = '#8FBC8F'; // Pale organic green leaves
  } else if (treeType === 'cactus') {
    petalColor = '#FFD700'; // Gold sparkles
  }

  // Spawn 22 little particles
  for (let i = 0; i < 22; i++) {
    activeParticles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 3.5,
      vy: Math.random() * -2.5 - 0.8, // Pop slightly upwards first, then fall
      gravity: 0.08,
      alpha: 1.0,
      size: 4 + Math.random() * 5,
      rotation: Math.random() * Math.PI * 2,
      vRotation: (Math.random() - 0.5) * 0.08,
      color: petalColor
    });
  }

  if (particleAnimationId) cancelAnimationFrame(particleAnimationId);
  animateParticles();
}

function animateParticles() {
  const canvas = elements.treeCanvas;
  const ctx = canvas.getContext('2d');
  const tree = state.trees.find(t => t.id === state.currentTreeId);
  if (!tree) return;

  // Redraw the main tree to clear previous animation frame
  drawTree(canvas, tree.type, tree.tasks);

  let anyAlive = false;

  activeParticles.forEach(p => {
    // Apply gravity
    p.vy += p.gravity;
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.015; // Fade out slowly
    p.rotation += p.vRotation;

    if (p.alpha > 0) {
      anyAlive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      ctx.beginPath();
      // Draw organic petal-like shape
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }
  });

  if (anyAlive) {
    particleAnimationId = requestAnimationFrame(animateParticles);
  } else {
    particleAnimationId = null;
  }
}

// ----------------------------------------------------
// EVENT LISTENERS CONFIGURATION
// ----------------------------------------------------

elements.openSettingsBtn.addEventListener('click', openSettings);
elements.closeSettingsBtn.addEventListener('click', closeSettings);
elements.saveSettingsBtn.addEventListener('click', saveSettings);

elements.openBasketBtn.addEventListener('click', openBasket);
elements.closeBasketBtn.addEventListener('click', closeBasket);

elements.addTreeTrigger.addEventListener('click', openAddTreeModal);
elements.cancelAddTreeBtn.addEventListener('click', closeAddTreeModal);
elements.confirmAddTreeBtn.addEventListener('click', confirmAddTree);

elements.backToGardenBtn.addEventListener('click', () => {
  renderGarden();
});

elements.editTreeNameBtn.addEventListener('click', editTreeName);
elements.harvestTreeBtn.addEventListener('click', harvestTree);

// Selector options in Add Tree Modal
elements.optionCards.forEach(card => {
  card.addEventListener('click', selectTreeType);
});

// Add Task Bindings
elements.addTaskBtn.addEventListener('click', () => {
  // If task ends with [AI] token or key was hold, do AI, else normal
  // We can let the button trigger AI decomposition if Shift key was pressed,
  // or simply check if the user wants AI decomposition if they double click/held it.
  // To keep it simple and clean, if text contains "ai:" prefix or user clicks normal, we decide:
  const text = elements.taskInput.value.trim();
  if (text.startsWith('ai:') || text.startsWith('AI:')) {
    elements.taskInput.value = text.replace(/^(ai:|AI:)/, '').trim();
    tryAIDecomposeTask();
  } else {
    addTask();
  }
});

// Support Shift+Enter inside Task input to trigger AI decompose
elements.taskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      tryAIDecomposeTask();
    } else {
      addTask();
    }
  }
});

// Support Enter in Add Tree Modal input
elements.treeNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    confirmAddTree();
  }
});

// Initialize Garden view on load
renderGarden();
