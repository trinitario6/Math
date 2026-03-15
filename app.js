/* ═══════════════════════════════════════════════
   Kids Math — App Logic
   Gamification: XP, levels, achievements, hearts,
                 combo streaks, daily streak
═══════════════════════════════════════════════ */
'use strict';

// ── Config ──────────────────────────────────────────────────────────────────
const LEVELS = {
  1: { name:'Starter',    emoji:'🌱', divisors:[1,2,3],              maxDividend:30  },
  2: { name:'Explorer',   emoji:'🚀', divisors:[1,2,3,4,5],          maxDividend:50  },
  3: { name:'Challenger', emoji:'⚡', divisors:[1,2,3,4,5,6,7,8,9], maxDividend:81  },
  4: { name:'Master',     emoji:'👑', divisors:[2,3,4,5,6,7,8,9,10,11,12], maxDividend:144 },
};
const SECTIONS = ['A','B','C','D','E','F','G','H'];

// XP config
const XP_PER_CORRECT   = 10;
const XP_COMBO_BONUS   = [0,0,5,10,15,20,25]; // bonus at combo 2,3,4,5,6+
const XP_PERFECT_BONUS = 30;
const XP_LEVEL_THRESHOLDS = [0,100,250,450,700,1000,1400,1900,2500,3200,4000];

// Achievements definition
const ACHIEVEMENTS = [
  { id:'first_blood',  icon:'🎯', name:'First Right',  desc:'Get your first correct answer',           check:(stats)=> stats.totalCorrect >= 1 },
  { id:'hat_trick',    icon:'🎩', name:'Hat Trick',    desc:'3 correct in a row',                       check:(stats)=> stats.bestCombo >= 3 },
  { id:'on_fire',      icon:'🔥', name:'On Fire',      desc:'5 correct in a row',                       check:(stats)=> stats.bestCombo >= 5 },
  { id:'perfect_10',   icon:'💯', name:'Perfect 10',   desc:'Score 10/10 on a section (first 10)',      check:(stats)=> stats.hasMini10 },
  { id:'perfect',      icon:'🏆', name:'Perfect Run',  desc:'20/20 on a section',                       check:(stats)=> stats.hasPerfect },
  { id:'speed_demon',  icon:'⚡', name:'Speed Demon',  desc:'Complete a section under 90 seconds',      check:(stats)=> stats.fastestTime <= 90000 },
  { id:'scholar',      icon:'📚', name:'Scholar',      desc:'Complete 5 sections total',                check:(stats)=> stats.totalSections >= 5 },
  { id:'streak_3',     icon:'🌟', name:'3-Day Streak', desc:'Practice 3 days in a row',                 check:(stats)=> stats.dayStreak >= 3 },
  { id:'centurion',    icon:'💎', name:'Centurion',    desc:'Earn 100 XP',                              check:(stats)=> stats.totalXP >= 100 },
  { id:'master_div',   icon:'👑', name:'Division King',desc:'Complete Level 4',                         check:(stats)=> stats.completedLevel4 },
];

// ── Storage ────────────────────────────────────────────────────────────────
const DB_KEY      = 'mq_sessions_v2';
const STATS_KEY   = 'mq_stats_v2';
const ACH_KEY     = 'mq_achievements_v2';

function loadSessions() { try { return JSON.parse(localStorage.getItem(DB_KEY)||'[]'); } catch { return []; } }
function saveSession(s)  { const arr=loadSessions(); arr.push(s); localStorage.setItem(DB_KEY, JSON.stringify(arr)); }
function clearSessions() { localStorage.removeItem(DB_KEY); }

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)||'{}');
  } catch { return {}; }
}
function saveStats(s) { localStorage.setItem(STATS_KEY, JSON.stringify(s)); }

function loadAchievements() { try { return JSON.parse(localStorage.getItem(ACH_KEY)||'[]'); } catch { return []; } }
function saveAchievements(a) { localStorage.setItem(ACH_KEY, JSON.stringify(a)); }

