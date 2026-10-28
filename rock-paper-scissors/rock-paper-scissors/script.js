'use strict';
const CHOICES = {
  rock:     { emoji: '🪨', beats: 'scissors', verb: 'crushes' },
  paper:    { emoji: '📄', beats: 'rock',     verb: 'covers' },
  scissors: { emoji: '✂️', beats: 'paper',    verb: 'cuts' }
};
const STORE_KEY = 'rps-state-v1';
const MAX_HISTORY = 10;
const $ = id => document.getElementById(id);
const el = {
  wins: $('winsEl'), losses: $('lossesEl'), draws: $('drawsEl'), rounds: $('roundsEl'), rate: $('rateEl'), streak: $('streakEl'),
  userHand: $('userHand'), compHand: $('compHand'), vs: $('vsEl'), result: $('result'),
  title: $('resultTitle'), text: $('resultText'), series: $('seriesEl'), again: $('againBtn'),
  history: $('historyBody'), reset: $('resetBtn'), mute: $('muteBtn'), theme: $('themeBtn'),
  bo5: $('bo5'), auto: $('auto'), choices: document.querySelectorAll('.choice')
};

const defaults = () => ({ wins: 0, losses: 0, draws: 0, rounds: 0, streak: 0, history: [], theme: 'dark', muted: false });
let state = loadState();
let series = { user: 0, comp: 0 };
let busy = false;       // true while a round is being processed
let awaitingNext = false; // true after a result until Play Again
let autoTimer = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    return saved && typeof saved === 'object' ? { ...defaults(), ...saved } : defaults();
  } catch { return defaults(); }
}
function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } }

const cap = s => s[0].toUpperCase() + s.slice(1);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getComputerChoice() {
  const choices = Object.keys(CHOICES);
  return choices[Math.floor(Math.random() * choices.length)];
}
function determineWinner(userChoice, computerChoice) {
  if (userChoice === computerChoice) return 'draw';
  return CHOICES[userChoice].beats === computerChoice ? 'win' : 'lose';
}
function explain(outcome, user, comp) {
  if (outcome === 'draw') return `Both chose ${user}. It's a tie.`;
  return outcome === 'win' ? `${cap(user)} ${CHOICES[user].verb} ${comp}.` : `${cap(comp)} ${CHOICES[comp].verb} ${user}.`;
}

/* ---------- sound ---------- */
let audio;
function beep(freq, dur = 0.12, type = 'sine') {
  if (state.muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator(), gain = audio.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + dur);
  } catch { /* audio unavailable */ }
}

/* ---------- UI helpers ---------- */
function setChoicesDisabled(disabled) { el.choices.forEach(b => { b.disabled = disabled; }); }
function bump(node) { node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }

function updateScoreboard() {
  const rate = state.rounds ? Math.round((state.wins / state.rounds) * 100) : 0;
  const values = { wins: state.wins, losses: state.losses, draws: state.draws, rounds: state.rounds, rate: rate + '%', streak: state.streak > 1 ? `🔥 ${state.streak}` : state.streak };
  for (const key in values) {
    if (String(el[key].textContent) !== String(values[key])) { el[key].textContent = values[key]; bump(el[key]); }
  }
}
function updateGameHistory() {
  if (!state.history.length) { el.history.innerHTML = '<tr class="empty"><td colspan="4">No rounds yet.</td></tr>'; return; }
  el.history.innerHTML = '';
  state.history.forEach(h => {
    const tr = document.createElement('tr');
    const cells = [h.round, CHOICES[h.user].emoji + ' ' + cap(h.user), CHOICES[h.comp].emoji + ' ' + cap(h.comp), { win: 'Win', lose: 'Lose', draw: 'Draw' }[h.result]];
    cells.forEach((c, i) => { const td = document.createElement('td'); td.textContent = c; if (i === 3) td.className = h.result; tr.appendChild(td); });
    el.history.appendChild(tr);
  });
}
function updateSeries() {
  el.series.hidden = !el.bo5.checked;
  el.series.textContent = `Best of 5: You ${series.user} – ${series.comp} Computer (first to 3)`;
}
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#3de0a5', '#ffc95c', '#8b7bff', '#ff5d7a', '#5ac8fa'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2400);
  }
}

