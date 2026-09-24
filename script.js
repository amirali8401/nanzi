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
  const allOriginalsFound = ORIGINAL_HIDDEN_IDS.every(h => found.includes(h));
  if(allOriginalsFound && !found.includes('h6')){
    setTimeout(() => unlockHidden('h6', 'همه‌ی رازها را پیدا کردی… یک نامه‌ی آخر هم هست 🕊️'), 1400);
  }
}

/* ---------- به‌روزرسانی شمارنده‌ها ---------- */
function toPersianDigits(n){
  return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function animateNumber(el, to){
  const from = parseInt(el.dataset.raw || '0', 10);
  el.dataset.raw = to;
  if(from === to || reduceMotionQuery.matches){
    el.textContent = toPersianDigits(to);
    return;
  }
  const duration = 550;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = toPersianDigits(Math.round(from + (to - from) * eased));
    if(t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function refreshCounts(){
  const opened = getOpenedIds().filter(id => typeof id === 'number');
  const pct = Math.round((opened.length / TOTAL_LETTERS) * 100);

  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    `${toPersianDigits(opened.length)} از ${toPersianDigits(TOTAL_LETTERS)}`;

  animateNumber(document.getElementById('openedCount'), opened.length);
  animateNumber(document.getElementById('dayCount'), daysSinceStart() + 1);
}

/* ---------- ساخت جدول نامه‌ها ---------- */
let gridObserver = null;

function buildGrid(){
  const grid = document.getElementById('lettersGrid');
  grid.innerHTML = '';
  const avail = availableCount();
  const opened = getOpenedIds();

  if(gridObserver) gridObserver.disconnect();
  gridObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('in-view');
        gridObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  LETTERS.forEach((letter, index) => {
    const item = document.createElement('button');
    item.className = 'letters-grid__item';
    item.setAttribute('type', 'button');

    const isOpen = opened.includes(letter.id);
    const isUnlocked = letter.id <= avail;
    const isToday = letter.id === avail && !isOpen;

    if(isOpen) item.classList.add('is-open');
    else if(!isUnlocked) item.classList.add('is-locked');
    if(isToday) item.classList.add('is-today');

    // ورود پلکانی هر خانه، با کمی تاخیر بر اساس ردیف
    item.style.setProperty('--delay', Math.min(index * 0.015, 0.5) + 's');
    item.style.setProperty('--final-opacity', isUnlocked ? '1' : '.55');

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

    attachTilt(item);
    grid.appendChild(item);
    gridObserver.observe(item);
  });
}

/* ---------- افکت کج‌شدن سه‌بعدی هنگام هاور (فقط ماوس) ---------- */
function attachTilt(el){
  if(window.matchMedia('(pointer: coarse)').matches) return;
  if(reduceMotionQuery.matches) return;

  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-4px) rotateX(${(-py * 16).toFixed(2)}deg) rotateY(${(px * 16).toFixed(2)}deg)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
  });
}