// ── App state ──────────────────────────────────────────────────────────────
let state = {
  screen:        'home',
  level:         1,
  sectionIdx:    0,
  questions:     [],
  current:       0,
  answers:       [],
  input:         '',
  timerStart:    null,
  timerInterval: null,
  totalElapsed:  0,
  qStart:        null,
  combo:         0,
  maxCombo:      0,
  sessionXP:     0,
  hearts:        3,
  feedbackTO:    null,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtTime(ms) {
  const s=Math.floor(ms/1000), m=Math.floor(s/60);
  return `${m>0?m+'m ':''}${s%60}s`;
}
function fmtTimerDisplay(ms) {
  const s=Math.floor(ms/1000), m=Math.floor(s/60);
  return `${m}:${String(s%60).padStart(2,'0')}`;
}

function genQuestions(level) {
  const cfg=LEVELS[level], qs=[];
  while(qs.length < 20) {
    const d = cfg.divisors[Math.floor(Math.random()*cfg.divisors.length)];
    const maxQ = Math.floor(cfg.maxDividend/d);
    const q = Math.floor(Math.random()*maxQ)+1;
    const n = d*q;
    if (n>0 && n<=cfg.maxDividend) qs.push({dividend:n, divisor:d, answer:q});
  }
  return qs;
}

// ── XP system ─────────────────────────────────────────────────────────────
function getXPLevel(totalXP) {
  let lvl=1;
  for (let i=1; i<XP_LEVEL_THRESHOLDS.length; i++) {
    if (totalXP >= XP_LEVEL_THRESHOLDS[i]) lvl=i+1;
    else break;
  }
  return lvl;
}
function getXPProgress(totalXP) {
  const lvl = getXPLevel(totalXP);
  const lo = XP_LEVEL_THRESHOLDS[lvl-1] || 0;
  const hi = XP_LEVEL_THRESHOLDS[lvl]   || (lo+500);
  return { lvl, lo, hi, pct: Math.min((totalXP-lo)/(hi-lo)*100,100), toNext: hi-totalXP };
}
function refreshXPBar() {
  const stats  = loadStats();
  const total  = stats.totalXP||0;
  const { lvl, pct, toNext } = getXPProgress(total);
  $('xp-total').textContent    = total;
  $('xp-level').textContent    = lvl;
  $('xp-fill').style.width     = pct+'%';
  $('xp-next-val').textContent = Math.max(0,toNext);
}

// ── Streak / daily ────────────────────────────────────────────────────────
function updateDailyStreak() {
  const stats = loadStats();
  const today = new Date().toDateString();
  const last  = stats.lastPracticeDate;
  const yesterday = new Date(Date.now()-86400000).toDateString();

  if (last === today) {
    // already counted today
  } else if (last === yesterday) {
    stats.dayStreak = (stats.dayStreak||0)+1;
  } else {
    stats.dayStreak = 1;
  }
  stats.lastPracticeDate = today;
  saveStats(stats);
  $('streak-count').textContent = stats.dayStreak||1;
}

// ── Achievements ──────────────────────────────────────────────────────────
function checkAchievements(newStats) {
  const earned = loadAchievements();
  const newlyEarned = [];
  ACHIEVEMENTS.forEach(ach => {
    if (!earned.includes(ach.id) && ach.check(newStats)) {
      earned.push(ach.id);
      newlyEarned.push(ach);
    }
  });
  saveAchievements(earned);
  return newlyEarned;
}

function renderAchievementsRow() {
  const earned = loadAchievements();
  const row = $('achievements-row');
  row.innerHTML = '';
  ACHIEVEMENTS.forEach(ach => {
    const div = document.createElement('div');
    div.className = 'ach-badge' + (earned.includes(ach.id) ? '' : ' locked');
    div.innerHTML = `<span class="ach-icon">${ach.icon}</span><span class="ach-name">${ach.name}</span>`;
    div.title = ach.desc;
    row.appendChild(div);
  });
}

// ── Timer ─────────────────────────────────────────────────────────────────
function startTimer() {
  state.timerStart = Date.now() - state.totalElapsed;
  state.timerInterval = setInterval(() => {
    state.totalElapsed = Date.now() - state.timerStart;
    $('stopwatch').textContent = fmtTimerDisplay(state.totalElapsed);
  }, 200);
}
function stopTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval=null; }
  state.totalElapsed = Date.now() - (state.timerStart||Date.now());
}
function resetTimer() {
  stopTimer(); state.totalElapsed=0; state.timerStart=null;
  $('stopwatch').textContent = '0:00';
}