/* ---------- game flow ---------- */
async function playRound(userChoice) {
  if (busy || awaitingNext || !CHOICES[userChoice]) return; // validate + block double input
  busy = true;
  clearTimeout(autoTimer);
  setChoicesDisabled(true);
  el.reset.disabled = true;
  el.again.hidden = true;
  el.result.className = 'result';
  el.title.textContent = 'Get ready…';
  el.text.textContent = '';
  el.userHand.className = 'hand reveal'; el.userHand.textContent = CHOICES[userChoice].emoji;
  el.compHand.className = 'hand shake'; el.compHand.textContent = '✊';
  el.choices.forEach(b => b.classList.toggle('picked', b.dataset.choice === userChoice));

  for (const n of [3, 2, 1]) { el.vs.textContent = n; el.vs.className = 'vs count'; beep(380 + n * 60); await sleep(550); }
  el.vs.textContent = 'VS'; el.vs.className = 'vs';

  const computerChoice = getComputerChoice();
  const outcome = determineWinner(userChoice, computerChoice);
  el.compHand.className = 'hand reveal'; el.compHand.textContent = CHOICES[computerChoice].emoji;

  state.rounds++;
  if (outcome === 'win') { state.wins++; state.streak++; series.user++; }
  else if (outcome === 'lose') { state.losses++; state.streak = 0; series.comp++; }
  else { state.draws++; }
  state.history.unshift({ round: state.rounds, user: userChoice, comp: computerChoice, result: outcome });
  state.history = state.history.slice(0, MAX_HISTORY);
  saveState();

  const labels = { win: 'YOU WIN! 🎉', lose: 'YOU LOSE 😢', draw: "IT'S A DRAW 🤝" };
  el.result.className = 'result ' + outcome;
  el.title.textContent = labels[outcome];
  el.text.textContent = explain(outcome, userChoice, computerChoice);
  if (outcome === 'win') el.userHand.classList.add('winner');
  if (outcome === 'lose') el.compHand.classList.add('winner');
  if (outcome === 'win') { confetti(); beep(660, 0.25); } else if (outcome === 'lose') beep(180, 0.3, 'sawtooth'); else beep(300);

  if (el.bo5.checked) {
    updateSeries();
    if (series.user === 3 || series.comp === 3) {
      el.text.textContent += series.user === 3 ? ' 🏆 You won the match!' : ' The computer won the match.';
      series = { user: 0, comp: 0 };
    }
  }
  updateScoreboard();
  updateGameHistory();

  busy = false;
  awaitingNext = true;
  el.reset.disabled = false;
  el.again.hidden = false;
  el.again.focus({ preventScroll: true });
  if (el.auto.checked) autoTimer = setTimeout(() => { playAgain(); playRound(getComputerChoice()); }, 1500);
}

function playAgain() {
  if (busy) return;
  awaitingNext = false;
  clearTimeout(autoTimer);
  el.userHand.className = el.compHand.className = 'hand';
  el.userHand.textContent = el.compHand.textContent = '❔';
  el.result.className = 'result';
  el.title.textContent = 'Make your move';
  el.text.textContent = 'Choose below to start the round.';
  el.again.hidden = true;
  el.choices.forEach(b => b.classList.remove('picked'));
  setChoicesDisabled(false);
  if (el.bo5.checked) updateSeries();
}

function resetGame() {
  if (busy) return;
  if (!confirm('Reset all scores and history? This cannot be undone.')) return;
  const { theme, muted } = state;
  state = { ...defaults(), theme, muted };
  series = { user: 0, comp: 0 };
  saveState();
  updateScoreboard(); updateGameHistory(); playAgain();
}

/* ---------- settings ---------- */
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  el.theme.textContent = state.theme === 'dark' ? '🌙' : '☀️';
  el.theme.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
function applyMute() {
  el.mute.textContent = state.muted ? '🔇' : '🔊';
  el.mute.setAttribute('aria-pressed', state.muted);
  el.mute.setAttribute('aria-label', state.muted ? 'Unmute sound' : 'Mute sound');
}

/* ---------- events ---------- */
el.choices.forEach(b => b.addEventListener('click', () => playRound(b.dataset.choice)));
el.again.addEventListener('click', playAgain);
el.reset.addEventListener('click', resetGame);
el.theme.addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveState(); });
el.mute.addEventListener('click', () => { state.muted = !state.muted; applyMute(); saveState(); });
el.bo5.addEventListener('change', () => { series = { user: 0, comp: 0 }; updateSeries(); });
el.auto.addEventListener('change', () => {
  clearTimeout(autoTimer);
  if (el.auto.checked && awaitingNext) autoTimer = setTimeout(() => { playAgain(); playRound(getComputerChoice()); }, 800);
  else if (el.auto.checked && !busy) playRound(getComputerChoice());
});
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const key = { r: 'rock', p: 'paper', s: 'scissors' }[e.key.toLowerCase()];
  if (key) { if (awaitingNext && !busy) playAgain(); playRound(key); }
});

applyTheme(); applyMute(); updateScoreboard(); updateGameHistory();
