// MONO-FOCUS v2 State & Logic

const state = {
  tasks: [], // Array of { id: string, text: string, status: 'pending' | 'completed' | 'skipped' }
  appState: 'DUMP', // 'DUMP' | 'FOCUS' | 'SUMMARY'
  currentTaskIndex: 0,
  timerSeconds: 1500, // 25 minutes in seconds
  isTimerActive: false,
  timerInterval: null,

  // v2 States
  isMicroStep: false, // Is currently running the 2-min start phase
  warpCount: 0, // Number of times user strayed from focus
  isInWarp: false, // Is user currently tabbed away or out of focus
  warpStartTime: null,
  totalWarpDuration: 0, // Cumulative time wasted (seconds)
  totalFocusDuration: 0, // Cumulative actual work time (seconds)
  autoResumeTimer: 15, // Countdown before auto resuming pause
  autoResumeInterval: null
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
  queueCount: document.getElementById('queue-count'),
  queuePlural: document.getElementById('queue-plural'),
  skipTaskBtn: document.getElementById('skip-task-btn'),
  completeTaskBtn: document.getElementById('complete-task-btn'),
  
  // Summary Screen
  summaryCompletedCount: document.getElementById('summary-completed-count'),
  summaryCompletedList: document.getElementById('summary-completed-list'),
  summarySkippedCount: document.getElementById('summary-skipped-count'),
  summarySkippedList: document.getElementById('summary-skipped-list'),
  restartSessionBtn: document.getElementById('restart-session-btn'),

  // v2 UI Elements
  launcherOverlay: document.getElementById('launcher-overlay'),
  launcherTaskText: document.getElementById('launcher-task-text'),
  launchMicroBtn: document.getElementById('launch-micro-btn'),
  launchFullBtn: document.getElementById('launch-full-btn'),
  activeMicroBadge: document.getElementById('active-micro-badge'),
  warpCounterTag: document.getElementById('warp-counter-tag'),
  warpCountVal: document.getElementById('warp-count-val'),
  warpOverlay: document.getElementById('warp-overlay'),

  // Summary Metrics Elements
  statEfficiency: document.getElementById('stat-efficiency'),
  statWarps: document.getElementById('stat-warps'),
  statCompleted: document.getElementById('stat-completed'),
  statTime: document.getElementById('stat-time')
};

// Synth Audio Engine (v2 expanded)
function playSynthSound(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    if (type === 'success') {
      // Pleasant melodic chime (C5 -> E5 -> G5)
      const notes = [
        { freq: 523.25, offset: 0 },    // C5
        { freq: 659.25, offset: 0.1 },  // E5
        { freq: 783.99, offset: 0.2 }   // G5
      ];
      notes.forEach(note => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, now + note.offset);
        gainNode.gain.setValueAtTime(0.04, now + note.offset);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.offset + 0.4);
        osc.start(now + note.offset);
        osc.stop(now + note.offset + 0.45);
      });
    } 
    else if (type === 'alert') {
      // Dissonant alarming sawtooth sweep (low pitch warning)
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.type = "sawtooth";
      osc2.type = "sawtooth";
      osc1.frequency.setValueAtTime(110, now);
      osc2.frequency.setValueAtTime(114, now); // Detuned for dissonance

      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.55);
      osc2.stop(now + 0.55);
    } 
    else if (type === 'nudge') {
      // Simple high click/tick sound
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, now);
      gainNode.gain.setValueAtTime(0.03, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.08);
    } 
    else if (type === 'resume') {
      // Upward sliding sound
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.25); // Sweep to D5
      gainNode.gain.setValueAtTime(0.04, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.28);
    } 
    else {
      // Default short A5 beep
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      gainNode.gain.setValueAtTime(0.04, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (e) {
    console.error("Synthesizer playback blocked/failed", e);
  }
}

// Visibility Shield Management (v2)
function initVisibilityShield() {
  const triggerWarp = () => {
    if (state.appState !== 'FOCUS' || !state.isTimerActive || state.isInWarp) return;
    
    state.isInWarp = true;
    state.warpCount++;
    state.warpStartTime = Date.now();

    // Show warnings
    elements.warpOverlay.classList.remove('hidden');
    elements.warpCounterTag.classList.remove('hidden');
    elements.warpCountVal.textContent = state.warpCount;

    // Pause timer progress during warp but keep active state
    stopTimerInterval();
    stopAutoResumeCountdown(); // Clear nudges while user is tabbed away
    playSynthSound('alert');
  };

  const resolveWarp = () => {
    if (state.appState !== 'FOCUS' || !state.isInWarp) return;
    
    state.isInWarp = false;
    if (state.warpStartTime) {
      state.totalWarpDuration += Math.floor((Date.now() - state.warpStartTime) / 1000);
    }

    elements.warpOverlay.classList.add('hidden');
    
    // Auto-resume timer
    if (state.isTimerActive) {
      startTimerInterval();
    }
  };

  // Listeners
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      triggerWarp();
    } else {
      resolveWarp();
    }
  });

  window.addEventListener('blur', triggerWarp);
  window.addEventListener('focus', resolveWarp);
}