// ── Screen ────────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(`screen-${name}`).classList.add('active');
  state.screen = name;
}

// ── Practice ──────────────────────────────────────────────────────────────
function startPractice() {
  state.questions    = genQuestions(state.level);
  state.current      = 0;
  state.answers      = [];
  state.input        = '';
  state.combo        = 0;
  state.maxCombo     = 0;
  state.sessionXP    = 0;
  state.hearts       = 3;
  resetTimer();

  const section = SECTIONS[state.sectionIdx % SECTIONS.length];
  $('q-tag').textContent = `Level ${state.level} · Section ${section}`;

  renderHearts();
  updateStatRow();
  updateProgressBar();
  showScreen('practice');
  loadQuestion();
  startTimer();
  updateDailyStreak();
}

function loadQuestion() {
  const q = state.questions[state.current];
  $('eq-dividend').textContent = q.dividend;
  $('eq-divisor').textContent  = q.divisor;
  $('eq-answer').textContent   = '?';
  $('eq-answer').className     = 'eq-answer';
  const wrap = $('eq-answer-wrap');
  wrap.className = 'eq-answer-wrap';
  $('numpad-display').textContent = '_';
  const fb = $('feedback'); fb.textContent=''; fb.className='feedback';
  $('q-card').className = 'q-card';
  $('nk-go').disabled = false;
  $('q-counter') && ($('q-counter').textContent = `${state.current+1}/20`);
  updateProgressBar();
  state.input  = '';
  state.qStart = Date.now();
}

function submitAnswer() {
  if (!state.input) return;
  const given   = parseInt(state.input, 10);
  const q       = state.questions[state.current];
  const correct = given === q.answer;
  const timeTaken = Date.now() - state.qStart;

  state.answers.push({ correct, given, expected: q.answer, time: timeTaken });

  const card = $('q-card');
  const fb   = $('feedback');
  const ans  = $('eq-answer');
  const wrap = $('eq-answer-wrap');
  ans.textContent = given;

  if (correct) {
    state.combo++;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const bonusIdx = Math.min(state.combo, XP_COMBO_BONUS.length-1);
    const xpEarned = XP_PER_CORRECT + (XP_COMBO_BONUS[bonusIdx]||0);
    state.sessionXP += xpEarned;

    card.className = 'q-card pop-correct';
    ans.className  = 'eq-answer correct';
    wrap.className = 'eq-answer-wrap correct';
    fb.textContent = correctMsg(state.combo);
    fb.className   = 'feedback correct';
    showCombo(state.combo);
  } else {
    state.combo = 0;
    state.hearts = Math.max(0, state.hearts-1);
    card.className = 'q-card pop-wrong';
    ans.className  = 'eq-answer wrong';
    wrap.className = 'eq-answer-wrap wrong';
    fb.textContent = `Answer: ${q.answer}`;
    fb.className   = 'feedback wrong';
    hideCombo();
    renderHearts();
  }

  $('nk-go').disabled = true;
  updateStatRow();

  state.feedbackTO = setTimeout(() => {
    state.current++;
    if (state.current >= 20) endSection();
    else loadQuestion();
  }, correct ? 750 : 1350);
}

function correctMsg(combo) {
  if (combo >= 8) return '🔥 UNSTOPPABLE!';
  if (combo >= 5) return '⚡ On fire! x'+combo;
  if (combo >= 3) return '✓ Combo x'+combo+'!';
  const msgs = ['✓ Correct!','✓ Nice!','✓ Perfect!','✓ Great!','✓ Nailed it!'];
  return msgs[Math.floor(Math.random()*msgs.length)];
}

