javascript
/* ============== STATE ============== */
const STORAGE_KEY = 'dayflow_state_v1';

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // reset tasks if it's a new day
    if(parsed.day !== todayKey()){
      return { ...defaultState(), stats: parsed.stats, lastDay: parsed.day };
    }
    return parsed;
  }catch(e){
    return defaultState();
  }
}

function defaultState(){
  return {
    day: todayKey(),
    tasks: [],
    stats: { completed: 0, onTime: 0, totalDone: 0, streak: 0, lastCompletedDay: null }
  };
}

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

let state = loadState();

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// carry stats/streak across day boundary
(function handleDayRollover(){
  if(state.lastDay && state.lastDay !== todayKey()){
    // streak logic: if nothing was completed yesterday, reset streak
    const completedYesterday = state.stats.lastCompletedDay === state.lastDay;
    if(!completedYesterday) state.stats.streak = 0;
    delete state.lastDay;
    saveState();
  }
})();

/* ============== CLOCK ============== */
function tickClock(){
  const now = new Date();
  document.getElementById('clockTime').textContent = now.toLocaleTimeString('en-GB');
  document.getElementById('clockDate').textContent = now.toLocaleDateString('en-GB', {
    weekday:'short', day:'2-digit', month:'short', year:'numeric'
  }).toUpperCase();
  drawArc(); // keep current-time marker live
}
setInterval(tickClock, 1000);
tickClock();

/* ============== WEATHER (Open-Meteo, no API key) ============== */
const WMO_TEXT = {
  0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
  45:'Fog',48:'Fog',
  51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',
  80:'Rain showers',81:'Rain showers',82:'Violent showers',
  95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'
};
const RAIN_CODES = new Set([51,53,55,61,63,65,80,81,82,95,96,99]);

let todaySun = { sunrise:null, sunset:null };
let isRainyToday = false;