// Timer Tick Engine
function startTimerInterval() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  
  state.timerInterval = setInterval(() => {
    if (state.timerSeconds > 0) {
      state.timerSeconds--;
      state.totalFocusDuration++;
      updateTimerDisplay();
    } else {
      stopTimerInterval();
      state.isTimerActive = false;
      elements.timerStatus.textContent = "PAUSED";
      
      if (state.isMicroStep) {
        // Micro-step completes -> Trigger full 25-min session
        state.isMicroStep = false;
        state.timerSeconds = 1500; // 25 min
        state.isTimerActive = true;
        
        elements.activeMicroBadge.classList.add('hidden');
        playSynthSound('success');
        updateTimerDisplay();
        startTimerInterval();
      } else {
        playSynthSound('success');
        completeTask();
      }
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

// Pause Nudge Countdown (v2)
function startAutoResumeCountdown() {
  stopAutoResumeCountdown();
  if (state.isInWarp || !state.isTimerActive) return;

  state.autoResumeTimer = 15;
  document.body.classList.add('animate-pulse-bg');
  elements.timerStatus.textContent = `PAUSED (AUTO-RESUME IN ${state.autoResumeTimer}S)`;

  state.autoResumeInterval = setInterval(() => {
    if (state.autoResumeTimer > 1) {
      state.autoResumeTimer--;
      elements.timerStatus.textContent = `PAUSED (AUTO-RESUME IN ${state.autoResumeTimer}S)`;
      if (state.autoResumeTimer <= 5) {
        playSynthSound('nudge');
      }
    } else {
      // Resume automatically
      stopAutoResumeCountdown();
      playSynthSound('resume');
      state.isTimerActive = true;
      startTimerInterval();
      elements.timerStatus.textContent = "RUNNING";
    }
  }, 1000);
}

function stopAutoResumeCountdown() {
  if (state.autoResumeInterval) {
    clearInterval(state.autoResumeInterval);
    state.autoResumeInterval = null;
  }
  document.body.classList.remove('animate-pulse-bg');
  if (state.appState === 'FOCUS') {
    elements.timerStatus.textContent = state.isTimerActive ? "RUNNING" : "PAUSED";
  }
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

    // Render stats metrics
    // Focus Efficiency Calculation: penalty for warps and duration in warp
    const warpPenalty = state.warpCount * 10;
    const durationPenalty = Math.floor(state.totalWarpDuration / 12); // -1% every 12s tabbed out
    const efficiency = Math.max(0, 100 - warpPenalty - durationPenalty);

    elements.statEfficiency.textContent = `${efficiency}%`;
    elements.statWarps.textContent = state.warpCount.toString().padStart(2, '0');
    elements.statCompleted.textContent = completedTasks.length.toString().padStart(2, '0');

    // Total focus duration formatting (MM:SS)
    const statMins = Math.floor(state.totalFocusDuration / 60);
    const statSecs = state.totalFocusDuration % 60;
    elements.statTime.textContent = `${statMins.toString().padStart(2, '0')}:${statSecs.toString().padStart(2, '0')}`;
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
    
    // Stop any active counts
    stopTimerInterval();
    stopAutoResumeCountdown();
    
    // Reset timer state for new task selection
    state.timerSeconds = 1500;
    state.isTimerActive = false;
    state.isMicroStep = false;
    
    render();
    
    // Show Action Launcher Overlay to prompt user
    elements.launcherTaskText.textContent = state.tasks[state.currentTaskIndex].text;
    elements.launcherOverlay.classList.remove('hidden');
  }
}

function selectLaunchOption(mode) {
  elements.launcherOverlay.classList.add('hidden');
  
  if (mode === 'micro') {
    state.isMicroStep = true;
    state.timerSeconds = 120; // 2 minutes (120s)
    elements.activeMicroBadge.classList.remove('hidden');
  } else {
    state.isMicroStep = false;
    state.timerSeconds = 1500; // 25 minutes
    elements.activeMicroBadge.classList.add('hidden');
  }
  
  state.isTimerActive = true;
  startTimerInterval();
  playSynthSound('resume');
  render();
}

function moveToNextTask() {
  const nextPendingIdx = state.tasks.findIndex(t => t.status === 'pending');
  if (nextPendingIdx !== -1) {
    state.currentTaskIndex = nextPendingIdx;
    state.timerSeconds = 1500;
    state.isTimerActive = false;
    state.isMicroStep = false;
    elements.activeMicroBadge.classList.add('hidden');
    stopTimerInterval();
    stopAutoResumeCountdown();
    render();

    // Prompt launcher for next task
    elements.launcherTaskText.textContent = state.tasks[state.currentTaskIndex].text;
    elements.launcherOverlay.classList.remove('hidden');
  } else {
    state.appState = 'SUMMARY';
    state.isTimerActive = false;
    stopTimerInterval();
    stopAutoResumeCountdown();
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
  if (state.isInWarp) return; // Disallow toggling when tabbed away

  state.isTimerActive = !state.isTimerActive;
  if (state.isTimerActive) {
    stopAutoResumeCountdown();
    startTimerInterval();
    elements.timerStatus.textContent = "RUNNING";
  } else {
    stopTimerInterval();
    elements.timerStatus.textContent = "PAUSED";
    // Trigger v2 Pause auto-resume count
    startAutoResumeCountdown();
  }
}

function resetTimer() {
  stopTimerInterval();
  stopAutoResumeCountdown();
  state.isTimerActive = false;
  state.timerSeconds = state.isMicroStep ? 120 : 1500;
  updateTimerDisplay();
  elements.timerStatus.textContent = "PAUSED";
}

function restartSession() {
  state.tasks = [];
  state.appState = 'DUMP';
  state.currentTaskIndex = 0;
  state.timerSeconds = 1500;
  state.isTimerActive = false;
  state.isMicroStep = false;
  state.warpCount = 0;
  state.isInWarp = false;
  state.totalWarpDuration = 0;
  state.totalFocusDuration = 0;
  
  elements.activeMicroBadge.classList.add('hidden');
  elements.warpCounterTag.classList.add('hidden');
  elements.warpCountVal.textContent = "0";

  stopTimerInterval();
  stopAutoResumeCountdown();
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
  stopTimerInterval();
  stopAutoResumeCountdown();
  state.appState = 'DUMP';
  render();
});

elements.timerBtn.addEventListener('click', toggleTimer);
elements.resetTimerBtn.addEventListener('click', resetTimer);

elements.completeTaskBtn.addEventListener('click', completeTask);
elements.skipTaskBtn.addEventListener('click', skipTask);

elements.restartSessionBtn.addEventListener('click', restartSession);

// V2 Launcher Button handlers
elements.launchMicroBtn.addEventListener('click', () => selectLaunchOption('micro'));
elements.launchFullBtn.addEventListener('click', () => selectLaunchOption('full'));

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
initVisibilityShield();
render();