function showCombo(n) {
  const pill = $('combo-pill');
  if (n >= 3) {
    pill.textContent = `🔥 ${n} in a row!`;
    pill.classList.add('visible');
  } else {
    hideCombo();
  }
}
function hideCombo() { $('combo-pill').classList.remove('visible'); }

function renderHearts() {
  ['h1','h2','h3'].forEach((id,i) => {
    const el = $(id);
    if (el) el.className = 'heart' + (i < state.hearts ? '' : ' lost');
  });
}

function updateStatRow() {
  const answered = state.answers.length;
  const correct  = state.answers.filter(a=>a.correct).length;
  const wrong    = answered - correct;
  const acc      = answered ? Math.round(correct/answered*100) : null;
  $('s-correct').textContent = correct;
  $('s-wrong').textContent   = wrong;
  $('s-acc').textContent     = acc !== null ? acc+'%' : '—';
  $('s-xp').textContent      = '+'+state.sessionXP;
}

function updateProgressBar() {
  const pct = (state.answers.length / 20) * 100;
  $('p-progress-fill').style.width = pct + '%';
}

// ── End section ───────────────────────────────────────────────────────────
function endSection() {
  stopTimer();
  const correct  = state.answers.filter(a=>a.correct).length;
  const accuracy = Math.round(correct/20*100);
  const section  = SECTIONS[state.sectionIdx % SECTIONS.length];
  if (accuracy === 100) state.sessionXP += XP_PERFECT_BONUS;

  const session = {
    date:      new Date().toISOString(),
    level:     state.level,
    levelName: LEVELS[state.level].name,
    section,
    score:     correct,
    total:     20,
    accuracy,
    timeMs:    state.totalElapsed,
    avgTime:   Math.round(state.totalElapsed/20/100)/10,
    maxCombo:  state.maxCombo,
    xpEarned:  state.sessionXP,
    answers:   state.answers,
  };
  saveSession(session);

  // Update global stats
  const stats = loadStats();
  stats.totalXP        = (stats.totalXP||0) + state.sessionXP;
  stats.totalCorrect   = (stats.totalCorrect||0) + correct;
  stats.totalSections  = (stats.totalSections||0) + 1;
  stats.bestCombo      = Math.max(stats.bestCombo||0, state.maxCombo);
  if (accuracy === 100) stats.hasPerfect = true;
  if (correct >= 10 && state.current <= 10) stats.hasMini10 = true; // first half perfect
  if (state.totalElapsed <= 90000) stats.fastestTime = Math.min(stats.fastestTime||Infinity, state.totalElapsed);
  if (state.level === 4) stats.completedLevel4 = true;
  stats.dayStreak = stats.dayStreak||1;

  const prevXPLevel = getXPLevel((stats.totalXP||0) - state.sessionXP);
  const newXPLevel  = getXPLevel(stats.totalXP);
  saveStats(stats);

  const newBadges = checkAchievements(stats);

  // Level-up modal?
  if (newXPLevel > prevXPLevel) {
    showLevelUpModal(newXPLevel);
  }

  showResults(session, newBadges);
}

