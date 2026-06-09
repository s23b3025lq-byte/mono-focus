// MONO-FOCUS v3 State & Logic

const state = {
  tasks: [], // Array of { id: string, text: string, status: 'pending' | 'completed' | 'skipped' }
  appState: 'DUMP', // 'DUMP' | 'FOCUS' | 'SUMMARY'
  currentTaskIndex: 0,
  timerSeconds: 1500, // Default 25 minutes in seconds
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
  autoResumeInterval: null,

  // v3 States
  geminiApiKey: localStorage.getItem('gemini_api_key') || '',
  focusHistory: JSON.parse(localStorage.getItem('mono_focus_history')) || [],
  bestSession: JSON.parse(localStorage.getItem('mono_focus_best_session')) || null, // { duration: 1500, warpCount: 0 }
  ghostSecondsPassed: 0,
  sessionStartSeconds: 1500 // Holds initial seconds of current task (120 or 1500)
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
  statTime: document.getElementById('stat-time'),

  // v3 UI Elements
  openSettingsBtn: document.getElementById('open-settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  apiKeyInput: document.getElementById('api-key-input'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  aiDecomposeBtn: document.getElementById('ai-decompose-btn'),
  aiLoading: document.getElementById('ai-loading'),
  grassGrid: document.getElementById('grass-grid'),
  userProgress: document.getElementById('user-progress'),
  ghostProgress: document.getElementById('ghost-progress')
};

// Synth Audio Engine
function playSynthSound(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;

    if (type === 'success') {
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
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      osc1.type = "sawtooth";
      osc2.type = "sawtooth";
      osc1.frequency.setValueAtTime(110, now);
      osc2.frequency.setValueAtTime(114, now);

      gainNode.gain.setValueAtTime(0.08, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.55);
      osc2.stop(now + 0.55);
    } 
    else if (type === 'nudge') {
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
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.25);
      gainNode.gain.setValueAtTime(0.04, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.28);
    } 
    else {
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

// Visibility Shield Management
function initVisibilityShield() {
  const triggerWarp = () => {
    if (state.appState !== 'FOCUS' || !state.isTimerActive || state.isInWarp) return;
    
    state.isInWarp = true;
    state.warpCount++;
    state.warpStartTime = Date.now();

    elements.warpOverlay.classList.remove('hidden');
    elements.warpCounterTag.classList.remove('hidden');
    elements.warpCountVal.textContent = state.warpCount;

    stopTimerInterval();
    stopAutoResumeCountdown();
    playSynthSound('alert');
  };

  const resolveWarp = () => {
    if (state.appState !== 'FOCUS' || !state.isInWarp) return;
    
    state.isInWarp = false;
    if (state.warpStartTime) {
      state.totalWarpDuration += Math.floor((Date.now() - state.warpStartTime) / 1000);
    }

    elements.warpOverlay.classList.add('hidden');
    
    if (state.isTimerActive) {
      startTimerInterval();
    }
  };

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
      
      // Update User Progress Bar
      const userPassed = state.sessionStartSeconds - state.timerSeconds;
      const userPercent = (userPassed / state.sessionStartSeconds) * 100;
      elements.userProgress.style.width = `${userPercent}%`;

      // Update Ghost Progress Bar (v3)
      state.ghostSecondsPassed++;
      // Determine ghost duration: past best session duration OR ideal (sessionStartSeconds)
      const ghostDuration = state.bestSession ? state.bestSession.duration : state.sessionStartSeconds;
      const ghostPercent = Math.min(100, (state.ghostSecondsPassed / ghostDuration) * 100);
      elements.ghostProgress.style.width = `${ghostPercent}%`;

      updateTimerDisplay();
    } else {
      stopTimerInterval();
      state.isTimerActive = false;
      elements.timerStatus.textContent = "PAUSED";
      
      if (state.isMicroStep) {
        // Micro-step completes -> Trigger full 25-min session
        state.isMicroStep = false;
        state.timerSeconds = 1500; // 25 min
        state.sessionStartSeconds = 1500;
        state.isTimerActive = true;
        
        elements.activeMicroBadge.classList.add('hidden');
        playSynthSound('success');
        updateTimerDisplay();
        elements.userProgress.style.width = "0%";
        elements.ghostProgress.style.width = "0%";
        state.ghostSecondsPassed = 0;
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

// Pause Nudge Countdown
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

// AI Task Decomposer logic (v3)
async function aiDecomposeTask() {
  const taskText = elements.dumpInput.value.trim();
  if (!taskText) return;

  elements.aiDecomposeBtn.classList.add('hidden');
  elements.aiLoading.classList.remove('hidden');

  const processDecomposedTasks = (subtasks) => {
    subtasks.forEach(text => {
      state.tasks.push({
        id: `${Date.now()}-${Math.random()}`,
        text: text.trim().toUpperCase(),
        status: 'pending'
      });
    });
    render();
    elements.dumpInput.value = '';
  };

  // 1. Try Actual Gemini API if API key is configured
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
              text: `You are MONO-FOCUS, a minimalist productivity assistant. Analyze the task: "${taskText}". Decompose it into exactly 3 tiny, concrete, and actionable micro-steps that take less than 2 minutes each. Output only a JSON array of 3 strings. Example: ["Open document program", "Write outline title", "Draft first sentence"]. Do not output markdown code blocks. Just output raw JSON.`
            }]
          }]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text.trim();
        // Clean markdown blocks if Gemini returned it anyway
        const jsonText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonText);
        if (Array.isArray(parsed) && parsed.length === 3) {
          processDecomposedTasks(parsed);
          finishAILoading();
          return;
        }
      }
      console.warn("Gemini API call succeeded but failed to parse correctly. Falling back to offline engine.");
    } catch (e) {
      console.error("Gemini API request failed. Falling back to offline engine.", e);
    }
  }

  // 2. Offline Fallback Decomposition Engine (v3 Rule-based)
  setTimeout(() => {
    const textLower = taskText.toLowerCase();
    let subtasks = [];

    if (textLower.includes('書') || textLower.includes('write') || textLower.includes('レポート') || textLower.includes('report') || textLower.includes('執筆')) {
      subtasks = [
        `ファイルまたはエディタを立ち上げる`,
        `構成の目次/見出しを1つ書く`,
        `導入文の最初の1文目を書き始める`
      ];
    } else if (textLower.includes('読') || textLower.includes('read') || textLower.includes('本') || textLower.includes('勉強') || textLower.includes('学習')) {
      subtasks = [
        `本や資料を開き、目次を眺める`,
        `最初の1ページだけ読み始める`,
        `気になったキーワードを1つメモする`
      ];
    } else if (textLower.includes('スライド') || textLower.includes('資料') || textLower.includes('作成') || textLower.includes('slide') || textLower.includes('ppt')) {
      subtasks = [
        `スライド作成ツールを起動する`,
        `表紙スライドのタイトルを入力する`,
        `1枚目の構成構成案を下書きする`
      ];
    } else if (textLower.includes('片') || textLower.includes('掃除') || textLower.includes('clean') || textLower.includes('整理')) {
      subtasks = [
        `目の前のゴミを1つだけ捨てる`,
        `机の上の書類を1箇所に整頓する`,
        `使っていない文房具を引き出しにしまう`
      ];
    } else {
      // Catch-all generic decomposition
      subtasks = [
        `「${taskText}」のためのツール・道具を準備する`,
        `最初の2分間だけ手を動かす`,
        `次の明確なステップを整理する`
      ];
    }

    processDecomposedTasks(subtasks);
    finishAILoading();
  }, 1000); // Smooth loading effect
}

