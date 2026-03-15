/* ============================================
   DivisionPro — App Logic
   ============================================ */

'use strict';

// ── State ──────────────────────────────────────────────────────────────
const LEVELS = {
  1: { name: 'Starter',    divisors: [1,2,3],     maxDividend: 30  },
  2: { name: 'Explorer',   divisors: [1,2,3,4,5], maxDividend: 50  },
  3: { name: 'Challenger', divisors: [1,2,3,4,5,6,7,8,9], maxDividend: 81  },
  4: { name: 'Master',     divisors: [2,3,4,5,6,7,8,9,10,11,12], maxDividend: 144 }
};

const SECTIONS = ['A','B','C','D','E','F','G','H'];

let state = {
  screen: 'home',
  level: 1,
  sectionIdx: 0,
  questions: [],
  current: 0,
  answers: [],       // { correct: bool, given: num, expected: num, time: ms }
  input: '',
  timerStart: null,
  timerInterval: null,
  qStart: null,
  totalElapsed: 0,
  feedbackTimeout: null,
};

// ── Storage helpers ─────────────────────────────────────────────────────
const DB_KEY = 'divisionpro_sessions';

function loadSessions() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); } catch { return []; }
}
function saveSession(session) {
  const sessions = loadSessions();
  sessions.push(session);
  localStorage.setItem(DB_KEY, JSON.stringify(sessions));
}
function clearSessions() {
  localStorage.removeItem(DB_KEY);
}

// ── Question generation ─────────────────────────────────────────────────
function genQuestions(level) {
  const cfg = LEVELS[level];
  const qs = [];
  while (qs.length < 20) {
    const divisor = cfg.divisors[Math.floor(Math.random() * cfg.divisors.length)];
    const maxQ = Math.floor(cfg.maxDividend / divisor);
    const quotient = Math.floor(Math.random() * maxQ) + 1;
    const dividend = divisor * quotient;
    if (dividend > 0 && dividend <= cfg.maxDividend) {
      qs.push({ dividend, divisor, answer: quotient });
    }
  }
  return qs;
}

// ── Timer ────────────────────────────────────────────────────────────────
function startTimer() {
  state.timerStart = Date.now() - state.totalElapsed;
  state.timerInterval = setInterval(() => {
    const elapsed = Date.now() - state.timerStart;
    document.getElementById('stopwatch').textContent = formatTime(elapsed);
  }, 100);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
    state.totalElapsed = Date.now() - state.timerStart;
  }
}