// ── Results ────────────────────────────────────────────────────────────────
function showResults(session, newBadges) {
  const emojis = { 100:'🏆', 90:'🌟', 80:'🎉', 70:'👍', 60:'💪', 0:'🎯' };
  const band   = [100,90,80,70,60,0].find(b => session.accuracy >= b);
  $('trophy-emoji').textContent = emojis[band];
  $('xp-burst').textContent = '+'+state.sessionXP+' XP';

  const headlines = {
    100: 'Perfect! 🎉',
    90:  'Excellent!',
    80:  'Great Job!',
    70:  'Good Work!',
    60:  'Keep Going!',
    0:   'Nice Try!',
  };
  $('r-headline').textContent = headlines[band];
  $('r-sub').textContent      = `Section ${session.section} · Level ${session.level}`;
  $('r-score').textContent    = `${session.score}/20`;
  $('r-acc').textContent      = `${session.accuracy}%`;
  $('r-time').textContent     = fmtTime(session.timeMs);
  $('r-avg').textContent      = `${session.avgTime}s`;

  // New badges
  const nb = $('new-badges');
  nb.innerHTML = '';
  newBadges.forEach((ach,i) => {
    const div = document.createElement('div');
    div.className = 'new-badge-item';
    div.style.animationDelay = (i*0.1)+'s';
    div.innerHTML = `<span class="bi-icon">${ach.icon}</span><span class="bi-name">${ach.name}</span>`;
    nb.appendChild(div);
  });

  // Review
  const rl = $('review-list');
  rl.innerHTML = '';
  session.answers.forEach((a,i) => {
    const q = state.questions[i];
    const div = document.createElement('div');
    div.className = 'review-row';
    div.innerHTML = `
      <span class="review-icon">${a.correct?'✓':'✗'}</span>
      <span class="review-eq">${q.dividend} ÷ ${q.divisor} =</span>
      <span class="review-ans ${a.correct?'correct':'wrong'}">${a.given}</span>
      ${!a.correct ? `<span class="review-correct-hint">(${q.answer})</span>` : ''}
    `;
    rl.appendChild(div);
  });

  if (session.accuracy >= 80) launchConfetti(session.accuracy);
  showScreen('results');
  refreshXPBar();
}

// ── Confetti ───────────────────────────────────────────────────────────────
function launchConfetti(accuracy) {
  const colors = ['#34c759','#007aff','#ff9500','#ff3b30','#af52de','#ffcc00','#5ac8fa'];
  const n = accuracy >= 100 ? 60 : 30;
  const container = document.body;
  for (let i=0; i<n; i++) {
    const el = document.createElement('div');
    const size = 6+Math.random()*8;
    el.style.cssText = `
      position:fixed; z-index:200; pointer-events:none;
      left:${Math.random()*100}%;
      top:${-10+Math.random()*-20}px;
      width:${size}px; height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>.5?'50%':'3px'};
      animation: conffall ${1.4+Math.random()*1.2}s linear ${Math.random()*0.6}s forwards;
    `;
    container.appendChild(el);
    el.addEventListener('animationend', ()=>el.remove());
  }
  // inject keyframe once
  if (!document.getElementById('conf-style')) {
    const s = document.createElement('style');
    s.id = 'conf-style';
    s.textContent = `@keyframes conffall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:0}}`;
    document.head.appendChild(s);
  }
}

// ── Level-up modal ─────────────────────────────────────────────────────────
function showLevelUpModal(lvl) {
  $('modal-lvl').textContent = lvl;
  $('modal-levelup').style.display = 'flex';
}

// ── Progress screen ────────────────────────────────────────────────────────
function renderProgress() {
  renderAchievementsRow();
  drawChart();
  renderHistory();
  renderBests();
}