/* ---------- دکمه‌ی «مغناطیسی» که کمی دنبال نشانگر ماوس می‌رود ---------- */
function attachMagnetic(el, strength = 12){
  if(window.matchMedia('(pointer: coarse)').matches) return;
  if(reduceMotionQuery.matches) return;

  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    const y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    el.style.transform = `translate(${(x * strength).toFixed(1)}px, ${(y * strength).toFixed(1)}px)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
}
attachMagnetic(document.getElementById('enterBtn'));

/* ---------- ذرات قلب هنگام باز شدن هر پاکت ---------- */
function spawnHeartBurst(x, y){
  if(reduceMotionQuery.matches) return;
  const count = 10;
  for(let i = 0; i < count; i++){
    const span = document.createElement('span');
    span.className = 'heart-burst';
    span.textContent = '♥';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dist = 55 + Math.random() * 55;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 10;
    span.style.left = x + 'px';
    span.style.top = y + 'px';
    span.style.setProperty('--burst-transform', `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.2)`);
    span.style.animationDelay = (Math.random() * 0.06) + 's';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 1000);
  }
}

/* ---------- ردِ قلب دنبال نشانگر ماوس، فقط روی صفحه‌ی اول ---------- */
(function cursorHeartTrail(){
  if(window.matchMedia('(pointer: coarse)').matches) return;
  if(reduceMotionQuery.matches) return;
  let last = 0;
  document.getElementById('heroScreen').addEventListener('mousemove', (e) => {
    const now = Date.now();
    if(now - last < 180) return;
    last = now;
    const span = document.createElement('span');
    span.className = 'cursor-heart';
    span.textContent = '♥';
    span.style.left = e.clientX + 'px';
    span.style.top = e.clientY + 'px';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 900);
  });
})();

/* ---------- مودال + انیمیشن پاکت ---------- */
const modal = document.getElementById('letterModal');
const envelope = document.getElementById('envelope');
const letterCard = document.getElementById('letterCard');
const seal = document.getElementById('envelopeSeal');

let typewriterTimer = null;

function findLetterById(id){
  if(typeof id === 'number') return LETTERS.find(l => l.id === id);
  if(id === 'sos') return SOS_LETTER;
  if(id === 'capsule') return TIME_CAPSULE;
  return HIDDEN_LETTERS.find(l => l.id === id);
}

function openLetterModal(id, alreadyOpened, opts){
  const skipEnvelope = opts && opts.skipEnvelope;
  const letter = findLetterById(id);
  if(!letter) return;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  envelope.classList.remove('is-opening', 'is-open');
  seal.classList.remove('is-melting');
  letterCard.hidden = true;

  if(alreadyOpened || skipEnvelope){
    // برای نامه‌های خوانده‌شده یا نامه‌های فوری (SOS)، مستقیم کارت را نشان بده
    envelope.classList.add('is-open');
    showLetterCard(letter, !alreadyOpened);
    if(skipEnvelope && !alreadyOpened && typeof letter.id !== 'number'){
      markOpened(letter.id);
    }
  }else{
    seal.style.display = '';
    envelope.style.display = '';
  }

  seal.onclick = () => {
    const r = seal.getBoundingClientRect();
    spawnHeartBurst(r.left + r.width / 2, r.top + r.height / 2);
    seal.classList.add('is-melting');

    setTimeout(() => {
      envelope.classList.add('is-opening');
    }, 180);

    setTimeout(() => {
      envelope.classList.add('is-open');
      showLetterCard(letter, true);
      if(typeof letter.id === 'number'){
        markOpened(letter.id);
      }else if(HIDDEN_LETTERS.some(h => h.id === letter.id)){
        markHiddenFound(letter.id);
        markOpened(letter.id);
      }else{
        markOpened(letter.id);
      }
      buildGrid();
      refreshCapsuleCard();
    }, 800);
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
  clearTimeout(typewriterTimer);
  if(reduceMotionQuery.matches){
    modal.hidden = true;
    document.body.style.overflow = '';
    return;
  }
  modal.classList.add('is-closing');
  setTimeout(() => {
    modal.hidden = true;
    modal.classList.remove('is-closing');
    document.body.style.overflow = '';
  }, 250);
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
  refreshCapsuleCard();
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
   دکمه‌ی SOS دلتنگی
   ========================================================= */
document.getElementById('sosButton').addEventListener('click', () => {
  openLetterModal('sos', isOpened('sos'), { skipEnvelope: true });
});

/* =========================================================
   دکمه‌ی «یه دلیل تصادفی بده»
   ========================================================= */
(function reasonButton(){
  const btn = document.getElementById('reasonBtn');
  const textEl = document.getElementById('reasonText');
  let lastIndex = -1;

  btn.addEventListener('click', () => {
    let idx;
    do{ idx = Math.floor(Math.random() * REASONS.length); }
    while(idx === lastIndex && REASONS.length > 1);
    lastIndex = idx;

    textEl.classList.remove('show');
    setTimeout(() => {
      textEl.textContent = REASONS[idx];
      textEl.classList.add('show');
    }, reduceMotionQuery.matches ? 0 : 180);
  });
})();

/* =========================================================
   کپسول زمان
   ========================================================= */
function getCapsuleUnlockDate(){
  if(TIME_CAPSULE.fixedUnlockDate) return new Date(TIME_CAPSULE.fixedUnlockDate);
  const start = getStartDate();
  return new Date(start.getTime() + TIME_CAPSULE.fallbackDaysFromStart * 86400000);
}

function refreshCapsuleCard(){
  const card = document.getElementById('capsuleCard');
  const statusEl = document.getElementById('capsuleStatus');
  const unlockDate = getCapsuleUnlockDate();
  const now = new Date();
  const opened = isOpened('capsule');

  card.classList.toggle('is-opened', opened);

  if(opened){
    statusEl.textContent = 'باز شد — دوباره می‌توانی بخوانی‌اش';
    card.classList.remove('is-ready');
    return;
  }

  const diffMs = unlockDate - now;
  if(diffMs <= 0){
    statusEl.textContent = 'باز است — همین حالا بازش کن';
    card.classList.add('is-ready');
  }else{
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    statusEl.textContent = days > 0
      ? `${toPersianDigits(days)} روز و ${toPersianDigits(hours)} ساعت تا باز شدن`
      : `${toPersianDigits(hours)} ساعت تا باز شدن`;
    card.classList.remove('is-ready');
  }
}

document.getElementById('capsuleCard').addEventListener('click', () => {
  const unlockDate = getCapsuleUnlockDate();
  if(new Date() < unlockDate && !isOpened('capsule')){
    showToast('کپسول هنوز زمانش نرسیده… صبر کن 🤍');
    return;
  }
  openLetterModal('capsule', isOpened('capsule'));
});

setInterval(refreshCapsuleCard, 60000);


/* =========================================================
   آسمون شب پرستاره (پشت صحنه)
   ========================================================= */
(function starfield(){
  const canvas = document.getElementById('starsCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, stars = [], shootingStars = [];
  const reduceMotion = reduceMotionQuery.matches;

  function resize(){
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const STAR_COUNT = reduceMotion ? 40 : 90;
  for(let i = 0; i < STAR_COUNT; i++){
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.2,
    });
  }

  function maybeSpawnShootingStar(){
    if(reduceMotion) return;
    if(Math.random() < 0.002 && shootingStars.length < 1){
      shootingStars.push({
        x: Math.random() * w * 0.6, y: -10,
        vx: 5 + Math.random() * 3,
        vy: 3 + Math.random() * 2,
        life: 1,
      });
    }
  }

  function tick(t){
    ctx.clearRect(0, 0, w, h);

    stars.forEach(s => {
      const twinkle = 0.5 + 0.5 * Math.sin(t / 1000 * s.speed + s.phase);
      ctx.globalAlpha = 0.25 + twinkle * 0.55;
      ctx.fillStyle = '#f4ece4';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    maybeSpawnShootingStar();
    shootingStars.forEach(st => {
      ctx.globalAlpha = st.life;
      const grad = ctx.createLinearGradient(st.x, st.y, st.x - st.vx * 6, st.y - st.vy * 6);
      grad.addColorStop(0, '#e3c88a');
      grad.addColorStop(1, 'rgba(227,200,138,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(st.x - st.vx * 6, st.y - st.vy * 6);
      ctx.stroke();
      st.x += st.vx; st.y += st.vy; st.life -= 0.02;
    });
    shootingStars = shootingStars.filter(st => st.life > 0 && st.y < h + 20);

    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* یک آرزوی کوچک، با کلیک روی جای خالی آسمانِ صفحه‌ی اول */
document.getElementById('heroScreen').addEventListener('click', (e) => {
  if(e.target.closest('.hero__content')) return;
  showToast(STAR_WISHES[Math.floor(Math.random() * STAR_WISHES.length)]);
});

(function heartsBackground(){
  const canvas = document.getElementById('heartsCanvas');
  const ctx = canvas.getContext('2d');
  let w, h, hearts = [], petals = [];
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

  function makePetal(){
    return {
      x: Math.random() * w,
      y: -20 - Math.random() * h,
      size: 8 + Math.random() * 10,
      speed: 0.4 + Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 0.6,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.02,
      opacity: 0.12 + Math.random() * 0.25,
      swayPhase: Math.random() * Math.PI * 2,
    };
  }

  const HEART_COUNT = reduceMotion ? 0 : 16;
  const PETAL_COUNT = reduceMotion ? 0 : 14;
  for(let i=0;i<HEART_COUNT;i++) hearts.push(makeHeart());
  for(let i=0;i<PETAL_COUNT;i++) petals.push(makePetal());

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

  function drawPetal(p){
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = '#c9536f';
    ctx.beginPath();
    const s = p.size / 10;
    ctx.moveTo(0, -6*s);
    ctx.bezierCurveTo(4*s, -4*s, 4*s, 4*s, 0, 6*s);
    ctx.bezierCurveTo(-4*s, 4*s, -4*s, -4*s, 0, -6*s);
    ctx.fill();
    ctx.restore();
  }

  let t = 0;
  function tick(){
    t += 1;
    ctx.clearRect(0,0,w,h);

    hearts.forEach(pt => {
      pt.y -= pt.speed;
      pt.x += pt.drift;
      if(pt.y < -20){ Object.assign(pt, makeHeart(), { y: h + 20 }); }
      drawHeart(pt.x, pt.y, pt.size, pt.opacity, pt.hueMaroon);
    });

    petals.forEach(p => {
      p.y += p.speed;
      p.x += Math.sin(t / 60 + p.swayPhase) * 0.6;
      p.angle += p.spin;
      if(p.y > h + 20){ Object.assign(p, makePetal(), { y: -20 }); }
      drawPetal(p);
    });

    requestAnimationFrame(tick);
  }
  if(!reduceMotion) tick();
})();

/* ---------- init ---------- */
refreshCounts();
refreshCapsuleCard();