function fetchWeather(lat, lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=sunrise,sunset,weather_code&timezone=auto`;
  fetch(url)
    .then(r => r.json())
    .then(data => {
      const temp = Math.round(data.current.temperature_2m);
      const code = data.current.weather_code;
      document.getElementById('weatherTemp').textContent = `${temp}°`;
      document.getElementById('weatherCond').textContent = WMO_TEXT[code] || 'Unknown';

      const sunrise = new Date(data.daily.sunrise[0]);
      const sunset = new Date(data.daily.sunset[0]);
      todaySun = { sunrise, sunset };
      document.getElementById('weatherSun').textContent =
        `sunrise ${fmtTime(sunrise)} · sunset ${fmtTime(sunset)}`;

      isRainyToday = RAIN_CODES.has(data.daily.weather_code[0]);
      renderTasks(); // re-flag outdoor tasks now weather is known
      drawArc();
    })
    .catch(() => {
      document.getElementById('weatherCond').textContent = 'Weather unavailable';
    });
}

function fmtTime(d){
  return d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
}

if('geolocation' in navigator){
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
    () => fetchWeather(28.6139, 77.2090), // fallback: New Delhi
    { timeout: 6000 }
  );
} else {
  fetchWeather(28.6139, 77.2090);
}

/* ============== DAY ARC ============== */
function drawArc(){
  const svg = document.getElementById('arcSvg');
  const W = 1000, H = 90, trackY = 50, trackH = 14;
  let parts = [];

  // base track
  parts.push(`<rect x="0" y="${trackY}" width="${W}" height="${trackH}" rx="3" fill="#22272D" stroke="#2C3138"/>`);

  // daylight band
  if(todaySun.sunrise && todaySun.sunset){
    const x1 = (hoursOf(todaySun.sunrise)/24)*W;
    const x2 = (hoursOf(todaySun.sunset)/24)*W;
    parts.push(`<rect x="${x1}" y="${trackY}" width="${x2-x1}" height="${trackH}" rx="3" fill="#5FD3E0" opacity="0.18"/>`);
  }

  // hour ticks every 3h
  for(let h=0; h<=24; h+=3){
    const x = (h/24)*W;
    parts.push(`<line x1="${x}" y1="${trackY-4}" x2="${x}" y2="${trackY+trackH+4}" stroke="#2C3138" stroke-width="1"/>`);
  }

  // task blocks
  state.tasks.forEach(t => {
    const startH = timeStrToHours(t.time);
    const durH = t.duration/60;
    const x = (startH/24)*W;
    const w = Math.max((durH/24)*W, 4);
    const color = t.done ? '#6FCB9F' : (t.flagged ? '#FF6B6B' : '#FF9933');
    parts.push(`<rect x="${x}" y="${trackY}" width="${w}" height="${trackH}" rx="2" fill="${color}" opacity="0.9"/>`);
  });

  // current time marker
  const nowH = hoursOf(new Date());
  const nowX = (nowH/24)*W;
  parts.push(`<line x1="${nowX}" y1="10" x2="${nowX}" y2="${trackY+trackH+18}" stroke="#FF9933" stroke-width="2"/>`);
  parts.push(`<circle cx="${nowX}" cy="10" r="4" fill="#FF9933"/>`);

  svg.innerHTML = parts.join('');
}

function hoursOf(d){ return d.getHours() + d.getMinutes()/60; }
function timeStrToHours(t){
  const [h,m] = t.split(':').map(Number);
  return h + m/60;
}

/* ============== TASKS ============== */
const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const taskEmpty = document.getElementById('taskEmpty');
const taskCount = document.getElementById('taskCount');

taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  const time = document.getElementById('taskTime').value;
  const duration = parseInt(document.getElementById('taskDuration').value, 10);
  const tag = document.getElementById('taskTag').value;
  if(!title || !time) return;

  state.tasks.push({
    id: Date.now().toString(36),
    title, time, duration, tag,
    done:false, doneAt:null
  });
  saveState();
  taskForm.reset();
  document.getElementById('taskDuration').value = '30';
  renderTasks();
  drawArc();
});

function smartFlag(task){
  // heuristic, not an LLM call: outdoor task + rain forecast today => flag
  return task.tag === 'outdoor' && isRainyToday;
}

function renderTasks(){
  // sort: overdue/incomplete by time first, completed last
  const sorted = [...state.tasks].sort((a,b) => {
    if(a.done !== b.done) return a.done ? 1 : -1;
    return timeStrToHours(a.time) - timeStrToHours(b.time);
  });

  taskList.innerHTML = '';
  sorted.forEach(t => {
    t.flagged = smartFlag(t);
    const now = new Date();
    const taskMinutes = timeStrToHours(t.time)*60;
    const nowMinutes = now.getHours()*60 + now.getMinutes();
    let statusClass = 'pending', statusText = 'SCHEDULED';
    if(t.done){
      statusClass = t.onTimeFlag ? 'ontime' : 'late';
      statusText = t.onTimeFlag ? 'ON TIME' : 'LATE';
    } else if(nowMinutes > taskMinutes + t.duration){
      statusClass = 'late'; statusText = 'OVERDUE';
    }

    const li = document.createElement('li');
    li.className = 'flap-item';
    li.innerHTML = `
      <span class="flap-item__time">${t.time}</span>
      <span class="flap-item__title ${t.done ? 'is-done' : ''}">${escapeHtml(t.title)}</span>
      <span class="flap-item__tag ${t.flagged ? 'warn' : ''}">${t.flagged ? 'WET — MOVE INDOOR' : t.tag}</span>
      <span class="flap-item__status ${statusClass}">${statusText}</span>
      <span class="flap-item__actions">
        <button class="icon-btn" data-action="toggle" data-id="${t.id}" aria-label="Mark complete">✓</button>
        <button class="icon-btn" data-action="delete" data-id="${t.id}" aria-label="Delete task">✕</button>
      </span>
    `;
    taskList.appendChild(li);
  });

  taskCount.textContent = `${state.tasks.filter(t=>!t.done).length} scheduled`;
  taskEmpty.classList.toggle('show', state.tasks.length === 0);
  updateStats();
}

taskList.addEventListener('click', e => {
  const btn = e.target.closest('.icon-btn');
  if(!btn) return;
  const id = btn.dataset.id;
  const task = state.tasks.find(t => t.id === id);
  if(!task) return;

  if(btn.dataset.action === 'delete'){
    state.tasks = state.tasks.filter(t => t.id !== id);
  } else if(btn.dataset.action === 'toggle'){
    task.done = !task.done;
    if(task.done){
      task.doneAt = new Date();
      const taskMinutes = timeStrToHours(task.time)*60;
      const nowMinutes = task.doneAt.getHours()*60 + task.doneAt.getMinutes();
      task.onTimeFlag = nowMinutes <= taskMinutes + task.duration;
      state.stats.completed += 1;
      state.stats.totalDone += 1;
      if(task.onTimeFlag) state.stats.onTime += 1;
      if(state.stats.lastCompletedDay !== todayKey()){
        state.stats.streak += 1;
        state.stats.lastCompletedDay = todayKey();
      }
    } else {
      state.stats.completed = Math.max(0, state.stats.completed - 1);
    }
  }
  saveState();
  renderTasks();
  drawArc();
});

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateStats(){
  document.getElementById('statCompleted').textContent = state.stats.completed;
  const rate = state.stats.totalDone > 0
    ? Math.round((state.stats.onTime/state.stats.totalDone)*100)
    : 0;
  document.getElementById('statOnTime').textContent = `${rate}%`;
  document.getElementById('statStreak').textContent = state.stats.streak;
}

/* ============== POMODORO ============== */
const WORK_SECONDS = 25*60;
const BREAK_SECONDS = 5*60;
let pomoSeconds = WORK_SECONDS;
let pomoInterval = null;
let pomoMode = 'WORK';

const pomoMinEl = document.getElementById('pomoMin');
const pomoSecEl = document.getElementById('pomoSec');
const pomoModeEl = document.getElementById('pomoMode');
const flipClockEl = document.getElementById('flipClock');
const startBtn = document.getElementById('pomoStart');
const pauseBtn = document.getElementById('pomoPause');
const resetBtn = document.getElementById('pomoReset');

function renderPomo(){
  const m = Math.floor(pomoSeconds/60).toString().padStart(2,'0');
  const s = (pomoSeconds%60).toString().padStart(2,'0');
  pomoMinEl.textContent = m;
  pomoSecEl.textContent = s;
  pomoModeEl.textContent = pomoMode;
}

startBtn.addEventListener('click', () => {
  if(pomoInterval) return;
  flipClockEl.classList.add('is-running');
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pomoInterval = setInterval(() => {
    pomoSeconds--;
    if(pomoSeconds <= 0){
      pomoMode = pomoMode === 'WORK' ? 'BREAK' : 'WORK';
      pomoSeconds = pomoMode === 'WORK' ? WORK_SECONDS : BREAK_SECONDS;
    }
    renderPomo();
  }, 1000);
});

pauseBtn.addEventListener('click', () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
  flipClockEl.classList.remove('is-running');
  startBtn.disabled = false;
  pauseBtn.disabled = true;
});

resetBtn.addEventListener('click', () => {
  clearInterval(pomoInterval);
  pomoInterval = null;
  pomoMode = 'WORK';
  pomoSeconds = WORK_SECONDS;
  flipClockEl.classList.remove('is-running');
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  renderPomo();
});

renderPomo();

/* ============== QUOTE TICKER ============== */
// NOTE: public quote APIs vary in uptime/CORS support — fall back to a
// local bank so the board never shows a broken/empty footer.
const QUOTE_FALLBACK = [
  "Discipline equals freedom.",
  "Small steps, every day, beat big plans you never start.",
  "The plan is only real once it's on the board.",
  "On time today builds the streak for tomorrow.",
  "Done is better than perfect, scheduled is better than hoped."
];

function loadQuote(){
  fetch('https://api.quotable.io/random?maxLength=90')
    .then(r => {
      if(!r.ok) throw new Error('quote api error');
      return r.json();
    })
    .then(data => {
      setTicker(`"${data.content}" — ${data.author}`);
    })
    .catch(() => {
      const q = QUOTE_FALLBACK[Math.floor(Math.random()*QUOTE_FALLBACK.length)];
      setTicker(q);
    });
}

function setTicker(text){
  document.getElementById('tickerText').textContent = `${text}        •        ${text}`;
}

loadQuote();

/* ============== INITIAL RENDER ============== */
renderTasks();
drawArc();