function drawChart() {
  const sessions  = loadSessions();
  const lvlFilter = $('c-level').value;
  const metric    = $('c-metric').value;
  const canvas    = $('trend-chart');
  const empty     = $('chart-empty');

  let data = sessions;
  if (lvlFilter !== 'all') data = data.filter(s=>String(s.level)===lvlFilter);
  if (!data.length) { canvas.style.display='none'; empty.style.display='block'; return; }
  canvas.style.display='block'; empty.style.display='none';

  const dpr = window.devicePixelRatio||1;
  const W   = canvas.offsetWidth||320;
  const H   = 200;
  canvas.width  = W*dpr;
  canvas.height = H*dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const pad = {t:16, r:16, b:34, l:38};
  const cw  = W-pad.l-pad.r;
  const ch  = H-pad.t-pad.b;

  const vals = data.map(s => metric==='accuracy'?s.accuracy : metric==='time'?Math.round(s.timeMs/1000) : s.score);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = maxV-minV || 1;

  const gx = i => pad.l + (i/Math.max(data.length-1,1))*cw;
  const gy = v => pad.t + ch - ((v-minV)/span)*ch;

  ctx.clearRect(0,0,W,H);

  // Grid
  for (let i=0; i<=4; i++) {
    const y = pad.t+(i/4)*ch;
    ctx.strokeStyle='rgba(0,0,0,0.06)';
    ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(W-pad.r,y); ctx.stroke();
    const v = Math.round(maxV-(i/4)*span);
    ctx.fillStyle='#8e8e93'; ctx.font=`600 10px Nunito,sans-serif`; ctx.textAlign='right';
    ctx.fillText(v, pad.l-5, y+4);
  }

  // Gradient fill
  if (data.length>1) {
    const grad = ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
    grad.addColorStop(0,'rgba(0,122,255,0.18)');
    grad.addColorStop(1,'rgba(0,122,255,0)');
    ctx.beginPath();
    ctx.moveTo(gx(0), gy(vals[0]));
    for (let i=1; i<vals.length; i++) {
      const xc=(gx(i-1)+gx(i))/2, yc=(gy(vals[i-1])+gy(vals[i]))/2;
      ctx.quadraticCurveTo(gx(i-1),gy(vals[i-1]),xc,yc);
    }
    ctx.lineTo(gx(vals.length-1),gy(vals[vals.length-1]));
    ctx.lineTo(gx(vals.length-1),pad.t+ch);
    ctx.lineTo(gx(0),pad.t+ch);
    ctx.closePath();
    ctx.fillStyle=grad; ctx.fill();
  }

  // Line
  ctx.beginPath(); ctx.strokeStyle='#007aff'; ctx.lineWidth=2.5;
  ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.moveTo(gx(0),gy(vals[0]));
  for (let i=1; i<vals.length; i++) {
    const xc=(gx(i-1)+gx(i))/2, yc=(gy(vals[i-1])+gy(vals[i]))/2;
    ctx.quadraticCurveTo(gx(i-1),gy(vals[i-1]),xc,yc);
  }
  ctx.lineTo(gx(vals.length-1),gy(vals[vals.length-1]));
  ctx.stroke();

  // Dots
  data.forEach((s,i) => {
    const x=gx(i), y=gy(vals[i]);
    ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2);
    ctx.fillStyle='#007aff'; ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();

    if (data.length<=10 || i%Math.ceil(data.length/7)===0) {
      const d=new Date(s.date);
      const lbl=`${d.getMonth()+1}/${d.getDate()}`;
      ctx.fillStyle='#aeaeb2'; ctx.font=`600 9px Nunito,sans-serif`; ctx.textAlign='center';
      ctx.fillText(lbl, x, H-6);
    }
  });
}

function renderHistory() {
  const sessions = loadSessions().slice().reverse();
  const list  = $('hist-list');
  const empty = $('hist-empty');
  list.innerHTML = '';
  if (!sessions.length) { empty.style.display='block'; return; }
  empty.style.display='none';
  sessions.forEach(s => {
    const d   = new Date(s.date);
    const div = document.createElement('div');
    div.className = 'hist-item';
    div.innerHTML = `
      <div class="hi-circle lv${s.level}">${LEVELS[s.level].emoji}</div>
      <div class="hi-body">
        <div class="hi-title">${s.levelName} · Section ${s.section}</div>
        <div class="hi-sub">${d.toLocaleDateString(undefined,{month:'short',day:'numeric'})} ${d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})} · ${fmtTime(s.timeMs)}</div>
      </div>
      <div class="hi-score">${s.accuracy}%</div>
    `;
    list.appendChild(div);
  });
}

