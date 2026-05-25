// MONO-FOCUS State & Logic

const state = {
  tasks: [], // Array of { id: string, text: string, status: 'pending' | 'completed' | 'skipped' }
  appState: 'DUMP', // 'DUMP' | 'FOCUS' | 'SUMMARY'
  currentTaskIndex: 0,
  timerSeconds: 1500, // 25 minutes in seconds
  isTimerActive: false,
  timerInterval: null
};

// DOM Elements
const elements = {
  screenDump: document.getElementById('screen-dump'),
  screenFocus: document.getElementById('screen-focus'),
  screenSummary: document.getElementById('screen-summary'),
  
  // Dump Screen
  dumpInput: document.getElementById('dump-input'),
  startFocusContainer: document.getElementById('start-focus-container'),
  startFocusBtn: document.getElementById('start-focus-btn'),
  stackedCount: document.getElementById('stacked-count'),
  emptyStackIndicator: document.getElementById('empty-stack-indicator'),
  
  // Focus Screen
  backToDumpBtn: document.getElementById('back-to-dump-btn'),
  activeTaskText: document.getElementById('active-task-text'),
  activeTaskWrapper: document.getElementById('active-task-wrapper'),
  timerBtn: document.getElementById('timer-btn'),
  timerStatus: document.getElementById('timer-status'),
  resetTimerBtn: document.getElementById('reset-timer-btn'),
  queueCount: document.getElementById('queue-count'),
  queuePlural: document.getElementById('queue-plural'),
  skipTaskBtn: document.getElementById('skip-task-btn'),
  completeTaskBtn: document.getElementById('complete-task-btn'),
  
  // Summary Screen
  summaryCompletedCount: document.getElementById('summary-completed-count'),
  summaryCompletedList: document.getElementById('summary-completed-list'),
  summarySkippedCount: document.getElementById('summary-skipped-count'),
  summarySkippedList: document.getElementById('summary-skipped-list'),
  restartSessionBtn: document.getElementById('restart-session-btn')
};

// Play audio beep when timer finishes
function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch A5
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15); // short 150ms beep
  } catch (e) {
    console.error("Synthesizer playback blocked/failed", e);
  }
}

// Timer tick handler
function startTimerInterval() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  state.timerInterval = setInterval(() => {
    if (state.timerSeconds > 0) {
      state.timerSeconds--;
      updateTimerDisplay();
    } else {
      stopTimerInterval();
      state.isTimerActive = false;
      elements.timerStatus.textContent = "PAUSED";
      playBeep();
    }
  }, 1000);
}

function stopTimerInterval() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const mins = Math.floor(state.timerSeconds / 60);
  const secs = state.timerSeconds % 60;
  const timeString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  elements.timerBtn.textContent = timeString;
}

// Render screens according to state
function render() {
  // Hide all screens first
  elements.screenDump.classList.add('hidden');
  elements.screenFocus.classList.add('hidden');
  elements.screenSummary.classList.add('hidden');
  
  const pendingTasks = state.tasks.filter(t => t.status === 'pending');
  
  if (state.appState === 'DUMP') {
    elements.screenDump.classList.remove('hidden');
    elements.stackedCount.textContent = pendingTasks.length;
    
    if (pendingTasks.length > 0) {
      elements.startFocusContainer.classList.remove('hidden');
      elements.emptyStackIndicator.classList.add('hidden');
    } else {
      elements.startFocusContainer.classList.add('hidden');
      elements.emptyStackIndicator.classList.remove('hidden');
    }
    elements.dumpInput.focus();
  }
  
  else if (state.appState === 'FOCUS') {
    elements.screenFocus.classList.remove('hidden');
    
    const activeTask = state.tasks[state.currentTaskIndex];
    if (activeTask) {
      elements.activeTaskText.textContent = activeTask.text;
      
      // Trigger CSS reflow to restart entry animation
      elements.activeTaskWrapper.classList.remove('animate-swiss-fade');
      void elements.activeTaskWrapper.offsetWidth;
      elements.activeTaskWrapper.classList.add('animate-swiss-fade');
    }
    
    elements.queueCount.textContent = pendingTasks.length;
    elements.queuePlural.textContent = pendingTasks.length === 1 ? '' : 's';
    
    updateTimerDisplay();
    elements.timerStatus.textContent = state.isTimerActive ? "RUNNING" : "PAUSED";
  }
  
  else if (state.appState === 'SUMMARY') {
    elements.screenSummary.classList.remove('hidden');
    
    const completedTasks = state.tasks.filter(t => t.status === 'completed');
    const skippedTasks = state.tasks.filter(t => t.status === 'skipped');
    
    elements.summaryCompletedCount.textContent = completedTasks.length.toString().padStart(2, '0');
    elements.summarySkippedCount.textContent = skippedTasks.length.toString().padStart(2, '0');
    
    // Clear list areas
    elements.summaryCompletedList.innerHTML = '';
    elements.summarySkippedList.innerHTML = '';
    
    // Populate Completed list
    if (completedTasks.length > 0) {
      completedTasks.forEach((t, idx) => {
        const item = document.createElement('p');
        item.className = "text-lg md:text-xl font-bold uppercase tracking-tight text-neutral-800";
        item.innerHTML = `<span class="list-number font-light">${(idx + 1).toString().padStart(2, '0')}</span>${t.text}`;
        elements.summaryCompletedList.appendChild(item);
      });
    }
    
    // Populate Skipped list
    if (skippedTasks.length > 0) {
      skippedTasks.forEach((t, idx) => {
        const item = document.createElement('p');
        item.className = "text-lg md:text-xl font-medium uppercase tracking-tight text-neutral-400 line-through";
        item.innerHTML = `<span class="list-number font-light text-neutral-200">${(idx + 1).toString().padStart(2, '0')}</span>${t.text}`;
        elements.summarySkippedList.appendChild(item);
      });
    }
  }
}