function finishAILoading() {
  elements.aiLoading.classList.add('hidden');
  elements.aiDecomposeBtn.classList.remove('hidden');
}

// Render Focus Grass Calendar (v3)
function renderGrassCalendar() {
  elements.grassGrid.innerHTML = '';
  const today = new Date();
  
  // Create 30 days history array
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Find history record for this date
    const record = state.focusHistory.find(h => h.date === dateStr);
    
    const cell = document.createElement('div');
    cell.className = 'grass-cell';
    
    let completed = 0;
    let efficiency = 0;

    if (record) {
      completed = record.completedCount || 0;
      efficiency = record.efficiency || 0;
      
      // Determine grass level (color intensity)
      let level = 0;
      if (completed > 0) {
        if (efficiency >= 90) level = 4;
        else if (efficiency >= 70) level = 3;
        else if (efficiency >= 40) level = 2;
        else level = 1;
      }
      
      if (level > 0) {
        cell.classList.add(`grass-level-${level}`);
      }
    }

    // Date label for display
    const labelDate = `${d.getMonth() + 1}/${d.getDate()}`;
    cell.setAttribute('data-tooltip', `${labelDate} : ${completed} COMPLETED / ${efficiency}% EFFICIENCY`);
    elements.grassGrid.appendChild(cell);
  }
}