function renderBests() {
  const sessions = loadSessions();
  const grid  = $('bests-grid');
  const empty = $('bests-empty');
  grid.innerHTML = '';
  if (!sessions.length) { empty.style.display='block'; return; }
  empty.style.display='none';

  [1,2,3,4].forEach(lvl => {
    const ls = sessions.filter(s=>s.level===lvl);
    if (!ls.length) return;
    const bestA = ls.reduce((a,b)=>b.accuracy>a.accuracy?b:a);
    const bestT = ls.reduce((a,b)=>b.timeMs<a.timeMs?b:a);

    grid.innerHTML += `
      <div class="best-card">
        <div class="bc-icon">${LEVELS[lvl].emoji}</div>
        <div class="bc-val">${bestA.accuracy}%</div>
        <div class="bc-label">Lv${lvl} Best Acc</div>
        <div class="bc-sub">${new Date(bestA.date).toLocaleDateString()}</div>
      </div>
      <div class="best-card">
        <div class="bc-icon">⚡</div>
        <div class="bc-val">${fmtTime(bestT.timeMs)}</div>
        <div class="bc-label">Lv${lvl} Fastest</div>
        <div class="bc-sub">${bestT.accuracy}% acc</div>
      </div>
    `;
  });
}

// ── Utility ────────────────────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }

// ── Event wiring ───────────────────────────────────────────────────────────
// Level cards
document.querySelectorAll('.lcard').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.lcard').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    state.level = parseInt(card.dataset.level);
  });
});

$('btn-start').addEventListener('click', () => startPractice());
$('btn-progress-icon').addEventListener('click', () => { renderProgress(); showScreen('progress'); });
$('btn-back-home').addEventListener('click', () => {
  stopTimer();
  if (state.feedbackTO) clearTimeout(state.feedbackTO);
  showScreen('home');
});

// Numpad
document.querySelectorAll('.nk').forEach(btn => {
  const fire = () => {
    const v = btn.dataset.v;
    if (v==='C') {
      state.input='';
      $('numpad-display').textContent='_';
    } else if (v==='GO') {
      submitAnswer();
    } else {
      if (state.input.length>=3) return;
      state.input += v;
      $('numpad-display').textContent=state.input;
    }
  };
  btn.addEventListener('click', fire);
  btn.addEventListener('touchstart', e=>{ e.preventDefault(); fire(); }, { passive:false });
});

// Results
$('btn-retry').addEventListener('click', () => startPractice());
$('btn-next-section').addEventListener('click', () => { state.sectionIdx++; startPractice(); });
$('btn-results-home').addEventListener('click', () => { refreshXPBar(); renderAchievementsRow(); showScreen('home'); });
$('review-toggle').addEventListener('click', () => {
  const rl=$('review-list');
  const hidden=rl.style.display==='none';
  rl.style.display=hidden?'flex':'none';
  $('review-toggle').textContent=hidden?'Hide ▴':'Show ▾';
});

// Progress
$('btn-back-progress').addEventListener('click', () => showScreen('home'));
$('btn-clear-data').addEventListener('click', () => {
  if (confirm('Clear all data? This cannot be undone.')) {
    clearSessions();
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(ACH_KEY);
    renderProgress();
    refreshXPBar();
    $('streak-count').textContent='0';
  }
});
$('btn-dismiss-levelup').addEventListener('click', () => {
  $('modal-levelup').style.display='none';
});
document.querySelectorAll('.seg').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.seg-content').forEach(c=>c.classList.remove('active'));
    btn.classList.add('active');
    $(`seg-${btn.dataset.tab}`).classList.add('active');
    if (btn.dataset.tab==='trend') drawChart();
  });
});
$('c-level').addEventListener('change', drawChart);
$('c-metric').addEventListener('change', drawChart);

// Keyboard fallback
document.addEventListener('keydown', e => {
  if (state.screen !== 'practice') return;
  if (e.key>='0'&&e.key<='9') {
    if (state.input.length<3) { state.input+=e.key; $('numpad-display').textContent=state.input; }
  }
  if (e.key==='Enter') { e.preventDefault(); submitAnswer(); }
  if (e.key==='Backspace') { state.input=''; $('numpad-display').textContent='_'; }
});

// SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

// ── Init ───────────────────────────────────────────────────────────────────
(function init() {
  refreshXPBar();
  renderAchievementsRow();
  const stats = loadStats();
  $('streak-count').textContent = stats.dayStreak||0;
})();