// Logic Actions
function addTask(text) {
  if (text.trim() === '') return;
  state.tasks.push({
    id: `${Date.now()}-${Math.random()}`,
    text: text.trim().toUpperCase(),
    status: 'pending'
  });
  render();
}

function startFocus() {
  const firstPendingIdx = state.tasks.findIndex(t => t.status === 'pending');
  if (firstPendingIdx !== -1) {
    state.currentTaskIndex = firstPendingIdx;
    state.appState = 'FOCUS';
    state.timerSeconds = 1500;
    state.isTimerActive = false;
    stopTimerInterval();
    render();
  }
}

function moveToNextTask() {
  const nextPendingIdx = state.tasks.findIndex(t => t.status === 'pending');
  if (nextPendingIdx !== -1) {
    state.currentTaskIndex = nextPendingIdx;
    state.timerSeconds = 1500;
    state.isTimerActive = false;
    stopTimerInterval();
    render();
  } else {
    state.appState = 'SUMMARY';
    state.isTimerActive = false;
    stopTimerInterval();
    render();
  }
}

function completeTask() {
  if (state.tasks[state.currentTaskIndex]) {
    state.tasks[state.currentTaskIndex].status = 'completed';
    moveToNextTask();
  }
}

function skipTask() {
  if (state.tasks[state.currentTaskIndex]) {
    state.tasks[state.currentTaskIndex].status = 'skipped';
    moveToNextTask();
  }
}

function toggleTimer() {
  state.isTimerActive = !state.isTimerActive;
  if (state.isTimerActive) {
    startTimerInterval();
    elements.timerStatus.textContent = "RUNNING";
  } else {
    stopTimerInterval();
    elements.timerStatus.textContent = "PAUSED";
  }
}

function resetTimer() {
  stopTimerInterval();
  state.isTimerActive = false;
  state.timerSeconds = 1500;
  updateTimerDisplay();
  elements.timerStatus.textContent = "PAUSED";
}

function restartSession() {
  state.tasks = [];
  state.appState = 'DUMP';
  state.currentTaskIndex = 0;
  state.timerSeconds = 1500;
  state.isTimerActive = false;
  stopTimerInterval();
  render();
}

// Event Listeners Configuration
elements.dumpInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (elements.dumpInput.value.trim() !== '') {
      addTask(elements.dumpInput.value);
      elements.dumpInput.value = '';
    }
  } else if (e.key === 'Enter' && e.shiftKey) {
    e.preventDefault();
    if (elements.dumpInput.value.trim() !== '') {
      addTask(elements.dumpInput.value);
      elements.dumpInput.value = '';
    }
    const pendingTasks = state.tasks.filter(t => t.status === 'pending');
    if (pendingTasks.length > 0) {
      startFocus();
    }
  }
});

elements.startFocusBtn.addEventListener('click', startFocus);

elements.backToDumpBtn.addEventListener('click', () => {
  state.appState = 'DUMP';
  render();
});

elements.timerBtn.addEventListener('click', toggleTimer);
elements.resetTimerBtn.addEventListener('click', resetTimer);

elements.completeTaskBtn.addEventListener('click', completeTask);
elements.skipTaskBtn.addEventListener('click', skipTask);

elements.restartSessionBtn.addEventListener('click', restartSession);

// Global window keybinds (Space to play/pause in focus screen)
window.addEventListener('keydown', (e) => {
  if (state.appState === 'FOCUS') {
    // Prevent spacebar from scrolling page when focused on task screen
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'BUTTON') {
      e.preventDefault();
      toggleTimer();
    }
  }
});

// Initialize on page load
render();