function resetTimer() {
  stopTimer();
  state.totalElapsed = 0;
  state.timerStart = null;
  document.getElementById('stopwatch').textContent = '00:00';
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

function formatTimeFull(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ── Screen navigation ────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  state.screen = name;
}

// ── Practice start ────────────────────────────────────────────────────────
function startPractice() {
  state.questions = genQuestions(state.level);
  state.current = 0;
  state.answers = [];
  state.input = '';
  resetTimer();
  state.qStart = null;

  document.getElementById('header-level').textContent = `Level ${state.level} — ${LEVELS[state.level].name}`;
  document.getElementById('header-section').textContent = `Section ${SECTIONS[state.sectionIdx % SECTIONS.length]}`;
  updateScoreBar();
  showScreen('practice');
  loadQuestion();
  startTimer();
  state.qStart = Date.now();
}

function loadQuestion() {
  const q = state.questions[state.current];
  document.getElementById('eq-dividend').textContent = q.dividend;
  document.getElementById('eq-divisor').textContent = q.divisor;
  const ans = document.getElementById('eq-answer');
  ans.textContent = '?';
  ans.className = 'eq-answer';
  document.getElementById('numpad-display').textContent = '_';
  const fb = document.getElementById('feedback-msg');
  fb.textContent = '';
  fb.className = 'feedback-msg';
  const card = document.getElementById('question-card');
  card.className = 'question-card';
  document.querySelector('.numpad-submit').disabled = false;
  state.input = '';
  state.qStart = Date.now();
}

function submitAnswer() {
  if (!state.input) return;
  const given = parseInt(state.input, 10);
  const q = state.questions[state.current];
  const timeTaken = Date.now() - state.qStart;
  const correct = given === q.answer;

  state.answers.push({ correct, given, expected: q.answer, time: timeTaken });

  // Visual feedback
  const card = document.getElementById('question-card');
  const fb = document.getElementById('feedback-msg');
  const ans = document.getElementById('eq-answer');
  ans.textContent = given;

  if (correct) {
    card.classList.add('correct');
    ans.classList.add('correct');
    fb.textContent = randomCorrect();
    fb.className = 'feedback-msg correct';
  } else {
    card.classList.add('wrong');
    ans.classList.add('wrong');
    fb.textContent = `Nope! Answer is ${q.answer}`;
    fb.className = 'feedback-msg wrong';
  }

  document.querySelector('.numpad-submit').disabled = true;
  updateScoreBar();

  state.feedbackTimeout = setTimeout(() => {
    state.current++;
    if (state.current >= 20) {
      endSection();
    } else {
      loadQuestion();
    }
  }, correct ? 800 : 1400);
}

function randomCorrect() {
  const msgs = ['✓ Correct!', '✓ Nice!', '✓ Perfect!', '✓ Great!', '✓ Spot on!'];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ── Score bar update ──────────────────────────────────────────────────────
function updateScoreBar() {
  const answered = state.answers.length;
  const correct = state.answers.filter(a => a.correct).length;
  document.getElementById('live-score').textContent = `${correct} / ${answered}`;
  document.getElementById('live-accuracy').textContent = answered ? `${Math.round(correct/answered*100)}%` : '—';
  document.getElementById('q-counter').textContent = `${Math.min(state.current+1,20)} / 20`;
  document.getElementById('progress-fill').style.width = `${(answered/20)*100}%`;
}

// ── End section ───────────────────────────────────────────────────────────
function endSection() {
  stopTimer();
  const elapsed = state.totalElapsed;
  const correct = state.answers.filter(a => a.correct).length;
  const accuracy = Math.round(correct / 20 * 100);
  const avgTime = Math.round(elapsed / 20 / 1000 * 10) / 10;
  const section = SECTIONS[state.sectionIdx % SECTIONS.length];

  // Save session
  const session = {
    date: new Date().toISOString(),
    level: state.level,
    levelName: LEVELS[state.level].name,
    section,
    score: correct,
    total: 20,
    accuracy,
    timeMs: elapsed,
    avgTime,
    answers: state.answers
  };
  saveSession(session);

  // Show results
  showResults(session);
}

function showResults(session) {
  document.getElementById('results-trophy').textContent = session.accuracy === 100 ? '🏆' : session.accuracy >= 80 ? '🌟' : session.accuracy >= 60 ? '👍' : '💪';
  document.getElementById('results-title').textContent =
    session.accuracy === 100 ? 'Perfect Score!' :
    session.accuracy >= 80 ? 'Great Work!' :
    session.accuracy >= 60 ? 'Keep it up!' : 'Keep Practising!';

  document.getElementById('res-score').textContent = `${session.score}/20`;
  document.getElementById('res-accuracy').textContent = `${session.accuracy}%`;
  document.getElementById('res-time').textContent = formatTimeFull(session.timeMs);
  document.getElementById('res-avg').textContent = `${session.avgTime}s`;

  // Review
  const rev = document.getElementById('results-review');
  rev.innerHTML = '';
  session.answers.forEach((a, i) => {
    const q = state.questions[i];
    const div = document.createElement('div');
    div.className = 'review-item';
    div.innerHTML = `
      <span class="review-icon">${a.correct ? '✓' : '✗'}</span>
      <span class="review-eq">${q.dividend} ÷ ${q.divisor} =</span>
      <span class="review-answer ${a.correct ? 'correct' : 'wrong'}">${a.given}</span>
      ${!a.correct ? `<span class="review-correct-ans">(${q.answer})</span>` : ''}
    `;
    rev.appendChild(div);
  });

  // Confetti if good score
  if (session.accuracy >= 80) launchConfetti(session.accuracy);

  showScreen('results');
}

// ── Confetti ──────────────────────────────────────────────────────────────
function launchConfetti(score) {
  const container = document.getElementById('confetti');
  container.innerHTML = '';
  const colors = ['#ff6b35','#ffcd3c','#3cffd8','#ff3c6f','#2dff8a','#a78bfa'];
  const count = score >= 100 ? 60 : 30;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${-10 + Math.random() * -30}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-duration: ${1.5 + Math.random() * 1.5}s;
      animation-delay: ${Math.random() * 0.8}s;
      width: ${6 + Math.random() * 8}px;
      height: ${6 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// ── Numpad input ──────────────────────────────────────────────────────────
function handleNumpad(val) {
  if (val === 'C') {
    state.input = '';
    document.getElementById('numpad-display').textContent = '_';
  } else if (val === '✓') {
    submitAnswer();
  } else {
    if (state.input.length >= 3) return;
    state.input += val;
    document.getElementById('numpad-display').textContent = state.input;
  }
}

// ── Progress screen ────────────────────────────────────────────────────────
function renderProgress() {
  renderTrendChart();
  renderHistory();
  renderBests();
}

function renderTrendChart() {
  const sessions = loadSessions();
  const levelFilter = document.getElementById('chart-level-filter').value;
  const metric = document.getElementById('chart-metric').value;
  const empty = document.getElementById('chart-empty');
  const canvas = document.getElementById('trend-chart');

  let data = sessions;
  if (levelFilter !== 'all') data = data.filter(s => String(s.level) === levelFilter);

  if (data.length === 0) {
    canvas.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  empty.style.display = 'none';

  // Canvas drawing
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.offsetWidth || 340;
  const H = 220;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const pad = { top: 20, right: 20, bottom: 40, left: 44 };
  const cw = W - pad.left - pad.right;
  const ch = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = '#0f0f2e';
  ctx.roundRect(0, 0, W, H, 16);
  ctx.fill();

  // Values
  const vals = data.map(s => {
    if (metric === 'accuracy') return s.accuracy;
    if (metric === 'time') return Math.round(s.timeMs / 1000);
    return s.score;
  });

  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const getX = i => pad.left + (i / Math.max(data.length - 1, 1)) * cw;
  const getY = v => pad.top + ch - ((v - minV) / range) * ch;

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * ch;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    const lv = maxV - (i / 4) * range;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Space Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(lv), pad.left - 6, y + 4);
  }

  // Gradient fill
  if (data.length > 1) {
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
    grad.addColorStop(0, 'rgba(255,107,53,0.35)');
    grad.addColorStop(1, 'rgba(255,107,53,0)');
    ctx.beginPath();
    ctx.moveTo(getX(0), getY(vals[0]));
    for (let i = 1; i < vals.length; i++) {
      const xc = (getX(i - 1) + getX(i)) / 2;
      const yc = (getY(vals[i - 1]) + getY(vals[i])) / 2;
      ctx.quadraticCurveTo(getX(i - 1), getY(vals[i - 1]), xc, yc);
    }
    ctx.lineTo(getX(vals.length - 1), getY(vals[vals.length - 1]));
    ctx.lineTo(getX(vals.length - 1), pad.top + ch);
    ctx.lineTo(getX(0), pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#ff6b35';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.moveTo(getX(0), getY(vals[0]));
  for (let i = 1; i < vals.length; i++) {
    const xc = (getX(i - 1) + getX(i)) / 2;
    const yc = (getY(vals[i - 1]) + getY(vals[i])) / 2;
    ctx.quadraticCurveTo(getX(i - 1), getY(vals[i - 1]), xc, yc);
  }
  ctx.lineTo(getX(vals.length - 1), getY(vals[vals.length - 1]));
  ctx.stroke();

  // Dots + labels
  data.forEach((s, i) => {
    const x = getX(i), y = getY(vals[i]);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ff6b35';
    ctx.fill();
    ctx.strokeStyle = '#07071a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // x-axis date
    const d = new Date(s.date);
    const label = `${d.getMonth()+1}/${d.getDate()}`;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px Space Mono, monospace';
    ctx.textAlign = 'center';
    if (data.length <= 10 || i % Math.ceil(data.length / 8) === 0) {
      ctx.fillText(label, x, H - 8);
    }
  });

  // Metric label
  const labels = { accuracy: 'Accuracy %', time: 'Time (sec)', score: 'Score / 20' };
  ctx.fillStyle = 'rgba(255,107,53,0.6)';
  ctx.font = '10px Syne, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(labels[metric], pad.left, H - 8);
}

function renderHistory() {
  const sessions = loadSessions().reverse();
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';
  if (!sessions.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  sessions.forEach(s => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
    const timeStr = d.toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit' });
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="hi-badge">L${s.level}·${s.section}</div>
      <div class="hi-info">
        <div class="hi-title">${s.levelName} — Section ${s.section}</div>
        <div class="hi-sub">${dateStr} ${timeStr} · ${formatTimeFull(s.timeMs)}</div>
      </div>
      <div class="hi-score">${s.accuracy}%</div>
    `;
    list.appendChild(div);
  });
}

function renderBests() {
  const sessions = loadSessions();
  const grid = document.getElementById('bests-grid');
  const empty = document.getElementById('bests-empty');
  grid.innerHTML = '';
  if (!sessions.length) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  [1,2,3,4].forEach(lvl => {
    const lvlSessions = sessions.filter(s => s.level === lvl);
    if (!lvlSessions.length) return;

    const bestAcc = lvlSessions.reduce((a,b) => b.accuracy > a.accuracy ? b : a);
    const bestTime = lvlSessions.reduce((a,b) => b.timeMs < a.timeMs ? b : a);

    const acc = document.createElement('div');
    acc.className = 'best-card';
    acc.innerHTML = `
      <div class="best-level">Level ${lvl} · Best Accuracy</div>
      <div class="best-title">${LEVELS[lvl].name}</div>
      <div class="best-val">${bestAcc.accuracy}%</div>
      <div class="best-sub">${new Date(bestAcc.date).toLocaleDateString()}</div>
    `;
    const spd = document.createElement('div');
    spd.className = 'best-card';
    spd.innerHTML = `
      <div class="best-level">Level ${lvl} · Fastest</div>
      <div class="best-title">${LEVELS[lvl].name}</div>
      <div class="best-val">${formatTimeFull(bestTime.timeMs)}</div>
      <div class="best-sub">${bestTime.accuracy}% accurate</div>
    `;
    grid.appendChild(acc);
    grid.appendChild(spd);
  });
}

// ── Event listeners ────────────────────────────────────────────────────────
document.querySelectorAll('.level-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.level = parseInt(card.dataset.level);
  });
});
// Default select
document.querySelector('.level-card[data-level="1"]').classList.add('selected');

document.getElementById('btn-start').addEventListener('click', () => startPractice());

document.getElementById('btn-progress').addEventListener('click', () => {
  renderProgress();
  showScreen('progress');
});

document.getElementById('btn-back-home').addEventListener('click', () => {
  stopTimer();
  if (state.feedbackTimeout) clearTimeout(state.feedbackTimeout);
  showScreen('home');
});

document.getElementById('btn-back-progress').addEventListener('click', () => showScreen('home'));

// Numpad
document.querySelectorAll('.numpad-btn').forEach(btn => {
  btn.addEventListener('click', () => handleNumpad(btn.dataset.val));
  btn.addEventListener('touchstart', e => { e.preventDefault(); handleNumpad(btn.dataset.val); }, { passive: false });
});

// Results actions
document.getElementById('btn-retry').addEventListener('click', () => startPractice());
document.getElementById('btn-next-section').addEventListener('click', () => {
  state.sectionIdx++;
  startPractice();
});
document.getElementById('btn-results-home').addEventListener('click', () => showScreen('home'));

// Chart controls
document.getElementById('chart-level-filter').addEventListener('change', renderTrendChart);
document.getElementById('chart-metric').addEventListener('change', renderTrendChart);

// Progress tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'chart') renderTrendChart();
  });
});

document.getElementById('btn-clear-data').addEventListener('click', () => {
  if (confirm('Clear all session data? This cannot be undone.')) {
    clearSessions();
    renderProgress();
  }
});

// Keyboard support
document.addEventListener('keydown', e => {
  if (state.screen !== 'practice') return;
  if (e.key >= '0' && e.key <= '9') handleNumpad(e.key);
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); submitAnswer(); }
  if (e.key === 'Backspace' || e.key === 'Delete') handleNumpad('C');
});

// Register SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