// Render screens according to state
function render() {
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
    
    renderGrassCalendar();
    elements.dumpInput.focus();
  }
  
  else if (state.appState === 'FOCUS') {
    elements.screenFocus.classList.remove('hidden');
    
    const activeTask = state.tasks[state.currentTaskIndex];
    if (activeTask) {
      elements.activeTaskText.textContent = activeTask.text;
      
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
    
    elements.summaryCompletedList.innerHTML = '';
    elements.summarySkippedList.innerHTML = '';
    
    if (completedTasks.length > 0) {
      completedTasks.forEach((t, idx) => {
        const item = document.createElement('p');
        item.className = "text-lg md:text-xl font-bold uppercase tracking-tight text-neutral-800";
        item.innerHTML = `<span class="list-number font-light">${(idx + 1).toString().padStart(2, '0')}</span>${t.text}`;
        elements.summaryCompletedList.appendChild(item);
      });
    }
    
    if (skippedTasks.length > 0) {
      skippedTasks.forEach((t, idx) => {
        const item = document.createElement('p');
        item.className = "text-lg md:text-xl font-medium uppercase tracking-tight text-neutral-400 line-through";
        item.innerHTML = `<span class="list-number font-light text-neutral-200">${(idx + 1).toString().padStart(2, '0')}</span>${t.text}`;
        elements.summarySkippedList.appendChild(item);
      });
    }

    // Calculate metrics
    const warpPenalty = state.warpCount * 10;
    const durationPenalty = Math.floor(state.totalWarpDuration / 12);
    const efficiency = Math.max(0, 100 - warpPenalty - durationPenalty);

    elements.statEfficiency.textContent = `${efficiency}%`;
    elements.statWarps.textContent = state.warpCount.toString().padStart(2, '0');
    elements.statCompleted.textContent = completedTasks.length.toString().padStart(2, '0');

    const statMins = Math.floor(state.totalFocusDuration / 60);
    const statSecs = state.totalFocusDuration % 60;
    elements.statTime.textContent = `${statMins.toString().padStart(2, '0')}:${statSecs.toString().padStart(2, '0')}`;

    // v3: Save session history to database
    saveSessionToHistory(completedTasks.length, efficiency);
    
    // v3: Check and update best session ghost log
    updateBestSessionRecord(efficiency);
  }
}

// v3: Save Focus statistics to history array
function saveSessionToHistory(completedCount, efficiency) {
  const dateStr = new Date().toISOString().split('T')[0];
  const historyIndex = state.focusHistory.findIndex(h => h.date === dateStr);
  
  if (historyIndex !== -1) {
    // Merge stats if multiple sessions completed in a single day
    state.focusHistory[historyIndex].completedCount += completedCount;
    // Average efficiency
    const prevEff = state.focusHistory[historyIndex].efficiency;
    state.focusHistory[historyIndex].efficiency = Math.round((prevEff + efficiency) / 2);
  } else {
    state.focusHistory.push({
      date: dateStr,
      completedCount: completedCount,
      efficiency: efficiency
    });
  }
  
  localStorage.setItem('mono_focus_history', JSON.stringify(state.focusHistory));
}

