/* =========================================================
   یکی‌یدونم — منطق سایت
   LETTERS و HIDDEN_LETTERS از letters.js می‌آیند
   ========================================================= */

const STORAGE = {
  start:  'll_start_date',
  opened: 'll_opened_ids',
  hidden: 'll_hidden_found',
  musicClicks: 'll_music_clicks',
};

const TOTAL_LETTERS = LETTERS.length; // 120
const SECRET_WORD = 'نازنین'; // ایستر اگ: تایپ این کلمه در هر جای صفحه

/* ---------- تاریخ شروع + محاسبه‌ی نامه‌های در دسترس ---------- */
function getStartDate(){
  let raw = localStorage.getItem(STORAGE.start);
  if(!raw){
    raw = new Date().toISOString();
    localStorage.setItem(STORAGE.start, raw);
  }
  return new Date(raw);
}

function daysSinceStart(){
  const start = getStartDate();
  const now = new Date();
  const diff = Math.floor((stripTime(now) - stripTime(start)) / 86400000);
  return Math.max(0, diff);
}
function stripTime(d){
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function availableCount(){
  // نامه‌ی شماره ۱ همان روز اول باز است؛ هر روز بعد، یک نامه‌ی دیگر
  return Math.min(TOTAL_LETTERS, daysSinceStart() + 1);
}

/* ---------- ذخیره‌سازی نامه‌های خوانده‌شده ---------- */
function getOpenedIds(){
  try{ return JSON.parse(localStorage.getItem(STORAGE.opened)) || []; }
  catch(e){ return []; }
}
function markOpened(id){
  const opened = getOpenedIds();
  if(!opened.includes(id)){
    opened.push(id);
    localStorage.setItem(STORAGE.opened, JSON.stringify(opened));
  }
  refreshCounts();
}
function isOpened(id){ return getOpenedIds().includes(id); }

function getHiddenFound(){
  try{ return JSON.parse(localStorage.getItem(STORAGE.hidden)) || []; }
  catch(e){ return []; }
}
function markHiddenFound(id){
  const found = getHiddenFound();
  if(!found.includes(id)){
    found.push(id);
    localStorage.setItem(STORAGE.hidden, JSON.stringify(found));
  }
}

/* ---------- به‌روزرسانی شمارنده‌ها ---------- */
function toPersianDigits(n){
  return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

function refreshCounts(){
  const opened = getOpenedIds().filter(id => typeof id === 'number');
  const pct = Math.round((opened.length / TOTAL_LETTERS) * 100);

  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    `${toPersianDigits(opened.length)} از ${toPersianDigits(TOTAL_LETTERS)}`;

  document.getElementById('openedCount').textContent = toPersianDigits(opened.length);
  document.getElementById('dayCount').textContent = toPersianDigits(daysSinceStart() + 1);
}

/* ---------- ساخت جدول نامه‌ها ---------- */
function buildGrid(){
  const grid = document.getElementById('lettersGrid');
  grid.innerHTML = '';
  const avail = availableCount();
  const opened = getOpenedIds();

  LETTERS.forEach(letter => {
    const item = document.createElement('button');
    item.className = 'letters-grid__item';
    item.setAttribute('type', 'button');

    const isOpen = opened.includes(letter.id);
    const isUnlocked = letter.id <= avail;
    const isToday = letter.id === avail && !isOpen;

    if(isOpen) item.classList.add('is-open');
    else if(!isUnlocked) item.classList.add('is-locked');
    if(isToday) item.classList.add('is-today');

    item.innerHTML = `
      <span class="mark">${isUnlocked ? (isOpen ? '💌' : '✉') : '🔒'}</span>
      <span class="num">${toPersianDigits(letter.id)}</span>
    `;

    item.addEventListener('click', () => {
      if(!isUnlocked){
        showToast('این نامه هنوز روزش نرسیده… کمی صبر کن 🤍');
        return;
      }
      openLetterModal(letter.id, isOpen);
    });

    grid.appendChild(item);
  });
}

/* ---------- مودال + انیمیشن پاکت ---------- */
const modal = document.getElementById('letterModal');
const envelope = document.getElementById('envelope');
const letterCard = document.getElementById('letterCard');
const seal = document.getElementById('envelopeSeal');

let typewriterTimer = null;

function findLetterById(id){
  if(typeof id === 'number') return LETTERS.find(l => l.id === id);
  return HIDDEN_LETTERS.find(l => l.id === id);
}

function openLetterModal(id, alreadyOpened){
  const letter = findLetterById(id);
  if(!letter) return;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  envelope.classList.remove('is-opening', 'is-open');
  letterCard.hidden = true;

  if(alreadyOpened){
    // برای نامه‌های خوانده‌شده، مستقیم کارت را نشان بده
    envelope.classList.add('is-open');
    showLetterCard(letter, false);
  }else{
    seal.style.display = '';
    envelope.style.display = '';
  }

  seal.onclick = () => {
    envelope.classList.add('is-opening');
    setTimeout(() => {
      envelope.classList.add('is-open');
      showLetterCard(letter, true);
      if(typeof letter.id === 'number') markOpened(letter.id);
      else { markHiddenFound(letter.id); markOpened(letter.id); }
      buildGrid();
    }, 650);
  };
}

function showLetterCard(letter, animateText){
  letterCard.hidden = false;
  document.getElementById('letterNumber').textContent =
    typeof letter.id === 'number' ? `نامه‌ی شماره‌ی ${toPersianDigits(letter.id)}` : 'نامه‌ی پنهان';
  document.getElementById('letterTitle').textContent = letter.title;

  const bodyEl = document.getElementById('letterBody');
  clearTimeout(typewriterTimer);

  if(!animateText){
    bodyEl.textContent = letter.text;
    return;
  }

  bodyEl.textContent = '';
  const caret = document.createElement('span');
  caret.className = 'caret';
  bodyEl.appendChild(caret);

  const text = letter.text;
  let i = 0;
  const speed = 16;

  function typeNext(){
    if(i < text.length){
      caret.insertAdjacentText('beforebegin', text[i]);
      i++;
      typewriterTimer = setTimeout(typeNext, speed);
    }else{
      caret.remove();
    }
  }
  typeNext();
}

function closeModal(){
  modal.hidden = true;
  document.body.style.overflow = '';
  clearTimeout(typewriterTimer);
}

document.getElementById('closeLetterBtn').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', e => { if(e.key === 'Escape' && !modal.hidden) closeModal(); });

/* ---------- ناوبری بین صفحه‌ها ---------- */
const heroScreen = document.getElementById('heroScreen');
const vaultScreen = document.getElementById('vaultScreen');

document.getElementById('enterBtn').addEventListener('click', () => {
  heroScreen.hidden = true;
  vaultScreen.hidden = false;
  buildGrid();
  window.scrollTo(0,0);
});
document.getElementById('backBtn').addEventListener('click', () => {
  vaultScreen.hidden = true;
  heroScreen.hidden = false;
  window.scrollTo(0,0);
});

/* ---------- toast ---------- */
let toastTimer = null;
function showToast(msg){
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* =========================================================
   ایستر اگ‌های نامه‌های پنهان (۵ مکانیزم)
   ========================================================= */
function unlockHidden(hid, message){
  if(getHiddenFound().includes(hid)) return;
  showToast(message);
  setTimeout(() => openLetterModal(hid, false), 900);
}

// ۱) سه بار کلیک روی عنوان بالای صفحه
let logoClicks = 0, logoClickTimer = null;
document.getElementById('logo3').addEventListener('click', () => {
  logoClicks++;
  clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(() => (logoClicks = 0), 900);
  if(logoClicks >= 3){
    logoClicks = 0;
    unlockHidden('h1', 'یک نامه‌ی پنهان پیدا کردی 🤎');
  }
});

// ۲) کلیک روی قلب مخفی گوشه‌ی صفحه
document.getElementById('secretHeart').addEventListener('click', () => {
  unlockHidden('h2', 'یک راز کوچک پیدا شد… 💌');
});

// ۳) تایپ کلمه‌ی رمز در هر جای صفحه
let typedBuffer = '';
document.addEventListener('keyup', (e) => {
  if(e.key.length > 1) return; // کلیدهای خاص را نادیده بگیر
  typedBuffer += e.key;
  typedBuffer = typedBuffer.slice(-SECRET_WORD.length);
  if(typedBuffer === SECRET_WORD){
    unlockHidden('h3', 'اسمت را نوشتی و یک نامه باز شد 🤍');
  }
});

// ۴) رسیدن به انتهای جدول نامه‌ها (اسکرول کامل)
let scrollUnlocked = false;
window.addEventListener('scroll', () => {
  if(vaultScreen.hidden || scrollUnlocked) return;
  const scrolledToBottom =
    window.innerHeight + window.scrollY >= document.body.scrollHeight - 40;
  if(scrolledToBottom){
    scrollUnlocked = true;
    unlockHidden('h4', 'تا انتها رفتی… یک هدیه‌ی کوچک برایت 🌙');
  }
});

// ۵) پنج بار کلیک روی دکمه‌ی موسیقی
let musicClicks = parseInt(localStorage.getItem(STORAGE.musicClicks) || '0', 10);
function bumpMusicClicks(){
  musicClicks++;
  localStorage.setItem(STORAGE.musicClicks, String(musicClicks));
  if(musicClicks === 5){
    unlockHidden('h5', 'انگار موسیقی را دوست داری… یک نامه‌ی مخفی دیگر 🎵');
  }
}

/* =========================================================
   موسیقی پس‌زمینه‌ی ملایم (سینت داخلی، بدون فایل خارجی)
   ========================================================= */
let audioCtx = null, musicNodes = null, isPlaying = false;

function startAmbientMusic(){
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.05;
  masterGain.connect(audioCtx.destination);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.connect(masterGain);

  const notes = [220, 261.63, 329.63, 392]; // A3, C4, E4, G4 — آکورد آرام
  const oscillators = notes.map((freq, idx) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    // فید نرم ورود هر نت، با کمی تاخیر پلکانی
    g.gain.linearRampToValueAtTime(0.18, audioCtx.currentTime + 1.2 + idx * 0.6);
    return { osc, g };
  });

  musicNodes = { masterGain, filter, oscillators };
}

function stopAmbientMusic(){
  if(!audioCtx) return;
  musicNodes.oscillators.forEach(({g}) => {
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
  });
  setTimeout(() => { audioCtx.close(); audioCtx = null; }, 700);
}

document.getElementById('musicToggle').addEventListener('click', function(){
  isPlaying = !isPlaying;
  this.classList.toggle('is-playing', isPlaying);
  document.getElementById('musicIcon').textContent = isPlaying ? '❚❚' : '♪';
  if(isPlaying) startAmbientMusic(); else stopAmbientMusic();
  bumpMusicClicks();
});

/* =========================================================
   قلب‌های شناور (canvas)
   ========================================================= */
(function heartsBackground(){
  const canvas = document.getElementById('heartsCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, hearts = [];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function makeHeart(){
    return {
      x: Math.random() * w,
      y: h + 20 + Math.random() * h,
      size: 6 + Math.random() * 12,
      speed: 0.25 + Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 0.4,
      opacity: 0.08 + Math.random() * 0.22,
      hueMaroon: Math.random() > 0.5,
    };
  }

  const COUNT = reduceMotion ? 0 : 26;
  for(let i=0;i<COUNT;i++) hearts.push(makeHeart());

  function drawHeart(x, y, size, opacity, maroon){
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = maroon ? '#a5203f' : '#cda45e';
    ctx.beginPath();
    const s = size / 16;
    ctx.moveTo(0, 4*s);
    ctx.bezierCurveTo(0, 2*s, -6*s, -6*s, -8*s, -1*s);
    ctx.bezierCurveTo(-10*s, 4*s, -4*s, 8*s, 0, 12*s);
    ctx.bezierCurveTo(4*s, 8*s, 10*s, 4*s, 8*s, -1*s);
    ctx.bezierCurveTo(6*s, -6*s, 0, 2*s, 0, 4*s);
    ctx.fill();
    ctx.restore();
  }

  function tick(){
    ctx.clearRect(0,0,w,h);
    hearts.forEach(pt => {
      pt.y -= pt.speed;
      pt.x += pt.drift;
      if(pt.y < -20){ Object.assign(pt, makeHeart(), { y: h + 20 }); }
      drawHeart(pt.x, pt.y, pt.size, pt.opacity, pt.hueMaroon);
    });
    requestAnimationFrame(tick);
  }
  if(!reduceMotion) tick();
})();

/* ---------- init ---------- */
refreshCounts();
