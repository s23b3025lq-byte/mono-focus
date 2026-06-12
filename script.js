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
// CANVAS RENDERING ENGINE (FRACTAL TREE GRAPHICS)
// ----------------------------------------------------

// Deterministic random generation based on a seed value to prevent wiggling on re-renders
function seededRandom(seed) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

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

  // Sprout Leaf Left
  ctx.beginPath();
  ctx.ellipse(x - 5, y - 40, 8, 4, -Math.PI / 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#6B8E23';
  ctx.fill();

  // Sprout Leaf Right
  ctx.beginPath();
  ctx.ellipse(x + 10, y - 43, 7, 4, Math.PI / 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#6B8E23';
  ctx.fill();

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

// Main fractal tree rendering function
function drawTree(canvas, type, tasks) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  ctx.clearRect(0, 0, width, height);

  let seed = 12345; // Fixed seed for stable look

  // 0. DRAW BEAUTIFUL LUSH BACKDROP
  // Sky Gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#EAE2D5'); // Soft warm tea sky
  skyGrad.addColorStop(0.7, '#FAF6F0'); // Pure linen cream sky bottom
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // Soft Background Hills
  ctx.fillStyle = '#E8DFD0'; // Distant hill
  ctx.beginPath();
  ctx.arc(width * 0.25, height - 20, 180, Math.PI, 0, false);
  ctx.fill();

  ctx.fillStyle = '#E3D5CA'; // Mid hill
  ctx.beginPath();
  ctx.arc(width * 0.75, height - 10, 160, Math.PI, 0, false);
  ctx.fill();

  // Soil/Ground area
  const soilGrad = ctx.createLinearGradient(0, height - 60, 0, height);
  soilGrad.addColorStop(0, '#C6AC93'); // Warm earth soil line
  soilGrad.addColorStop(1, '#9C846C'); // Deep soil
  ctx.fillStyle = soilGrad;
  ctx.fillRect(0, height - 60, width, 60);

  // Tiny Grass & Flowers on the ground (lush decor)
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

  // Determine complexity based on tasks count (70% scaled thresholds)
  let maxDepth = 3; // sapling default
  let sizeFactor = 0;

  if (tasks.length === 1) {
    maxDepth = 3; // Sapling (深さ3)
    sizeFactor = 15;
  } else if (tasks.length === 2) {
    maxDepth = 4; // Small Tree (深さ4)
    sizeFactor = 30;
  } else if (tasks.length >= 3 && tasks.length <= 5) {
    maxDepth = 5; // Medium Tree (深さ5)
    sizeFactor = 50;
  } else if (tasks.length >= 6 && tasks.length <= 10) {
    maxDepth = 6; // Lush Tree (深さ6)
    sizeFactor = 70;
  } else {
    maxDepth = 7; // Grand Tree (11個以上, 深さ7)
    sizeFactor = 90;
  }

  const leafCoordinates = [];
  const innerBranchCoordinates = [];

  // Setup styles by type
  let branchColor = '#5C4033'; // Deep organic brown
  if (type === 'cherry') branchColor = '#4A3C31';
  if (type === 'cactus') branchColor = '#2E5A27'; // Cactus body color

  // Recursive branch generator (with 3-way splits for volume)
  function branch(x1, y1, angle, depth, currentLength, currentWidth) {
    const x2 = x1 + Math.cos(angle * Math.PI / 180) * currentLength;
    const y2 = y1 + Math.sin(angle * Math.PI / 180) * currentLength;

    // Render branch
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = branchColor;
    ctx.lineWidth = currentWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // If near leaf nodes (depth <= 1), save coordinates to multiply leaves density
    if (depth <= 1) {
      leafCoordinates.push({ x: x2, y: y2, angle: angle });
    }
    if (depth > 1 && depth <= 3) {
      innerBranchCoordinates.push({ x: x2, y: y2, angle: angle });
    }

    if (depth === 0) return;

    // Branch parameters w/ deterministic randomness
    const randAngleSpread = 22 + seededRandom(seed++) * 15;
    const lengthShrink = 0.72 + seededRandom(seed++) * 0.1;
    const widthShrink = 0.68 + seededRandom(seed++) * 0.05;

    // Left and Right branches
    branch(x2, y2, angle - randAngleSpread, depth - 1, currentLength * lengthShrink, currentWidth * widthShrink);
    branch(x2, y2, angle + randAngleSpread, depth - 1, currentLength * lengthShrink, currentWidth * widthShrink);

    // 38% chance to grow a third center/minor branch for a very lush volume
    if (depth > 1 && seededRandom(seed++) < 0.38) {
      const centerAngle = angle + (seededRandom(seed++) - 0.5) * 12;
      branch(x2, y2, centerAngle, depth - 1, currentLength * lengthShrink * 0.85, currentWidth * widthShrink * 0.8);
    }
  }

  // Start trunk variables
  const startX = width / 2;
  const startY = height - 60;
  const initialAngle = -90; // Upwards
  
  let initialLength = 90 + sizeFactor;
  let initialWidth = 4 + (maxDepth * 1.5);

  if (type === 'cactus') {
    initialLength = 95;
    initialWidth = 26;
  }

  // Draw wood structure
  branch(startX, startY, initialAngle, maxDepth, initialLength, initialWidth);

  // 1. Draw rich background foliage (leaves/petals/spikes) on ALL leaf coordinates to make the tree look lush
  leafCoordinates.forEach((coord, idx) => {
    const rSeed = seed + idx;
    
    ctx.save();
    ctx.translate(coord.x, coord.y);
    
    if (type === 'apple') {
      // Draw a dense cluster of 3-4 green leaves for thickness
      const leavesCount = 3 + Math.floor(seededRandom(rSeed) * 2); // 3 or 4 leaves
      const leafColorPalette = ['#556B2F', '#6B8E23', '#4A5D29']; // Mix of organic greens
      for (let i = 0; i < leavesCount; i++) {
        ctx.save();
        const leafAngle = ((i - (leavesCount - 1) / 2) * 22 + (seededRandom(rSeed + i) - 0.5) * 15) * Math.PI / 180;
        ctx.rotate(leafAngle);
        ctx.beginPath();
        ctx.ellipse(0, -5, 13, 7, 0, 0, 2 * Math.PI);
        ctx.fillStyle = leafColorPalette[Math.floor(seededRandom(rSeed + i * 2) * leafColorPalette.length)];
        ctx.fill();
        ctx.strokeStyle = '#3E4F22';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
    } else if (type === 'cherry') {
      // Draw a very rich cherry blossom petal cluster (fluffy blooming sakura)
      const flowersCount = 3 + Math.floor(seededRandom(rSeed) * 3); // 3 to 5 small petals
      for (let i = 0; i < flowersCount; i++) {
        ctx.save();
        const offsetDist = seededRandom(rSeed + i) * 8;
        const offsetAngle = seededRandom(rSeed + i * 2) * Math.PI * 2;
        ctx.translate(Math.cos(offsetAngle) * offsetDist, Math.sin(offsetAngle) * offsetDist);
        
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, 2 * Math.PI);
        ctx.fillStyle = seededRandom(rSeed + i) > 0.4 ? 'rgba(255, 192, 203, 0.85)' : 'rgba(255, 182, 193, 0.9)'; // Variation of pink
        ctx.fill();
        ctx.restore();
      }
    } else if (type === 'cactus') {
      // Spiky cactus needles cluster + little round side cactus bumps
      ctx.fillStyle = '#2E5A27'; // Dark green cactus stem bump
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1.3;
      const spikes = 4 + Math.floor(seededRandom(rSeed) * 3);
      for (let i = 0; i < spikes; i++) {
        const spikeAngle = ((i - (spikes - 1) / 2) * 22 + (seededRandom(rSeed + i) - 0.5) * 8) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(spikeAngle) * 11, -Math.cos(spikeAngle) * 11);
        ctx.stroke();
      }
    }
    ctx.restore();
  });

  // 1.5. Draw slightly smaller foliage on INNER branches to fill the center space (eliminate sparseness) (v4)
  innerBranchCoordinates.forEach((coord, idx) => {
    const rSeed = seed + idx * 3;
    if (seededRandom(rSeed) > 0.45) return;

    ctx.save();
    ctx.translate(coord.x, coord.y);

    if (type === 'apple') {
      ctx.save();
      const leafAngle = (seededRandom(rSeed) - 0.5) * 60 * Math.PI / 180;
      ctx.rotate(leafAngle);
      ctx.beginPath();
      ctx.ellipse(0, -3, 9, 5, 0, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(85, 107, 47, 0.75)';
      ctx.fill();
      ctx.restore();
    } else if (type === 'cherry') {
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 192, 203, 0.6)';
      ctx.fill();
    } else if (type === 'cactus') {
      ctx.fillStyle = 'rgba(46, 90, 39, 0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.restore();
  });

  // 2. Distribute tasks onto accumulated coordinates (drawn on top of background foliage)
  if (leafCoordinates.length > 0) {
    // Map tasks to endpoints
    const step = Math.floor(leafCoordinates.length / tasks.length) || 1;
    
    tasks.forEach((task, idx) => {
      // Pick coordinate from array
      const coordIdx = Math.min((idx * step) % leafCoordinates.length, leafCoordinates.length - 1);
      const coord = leafCoordinates[coordIdx];
      
      if (coord) {
        drawLeafOrnament(ctx, coord.x, coord.y, type, task.status);
      }
    });
  }

  // Save computed leaf coordinates to find spawn points for done animation
  lastTreeCoordinates = leafCoordinates;
}

// Draw leaf, bud, or flower/fruit depending on status
function drawLeafOrnament(ctx, x, y, type, status) {
  if (status === 'todo') {
    // 1. TODO: Green leaf
    ctx.beginPath();
    ctx.ellipse(x, y, 10, 5, Math.PI / 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#6B8E23'; // Olive-ish green
    ctx.fill();
    ctx.strokeStyle = '#556B2F';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Leaf vein line
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 5);
    ctx.lineTo(x + 5, y + 5);
    ctx.strokeStyle = '#556B2F';
    ctx.stroke();
  } 
  
  else if (status === 'doing') {
    // 2. DOING: Colored Bud
    let budColor = '#FEF3C7'; // Yellow bud default
    let strokeColor = '#D97706';
    if (type === 'cherry') {
      budColor = '#FFC0CB'; // Pink cherry bud
      strokeColor = '#FF69B4';
    } else if (type === 'cactus') {
      budColor = '#FDE047'; // Bright yellow cactus bud
      strokeColor = '#CA8A04';
    }

    ctx.beginPath();
    // Drop shaped bud
    ctx.moveTo(x, y - 8);
    ctx.bezierCurveTo(x + 5, y - 8, x + 6, y, x, y + 4);
    ctx.bezierCurveTo(x - 6, y, x - 5, y - 8, x, y - 8);
    ctx.fillStyle = budColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } 
  
  else if (status === 'done') {
    // 3. DONE: Bloom / Fruit (Twin / Multi-layered for high achievement)
    if (type === 'apple') {
      // Draw Twin Apples (small and delicate, hanging side-by-side)
      ctx.save();
      // Left Apple
      ctx.beginPath();
      ctx.arc(x - 5, y + 4, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF3B30'; // Apple red
      ctx.fill();
      
      // Right Apple
      ctx.beginPath();
      ctx.arc(x + 5, y + 4, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#FF453A'; // Slightly lighter red
      ctx.fill();

      // Stem of apples (Y-shaped)
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x - 5, y + 4);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 5, y + 4);
      ctx.strokeStyle = '#5C4033';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tiny green leaf
      ctx.beginPath();
      ctx.ellipse(x + 3, y - 4, 3, 1.5, Math.PI / 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#556B2F';
      ctx.fill();
      ctx.restore();
    } 
    
    else if (type === 'cherry') {
      // Draw Twin Cherries (fruit instead of flower for better completion impact)
      ctx.save();
      // Left Cherry
      ctx.beginPath();
      ctx.arc(x - 6, y + 6, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#D90429'; // Deep cherry red
      ctx.fill();
      // Shine
      ctx.beginPath();
      ctx.arc(x - 4, y + 4, 1.2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Right Cherry
      ctx.beginPath();
      ctx.arc(x + 6, y + 6, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#EF233C'; // Bright cherry red
      ctx.fill();
      // Shine
      ctx.beginPath();
      ctx.arc(x + 8, y + 4, 1.2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      // Green Y-shaped Stem
      ctx.beginPath();
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x - 6, y + 6);
      ctx.moveTo(x, y - 2);
      ctx.lineTo(x + 6, y + 6);
      ctx.strokeStyle = '#2D6A4F';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();
    } 
    
    else if (type === 'cactus') {
      // Draw Multi-layered spiky golden flower next to a purple fruit
      ctx.save();
      // Draw small purple fruit base first
      ctx.beginPath();
      ctx.arc(x - 4, y + 4, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#7209B7'; // Rich purple
      ctx.fill();

      // Draw Flower base offset
      const fx = x + 3;
      const fy = y - 2;

      // Layer 1: Outer Orange Spikes
      ctx.strokeStyle = '#FF8C00';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(angle) * 11, fy + Math.sin(angle) * 11);
        ctx.stroke();
      }

      // Layer 2: Inner Yellow Spikes
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(angle) * 7, fy + Math.sin(angle) * 7);
        ctx.stroke();
      }

      // Center White Dot
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }
  }
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