// v3: Update past best session to trace ghost peer
function updateBestSessionRecord(efficiency) {
  if (state.totalFocusDuration < 60) return; // Do not record extremely short sessions
  
  const currentSessionData = {
    duration: state.totalFocusDuration,
    warpCount: state.warpCount,
    efficiency: efficiency
  };

  if (!state.bestSession) {
    state.bestSession = currentSessionData;
  } else {
    // Best is defined by higher efficiency, then shorter duration
    if (efficiency > state.bestSession.efficiency) {
      state.bestSession = currentSessionData;
    } else if (efficiency === state.bestSession.efficiency && state.totalFocusDuration < state.bestSession.duration) {
      state.bestSession = currentSessionData;
    }
  }
  
  localStorage.setItem('mono_focus_best_session', JSON.stringify(state.bestSession));
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
    
    stopTimerInterval();
    stopAutoResumeCountdown();
    
    state.timerSeconds = 1500;
    state.isTimerActive = false;
    state.isMicroStep = false;
    
    // Ghost reset
    state.ghostSecondsPassed = 0;
    elements.userProgress.style.width = "0%";
    elements.ghostProgress.style.width = "0%";

    render();
    
    elements.launcherTaskText.textContent = state.tasks[state.currentTaskIndex].text;
    elements.launcherOverlay.classList.remove('hidden');
  }
}

function selectLaunchOption(mode) {
  elements.launcherOverlay.classList.add('hidden');
  
  if (mode === 'micro') {
    state.isMicroStep = true;
    state.timerSeconds = 120; // 2 min
    state.sessionStartSeconds = 120;
    elements.activeMicroBadge.classList.remove('hidden');
  } else {
    state.isMicroStep = false;
    state.timerSeconds = 1500; // 25 min
    state.sessionStartSeconds = 1500;
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
    state.ghostSecondsPassed = 0;
    elements.userProgress.style.width = "0%";
    elements.ghostProgress.style.width = "0%";
    elements.activeMicroBadge.classList.add('hidden');
    stopTimerInterval();
    stopAutoResumeCountdown();
    render();

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
  if (state.isInWarp) return;

  state.isTimerActive = !state.isTimerActive;
  if (state.isTimerActive) {
    stopAutoResumeCountdown();
    startTimerInterval();
    elements.timerStatus.textContent = "RUNNING";
  } else {
    stopTimerInterval();
    elements.timerStatus.textContent = "PAUSED";
    startAutoResumeCountdown();
  }
}

function resetTimer() {
  stopTimerInterval();
  stopAutoResumeCountdown();
  state.isTimerActive = false;
  state.timerSeconds = state.isMicroStep ? 120 : 1500;
  state.ghostSecondsPassed = 0;
  elements.userProgress.style.width = "0%";
  elements.ghostProgress.style.width = "0%";
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

// v3 Settings Control Functions
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

// v2 Launcher Button handlers
elements.launchMicroBtn.addEventListener('click', () => selectLaunchOption('micro'));
elements.launchFullBtn.addEventListener('click', () => selectLaunchOption('full'));

// v3 Event Listeners
elements.openSettingsBtn.addEventListener('click', openSettings);
elements.closeSettingsBtn.addEventListener('click', closeSettings);
elements.saveSettingsBtn.addEventListener('click', saveSettings);
elements.aiDecomposeBtn.addEventListener('click', aiDecomposeTask);

// Global window keybinds (Space to play/pause in focus screen)
window.addEventListener('keydown', (e) => {
  if (state.appState === 'FOCUS') {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'BUTTON') {
      e.preventDefault();
      toggleTimer();
    }
  }
});

// Initialize on page load
initVisibilityShield();
render();
