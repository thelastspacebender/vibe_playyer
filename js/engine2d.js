// js/engine2d.js - Complete Multi-Universe 2D Canvas Engine
// Worlds: 2D City Skyline (Atmospheric, Traffic, Pedestrians, Lit Windows, Audio Events)
//         2D Snowy North (Aurora, Mountains, Falling Snow, Dragons, Giants, Village, Merchant)
//         2D Medieval Village (Castle, River, Rotating Mill, Troll, Spellcasting Mage, Banners)

import { getCurrentLanguage } from './i18n.js';

const NB = 24;
let cv, ctx;
let DPR = 1, W = 800, H = 600, HZ = 400, GH = 200, S = 1;
let R = Math.random;

// World & Layer State
let backdrop = null, layers = [], ground = null, fant = null, stars = [], clouds = [];
let plane = null, nextPlane = 40, meteor = null, nextMeteor = 150, birds = null, nextBirds = 30;
let pShown = null, cyc0 = performance.now() / 1000, ph0 = 0.2;
let fx = [], lastPhrase = '', nextStar = null, nextBubble = null, lastStarT = -99, lastBubbleT = -99;

// Color Palettes
const WIN_COLORS = ['#ffcf7f', '#fff0c8', '#a9d8ff', '#7fe9dc'];
const CAR_COLORS = ['#d8403c', '#ececec', '#2e5ea6', '#3b3d46', '#8b909a', '#5aa96a', '#c7692a', '#f2c230', '#f2c230', '#f2c230', '#33b9cc', '#e85a5a', '#6b4aa0', '#9cc23a'];
const SHIRTS = ['#e0574f', '#3e7cc9', '#f0c23e', '#59b36b', '#e8e8e8', '#b45fc4', '#f08a3c', '#2f3a4f'];
const PANTS = ['#2b3346', '#3d4d6b', '#5b4a3a', '#1f1f24', '#7a8296'];
const SKIN = ['#f1c7a3', '#d9a27a', '#a8714c', '#7a4e33'];
const CLOAKS = ['#6b4f3a', '#5a6b4a', '#4a5470', '#7a3b3b', '#8a7a5a', '#3f4a3a', '#5c3f5f'];
const F_SHIELD = '#7a3b2e';

// Math & Color Utilities (Hoisted)
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
function mixc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
function rgb(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function shade(h, k) { return rgb(mixc(hex(h), [8, 10, 26], k)); }
function smooth(a, b, x) { const k = Math.max(0, Math.min(1, (x - a) / (b - a))); return k * k * (3 - 2 * k); }
function rnd(a, b) { return a + R() * (b - a); }
function pickColor() { const q = R(); return q < .58 ? 0 : q < .8 ? 1 : q < .95 ? 2 : 3; }

const GPAL = {
  night: { side: '#191b2d', road: '#0e1020', dash: 'rgba(220,220,200,.32)', yellow: 'rgba(214,176,60,.5)', zebra: 'rgba(220,220,210,.28)', signal: '#05060c', curb: '#23253b', grass0: '#0c1b17', grass1: '#07120e', path: '#1c1e2f',
    trunk: '#120d0c', crowns: ['#0d211b', '#10281f', '#0b1c17'], conifer: '#08180f', pole: '#06070f', bench: '#140f0d', bush: ['#0b1d15', '#0e2219'] },
  day: { side: '#bdb7aa', road: '#4b4e58', dash: 'rgba(255,255,255,.88)', yellow: '#e9c22e', zebra: 'rgba(250,250,245,.92)', signal: '#2d323c', curb: '#d3cdbf', grass0: '#6aa756', grass1: '#4f8c42', path: '#d9caa4',
    trunk: '#6b4a32', crowns: ['#3f8a45', '#4f9c4f', '#2f7a3e'], conifer: '#245c33', pole: '#3a3f4a', bench: '#7a5636', bush: ['#3a7a3c', '#468a42'] }
};

const SKY = {
  night: [hex('#04061a'), hex('#0c1440'), hex('#2a2c5c')],
  day:   [hex('#2b74d6'), hex('#6aaced'), hex('#d4e9f8')],
  dusk:  [hex('#2a346e'), hex('#9a6c9e'), hex('#ffa06a')]
};
const SKY_N = {
  night: [hex('#030714'), hex('#0a1636'), hex('#1d2b52')],
  day:   [hex('#4d86c9'), hex('#9fc3e6'), hex('#e3edf6')],
  dusk:  [hex('#2b3570'), hex('#8b6f9e'), hex('#f2a27a')]
};
const SKY_M = {
  night: [hex('#05061a'), hex('#111a3d'), hex('#2c2d55')],
  day:   [hex('#3f7fcf'), hex('#8fbfe8'), hex('#efe6cc')],
  dusk:  [hex('#2f3068'), hex('#a3688e'), hex('#ff9a5e')]
};

const HAZE_N = hex('#28296a'), HAZE_D = hex('#cfdff0');
const BHAZE = [200, 218, 236];

const FACADES = [
  { d: '#8e4a3d', g: 'rgba(38,34,44,.55)' }, { d: '#a65b46', g: 'rgba(42,36,46,.5)' }, { d: '#7a3f36', g: 'rgba(36,30,40,.55)' },
  { d: '#cdb894', g: 'rgba(70,78,92,.5)' }, { d: '#bfae8c', g: 'rgba(66,72,86,.5)' },
  { d: '#b8b5ab', g: 'rgba(72,86,104,.5)' }, { d: '#9a9a96', g: 'rgba(60,72,90,.5)' }
];
const TOWERS = [
  { d: '#7d8ea3', g: 'rgba(214,232,250,.55)' }, { d: '#5b6e86', g: 'rgba(190,216,242,.5)' },
  { d: '#e6e4de', g: 'rgba(110,132,160,.55)' }, { d: '#3e5068', g: 'rgba(150,186,222,.5)' }, { d: '#d9d3c4', g: 'rgba(96,116,140,.5)' }
];

const LAYER_CFG = [
  { body: '#1b2150', rim: 'rgba(160,170,255,.10)', glass: 'rgba(90,104,180,.16)',
    wMin: 22, wMax: 58, hMin: .16, hMax: .42, gapMin: -6, gapMax: 4, win: { w: 2, h: 2, gx: 3, gy: 4, m: 4, top: 6 }, alpha: .55, roofP: .15, tall: 0, haze: .5, far: true },
  { body: '#11163d', rim: 'rgba(160,170,255,.12)', glass: 'rgba(80,96,180,.15)',
    wMin: 36, wMax: 96, hMin: .22, hMax: .58, gapMin: -10, gapMax: 6, win: { w: 3, h: 4, gx: 4, gy: 6, m: 6, top: 10 }, alpha: .8, roofP: .3, tall: .04, haze: .26 },
  { body: '#070a1f', rim: 'rgba(180,190,255,.14)', glass: 'rgba(70,88,170,.14)',
    wMin: 60, wMax: 150, hMin: .2, hMax: .7, gapMin: 4, gapMax: 44, win: { w: 5, h: 7, gx: 6, gy: 9, m: 9, top: 14 }, alpha: 1, roofP: .45, tall: .09, haze: .04, tower: true }
];

// Localized Thought Bubbles
const LOCAL_PHRASES = {
  en: {
    city: {
      any: ['What a beautiful evening!', 'This music is so relaxing…', 'Just one more day until the weekend', 'Did you hear that?', 'So peaceful here',
            'I really love this city ❤', 'Is this park new?', 'Great rhythm and vibes ♪', 'Finding parking here is impossible!', 'The coastline looks incredible today'],
      day: ['Morning jog done ✔', 'Perfect day for a walk in the park', 'Warm sunny afternoon!'],
      night: ['The skyline looks magical at night ✨', 'Look at that moon!', 'Heading home after a long productive day']
    },
    north: {
      any: ['I heard rumors of a dragon over the high peaks…', 'This northern frost bites deep', 'Has anyone spotted the giant near the pine ridge?', 'The tavern fire is burning warm tonight'],
      day: ['Good weather for the village trading post', 'The sun finally peeked through the snow clouds'],
      night: ['Look at the dancing lights in the northern sky!', 'Nobody wanders far beyond the village after dark']
    },
    medieval: {
      any: ['Monsters roaming the dark forest again…', 'The court wizard is casting experiments again', 'Did you spot the griffin above the fortress?', 'Is the tavern cellar open tonight?'],
      day: ['A fine day for harvesting the fields', 'The central market is bustling today'],
      night: ['Stay clear of the marshlands tonight!', 'Hark, strange howls coming from across the river…']
    }
  },
  ru: {
    city: {
      any: ['Какой прекрасный вечер!', 'Эта музыка так успокаивает…', 'Ещё один день до выходных', 'Вы слышали этот бит?', 'Как же здесь приятно',
            'Обожаю этот город ❤', 'Парк отлично обновили', 'Классная музыка ♪', 'С парковкой тут вечная беда!', 'Вид на залив сегодня просто потрясающий'],
      day: ['Утренняя пробежка ✔', 'Идеальный день для прогулки', 'Теплый солнечный день!'],
      night: ['Ночной скайлайн выглядит волшебно ✨', 'Какая луна!', 'Иду домой после насыщенного дня']
    },
    north: {
      any: ['Говорят, дракона видели над снежными пиками…', 'Мороз пробирает до костей', 'Кто-то видел великана у хребта?', 'В таверне сегодня жарко горит очаг'],
      day: ['Отличный день для торговли у лавки', 'Солнце наконец пробилось сквозь снег'],
      night: ['Посмотрите на сияние в северном небе!', 'Ночью за пределы деревни лучше не выходить']
    },
    medieval: {
      any: ['В лесу снова рыщут чудища…', 'Маг опять ставит свои тайные опыты', 'Видели грифона над замком?', 'Таверна открыта до рассвета?'],
      day: ['Отличный день для работы в поле', 'На городской площади сегодня шумно'],
      night: ['Не подходите к топи в темноте!', 'Слышите вой с того берега реки…']
    }
  },
  he: {
    city: {
      any: ['איזה ערב יפה!', 'המוזיקה הזו מרגיעה…', 'רק עוד יום אחד לסופ״ש', 'שמעת את זה?', 'נעים פה',
            'אני אוהב את העיר הזאת ❤', 'הפארק הזה חדש?', 'המוזיקה הזאת מעולה ♪', 'חנייה? אין דבר כזה פה', 'הים נראה מדהים היום'],
      day: ['ריצת בוקר ✔', 'יום מושלם לפיקניק', 'חם היום!'],
      night: ['העיר יפה בלילה ✨', 'איזה ירח!', 'הולך הביתה, יום ארוך']
    },
    north: {
      any: ['שמעתי שראו דרקון מעל ההרים…', 'הקור הזה חודר לעצמות', 'מישהו ראה את הענק ליד הנחל?', 'המשקה בבית המרזח חם ומעולה'],
      day: ['יום טוב למסחר', 'השמש סוף סוף יצאה'],
      night: ['תראו את האורות בשמיים!', 'לא יוצאים מהכפר בלילה']
    },
    medieval: {
      any: ['שוב מפלצות ביער…', 'הקוסם שוב עושה ניסויים', 'ראיתם את הגריפון מעל הטירה?', 'הטברנה פתוחה הלילה?'],
      day: ['יום יפה לקציר', 'השוק מלא היום'],
      night: ['אל תתקרבו ליער בלילה!', 'שומעים יללות מהביצה…']
    }
  }
};


function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * DPR));
  c.height = Math.max(1, Math.ceil(h * DPR));
  const o = c.getContext('2d');
  o.setTransform(DPR, 0, 0, DPR, 0, 0);
  return [c, o];
}

function rr(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y, x + w, y + h, r);
  cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r);
  cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

function targetPhase(t, cycleSetting) {
  const v = cycleSetting;
  if (v === 'night') return 0;
  if (v === 'day') return 0.5;
  if (v === 'real') {
    const d = new Date();
    return (d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600) / 24;
  }
  const dur = Math.max(60, parseFloat(v) || 1800);
  return (ph0 + (t - cyc0) / dur) % 1;
}

function celestial(p) {
  const q = ((p - .25) % 1 + 1) % 1;
  if (q > .5) return null;
  const f = q / .5;
  return { x: W * (.06 + .88 * f), y: HZ * (1.04 - .86 * Math.sin(Math.PI * f)) };
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export function init2D(canvasElement) {
  cv = canvasElement;
  ctx = cv.getContext('2d', { alpha: false });
}

export function resize2D(w, h) {
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  W = w; H = h;
  if (cv) {
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
  }
}

export function generate2D(scene) {
  if (scene === 'yennefer' || scene === 'harry_potter' || scene === 'lotr' || scene === 'star_wars') return;
  R = mulberry32(20261013);
  DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth;
  H = window.innerHeight;
  if (cv) {
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
  }
  HZ = Math.round(H * (scene === 'city' ? .66 : .6));
  GH = H - HZ;
  S = Math.max(.6, Math.min(1.6, H / 1080));

  if (scene === 'city') {
    backdrop = makeBackdrop();
    layers = LAYER_CFG.map(makeLayer);
    ground = makeGround();
  } else {
    fant = buildFantasy(scene);
  }

  stars = [];
  const ns = Math.round(W * HZ / 7000);
  for (let i = 0; i < ns; i++) {
    stars.push({ x: R() * W, y: Math.pow(R(), 1.6) * HZ * .75, r: R() < .1 ? 1.8 : R() < .4 ? 1.2 : .8, a: rnd(.25, .9), s: rnd(.3, 1.6), p: R() * 6.28 });
  }

  clouds = [];
  for (let i = 0; i < 6; i++) {
    const cw = rnd(.16, .3) * W, ch = rnd(.06, .1) * H;
    clouds.push({ img: makeCloud(cw, ch), w: cw, h: ch, x: R() * W, y: rnd(.06, .4) * HZ, v: rnd(2, 6) * S });
  }

  fx = [];
}

export function render2D(dt, t, audio, scene, cycleSetting, reactSetting) {
  if (scene === 'yennefer' || scene === 'harry_potter' || scene === 'lotr' || scene === 'star_wars') return;
  if (!ctx) return;

  const lvl = audio.lvl || new Float32Array(NB);
  const bass = audio.bass || 0;
  const highs = audio.highs || 0;
  const energy = audio.energy || 0;
  const playing = !!audio.playing;

  updateWindows(dt, lvl, reactSetting);

  const tgt = targetPhase(t, cycleSetting);
  if (pShown === null) pShown = tgt;
  const dp = ((tgt - pShown + 1.5) % 1) - .5;
  const maxStep = dt * .06;
  pShown = (pShown + Math.max(-maxStep, Math.min(maxStep, dp)) + 1) % 1;
  const p = pShown;
  const elev = -Math.cos(2 * Math.PI * p);
  const dayK = smooth(-.12, .32, elev);
  const nightK = 1 - dayK;
  const warm = Math.exp(-Math.pow((elev - .02) / .17, 2));
  const lampK = smooth(.5, .15, dayK);

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // 1. Sky
  const SKP = scene === 'north' ? SKY_N : scene === 'medieval' ? SKY_M : SKY;
  const sk = i => mixc(mixc(SKP.night[i], SKP.day[i], dayK), SKP.dusk[i], warm * (i === 0 ? .35 : i === 1 ? .55 : .8));
  const g = ctx.createLinearGradient(0, 0, 0, HZ);
  g.addColorStop(0, rgb(sk(0))); g.addColorStop(.55, rgb(sk(1))); g.addColorStop(1, rgb(sk(2)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HZ);

  // 2. Stars
  const starK = Math.pow(nightK, 2.5);
  if (starK > .01) {
    ctx.fillStyle = '#e8ecff';
    const tw = 0.25 + highs * 0.5;
    for (const s of stars) {
      ctx.globalAlpha = starK * s.a * (1 - tw + tw * (0.5 + 0.5 * Math.sin(t * s.s + s.p)));
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  // 3. Sun and Moon
  const sun = celestial(p), moon = celestial((p + .5) % 1), mr = Math.max(14, H * .032);
  if (moon) {
    const a = .35 + .65 * nightK;
    const mg = ctx.createRadialGradient(moon.x, moon.y, mr * .8, moon.x, moon.y, mr * 6);
    mg.addColorStop(0, `rgba(255,240,210,${.2 * nightK})`); mg.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = mg; ctx.fillRect(moon.x - mr * 6, moon.y - mr * 6, mr * 12, mr * 12);
    ctx.globalAlpha = a; ctx.fillStyle = '#f4ecd6'; ctx.beginPath(); ctx.arc(moon.x, moon.y, mr, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(170,160,140,.28)';
    for (const [cx2, cy2, cr2] of [[-.3, -.2, .22], [.35, .3, .16], [.1, -.45, .1], [-.1, .45, .12]]) {
      ctx.beginPath(); ctx.arc(moon.x + mr * cx2, moon.y + mr * cy2, mr * cr2, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (sun) {
    const sc = mixc(hex('#fff6dc'), hex('#ffa45e'), warm);
    const sr = mr * 1.25;
    const sg = ctx.createRadialGradient(sun.x, sun.y, sr * .6, sun.x, sun.y, sr * 9);
    sg.addColorStop(0, rgb(sc, .55)); sg.addColorStop(1, rgb(sc, 0));
    ctx.fillStyle = sg; ctx.fillRect(sun.x - sr * 9, sun.y - sr * 9, sr * 18, sr * 18);
    ctx.fillStyle = rgb(sc); ctx.beginPath(); ctx.arc(sun.x, sun.y, sr, 0, 6.283); ctx.fill();
  }

  // 4. Clouds
  ctx.globalAlpha = .07 + .78 * dayK + .12 * warm;
  for (const c of clouds) {
    c.x += c.v * dt;
    if (c.x > W + 20) c.x = -c.w - 20;
    ctx.drawImage(c.img, c.x, c.y, c.w, c.h);
  }
  ctx.globalAlpha = 1;

  // 5. Plane at Night / Birds by Day / Shooting Stars
  nextPlane -= dt;
  if (!plane && nextPlane <= 0 && scene === 'city') {
    const ltr = Math.random() < .5;
    plane = { x: ltr ? -20 : W + 20, y: rnd(.08, .3) * HZ, v: (ltr ? 1 : -1) * W / 75 };
  }
  if (plane) {
    plane.x += plane.v * dt;
    ctx.fillStyle = dayK > .5 ? 'rgba(90,100,120,.8)' : 'rgba(255,255,255,.75)';
    ctx.fillRect(plane.x, plane.y, 3, 1.6);
    if ((t % 1.2) < .12 && nightK > .3) {
      ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(plane.x + 5, plane.y + 1, 2.2, 0, 6.283); ctx.fill();
    }
    if (plane.x < -40 || plane.x > W + 40) { plane = null; nextPlane = 120 + Math.random() * 120; }
  }

  nextBirds -= dt;
  if (!birds && nextBirds <= 0 && dayK > .5) {
    const dir = Math.random() < .5 ? 1 : -1;
    birds = { x: dir > 0 ? -60 : W + 60, y: rnd(.1, .35) * HZ, dir, v: W / 28, n: 4 + (Math.random() * 5 | 0) };
  }
  if (birds) {
    birds.x += birds.v * birds.dir * dt;
    ctx.strokeStyle = 'rgba(40,46,60,.7)'; ctx.lineWidth = 1.4 * S; ctx.beginPath();
    for (let i = 0; i < birds.n; i++) {
      const bx = birds.x - birds.dir * i * 16 * S, by = birds.y + Math.abs(i - birds.n / 2) * 6 * S, f = Math.sin(t * 9 + i) * 3 * S, bw = 6 * S;
      ctx.moveTo(bx - bw, by - f); ctx.quadraticCurveTo(bx - bw / 2, by - 3 * S, bx, by); ctx.quadraticCurveTo(bx + bw / 2, by - 3 * S, bx + bw, by - f);
    }
    ctx.stroke();
    if (birds.x < -200 || birds.x > W + 200) { birds = null; nextBirds = 60 + Math.random() * 90; }
  }

  nextMeteor -= dt;
  if (!meteor && nextMeteor <= 0 && nightK > .8) {
    meteor = { x: rnd(.1, .7) * W, y: rnd(.05, .3) * HZ, life: 0 };
  }
  if (meteor) {
    meteor.life += dt;
    const q = meteor.life / .9, mlen = 120 * S;
    const mx = meteor.x + q * 260 * S, my = meteor.y + q * 110 * S;
    const mgr = ctx.createLinearGradient(mx, my, mx - mlen, my - mlen * .42);
    mgr.addColorStop(0, `rgba(255,255,255,${.8 * (1 - q)})`); mgr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = mgr; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - mlen, my - mlen * .42); ctx.stroke();
    if (q >= 1) { meteor = null; nextMeteor = 240 + Math.random() * 300; }
  }

  // 6. Fantasy Worlds (North & Medieval)
  if (scene !== 'city') {
    if (fant) {
      drawFantasy(t, dt, dayK, nightK, warm, moon, bass);
      checkEvents(dayK, t, playing, scene);
      drawFx(t, nightK);
    }
    return;
  }

  // 7. City Skyline Rendering
  // City glow on horizon reacting to bass
  const gl = ctx.createLinearGradient(0, HZ * .45, 0, HZ);
  gl.addColorStop(0, 'rgba(255,170,100,0)');
  gl.addColorStop(1, `rgba(255,170,100,${(.08 + bass * .26) * nightK + warm * .25})`);
  ctx.fillStyle = gl;
  ctx.fillRect(0, HZ * .45, W, HZ * .55);

  // Sea and hills backdrop
  if (backdrop) {
    if (dayK < .99) ctx.drawImage(backdrop.night, 0, 0, W, HZ);
    if (dayK > .01) { ctx.globalAlpha = dayK; ctx.drawImage(backdrop.day, 0, 0, W, HZ); ctx.globalAlpha = 1; }

    const gk = .55 * dayK + (moon ? .3 * nightK : 0);
    if (gk > .02 && backdrop.glints) {
      ctx.fillStyle = dayK > .5 ? '#ffffff' : '#dfe6ff';
      for (const gl2 of backdrop.glints) {
        const ga = Math.max(0, Math.sin(t * gl2.s + gl2.p));
        if (ga < .55) continue;
        ctx.globalAlpha = gk * (ga - .55) * 2.2;
        ctx.fillRect(gl2.x, gl2.y, gl2.w, 1.2 * S);
      }
      ctx.globalAlpha = 1;
    }
  }

  // City Building Layers & Glowing Lit Windows
  const winK = 1 - .62 * dayK;
  const haze = mixc(HAZE_N, HAZE_D, dayK);

  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    if (dayK < .99) ctx.drawImage(L.sil, 0, 0, W, HZ);
    if (dayK > .01) { ctx.globalAlpha = dayK; ctx.drawImage(L.day, 0, 0, W, HZ); ctx.globalAlpha = 1; }

    // Lit windows
    for (let c = 0; c < WIN_COLORS.length; c++) {
      ctx.fillStyle = WIN_COLORS[c];
      const ord = L.ord[c];
      for (let j = 0; j < ord.length; j++) {
        const i = ord[j], v = L.b[i];
        if (v < .03) continue;
        ctx.globalAlpha = v * L.alpha * winK;
        ctx.fillRect(L.wx[i], L.wy[i], L.ww, L.wh);
      }
    }
    ctx.globalAlpha = 1;

    // Aviation beacons on towers and spires
    if (nightK > .2 && L.beacons) {
      ctx.fillStyle = '#ff4d4d';
      for (const bc of L.beacons) {
        const a = Math.pow(Math.max(0, Math.sin(t * 2.2 + bc.p)), 6) * L.alpha * nightK;
        if (a < .02) continue;
        ctx.globalAlpha = a * .35; ctx.beginPath(); ctx.arc(bc.x, bc.y, 6 * S, 0, 6.283); ctx.fill();
        ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(bc.x, bc.y, 1.8 * S, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Depth haze between layers
    if (li < layers.length - 1) {
      const hz = ctx.createLinearGradient(0, HZ * .4, 0, HZ);
      hz.addColorStop(0, rgb(haze, 0)); hz.addColorStop(1, rgb(haze, li === 0 ? .4 : .2));
      ctx.fillStyle = hz; ctx.fillRect(0, HZ * .4, W, HZ * .6);
    }
  }

  // Street, Sidewalk & Park
  const G = ground;
  if (G) {
    if (dayK < .99) ctx.drawImage(G.night, 0, 0, W, H);
    if (dayK > .01) { ctx.globalAlpha = dayK; ctx.drawImage(G.day, 0, 0, W, H); ctx.globalAlpha = 1; }
    if (warm > .05) { ctx.fillStyle = `rgba(255,150,90,${warm * .12})`; ctx.fillRect(0, HZ, W, GH); }

    // Traffic & Pedestrians crossing
    updateCrossing(dt, dayK);
    updateCars(dt, dayK, energy);
    const crossers = G.cross.people.slice().sort((a, b) => a.y - b.y);
    const farL = G.lanes[0], nearL = G.lanes[1];

    for (const c of farL.cars) drawCar(c, farL.y, farL.dir, nightK);
    for (const p of crossers) if (p.y <= nearL.y) drawWalkerFront(p, nightK, lampK);
    for (const c of nearL.cars) drawCar(c, nearL.y, nearL.dir, nightK);
    for (const p of crossers) if (p.y > nearL.y) drawWalkerFront(p, nightK, lampK);

    // Pedestrian signals
    for (const [sx, sy] of G.signals) {
      const go = G.cross.walk;
      ctx.fillStyle = go ? '#3bd16f' : '#ff4a3d';
      ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(sx, sy + (go ? 8.5 : 3.5) * S, 2.6 * S, 0, 6.283); ctx.fill();
      if (nightK > .2) { ctx.globalAlpha = .3 * nightK; ctx.beginPath(); ctx.arc(sx, sy + (go ? 8.5 : 3.5) * S, 8 * S, 0, 6.283); ctx.fill(); }
      ctx.globalAlpha = 1;
    }

    // Midground (trees, benches, poles)
    if (dayK < .99) ctx.drawImage(G.midN, 0, 0, W, H);
    if (dayK > .01) { ctx.globalAlpha = dayK; ctx.drawImage(G.midD, 0, 0, W, H); ctx.globalAlpha = 1; }

    // Street lamps with warm light pools
    if (lampK > .02) {
      for (const l of G.lamps) {
        const hx = l.x + 12 * S, hy = l.base - l.h + 4 * S;
        const pool = ctx.createRadialGradient(hx, G.p0 + (G.p1 - G.p0) * .5, 0, hx, G.p0 + (G.p1 - G.p0) * .5, G.sp * .32);
        pool.addColorStop(0, `rgba(255,205,130,${.28 * lampK})`); pool.addColorStop(1, 'rgba(255,205,130,0)');
        ctx.fillStyle = pool; ctx.fillRect(hx - G.sp * .32, G.p0 - GH * .05, G.sp * .64, (G.p1 - G.p0) + GH * .1);
        const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, 26 * S);
        halo.addColorStop(0, `rgba(255,220,160,${.9 * lampK})`); halo.addColorStop(1, 'rgba(255,220,160,0)');
        ctx.fillStyle = halo; ctx.fillRect(hx - 26 * S, hy - 26 * S, 52 * S, 52 * S);
      }
    }

    // Pedestrians walking in the park
    updatePeople(dt, dayK);
    for (const pp of G.people) drawPerson(pp, nightK, lampK);

    // Foreground bushes
    if (dayK < .99) ctx.drawImage(G.fgN, 0, 0, W, H);
    if (dayK > .01) { ctx.globalAlpha = dayK; ctx.drawImage(G.fgD, 0, 0, W, H); ctx.globalAlpha = 1; }
  }

  checkEvents(dayK, t, playing, scene);
  drawFx(t, nightK);
}

// ----------------------------------------------------------------------------
// Internal Building & Layer Generators
// ----------------------------------------------------------------------------

function makeBackdrop() {
  const seaY = HZ * .8;
  const ridge = [];
  for (let i = 0; i <= 80; i++) {
    const f = i / 80, x = f * W * .7;
    const fall = smooth(1, .72, f);
    const y = seaY - HZ * fall * (.04 + .035 * Math.sin(f * 9.1 + 1.3) + .02 * Math.sin(f * 23.7));
    ridge.push([x, y]);
  }

  const bake = day => {
    const [c, o] = newCanvas(W, HZ);
    const sg = o.createLinearGradient(0, seaY, 0, HZ);
    if (day) { sg.addColorStop(0, '#8fb9de'); sg.addColorStop(.25, '#3f80c2'); sg.addColorStop(1, '#2a62a6'); }
    else { sg.addColorStop(0, '#141d44'); sg.addColorStop(1, '#070c24'); }
    o.fillStyle = sg; o.fillRect(0, seaY, W, HZ - seaY);
    o.fillStyle = day ? rgb(mixc(hex('#6f9b62'), BHAZE, .45)) : '#0b1230';
    o.beginPath(); o.moveTo(0, seaY + 1);
    for (const [rx, ry] of ridge) o.lineTo(rx, ry);
    o.lineTo(W * .7, seaY + 1); o.closePath(); o.fill();
    o.fillStyle = day ? 'rgba(255,255,255,.5)' : 'rgba(150,160,220,.18)';
    o.fillRect(W * .55, seaY, W * .45, 1);
    return c;
  };

  const glints = [];
  for (let i = 0; i < 90; i++) glints.push({ x: rnd(.6, 1) * W, y: seaY + Math.pow(R(), .7) * (HZ - seaY), w: rnd(3, 10) * S, p: R() * 6.28, s: rnd(1.5, 4) });
  return { day: bake(true), night: bake(false), seaY, glints };
}

function makeCloud(w, h) {
  const [c, o] = newCanvas(w, h);
  try { o.filter = `blur(${Math.max(1, 2 * S)}px)`; } catch (e) {}
  o.fillStyle = '#ffffff';
  const base = h * .8;
  o.beginPath(); o.ellipse(w * .5, base - h * .08, w * .42, h * .14, 0, 0, 6.283); o.fill();
  for (let i = 0; i < 16; i++) {
    const f = rnd(.1, .9), dome = Math.sin(Math.PI * f);
    const r = h * (.12 + .26 * dome) * rnd(.8, 1.15);
    const cx = w * f, cy = base - r * .8 - dome * h * rnd(0, .22);
    o.beginPath(); o.arc(cx, cy, r, 0, 6.283); o.fill();
  }
  o.filter = 'none';
  o.globalCompositeOperation = 'source-atop';
  const sh = o.createLinearGradient(0, h * .3, 0, base);
  sh.addColorStop(0, 'rgba(165,180,205,0)'); sh.addColorStop(1, 'rgba(165,180,205,.55)');
  o.fillStyle = sh; o.fillRect(0, 0, w, h);
  return c;
}

function makeLayer(cfg) {
  const s = S, wv = cfg.win;
  const ww = Math.max(1.5, wv.w * s), wh = Math.max(1.5, wv.h * s), gx = wv.gx * s, gy = wv.gy * s, m = wv.m * s, top = wv.top * s;
  const bs = [], WX = [], WY = [], TH = [], KD = [], BD = [], CL = [], beacons = [];
  const nightBase = hex(cfg.body);
  let x = -rnd(0, 30);

  while (x < W + 30) {
    const w = rnd(cfg.wMin, cfg.wMax) * s;
    let h = rnd(cfg.hMin, cfg.hMax) * HZ;
    if (R() < cfg.tall) h = Math.min(HZ * .88, h * 1.4);
    const fx2 = x / Math.max(1, W);
    if (fx2 > .64) {
      h *= Math.max(.2, 1 - (fx2 - .64) * 2.3);
      if (R() < (cfg.far ? .6 : .3)) { x += w + rnd(cfg.gapMin, cfg.gapMax) * s + (cfg.far ? 0 : 20 * s); continue; }
    }
    const tallB = h > HZ * .4;
    const roof = R() < cfg.roofP ? ['antenna', 'step', 'slant', 'spire'][R() * 4 | 0] : 'flat';
    const fac = tallB ? TOWERS[R() * TOWERS.length | 0] : (R() < .25 ? TOWERS : FACADES)[R() * (R() < .25 ? TOWERS.length : FACADES.length) | 0] || FACADES[0];
    const dc = mixc(hex(fac.d), BHAZE, cfg.haze);
    const b = { x, w, h, y: HZ - h, roof, band: R() * NB | 0,
      day: rgb(dc), dayShade: rgb(mixc(dc, [30, 40, 60], .22)), dayGlass: fac.g,
      night: rgb(mixc(nightBase, hex(fac.d), .1)),
      box: roof === 'flat' && R() < .7 ? { x: rnd(.15, .55), w: rnd(.15, .3), h: rnd(4, 9) * s } : null };
    bs.push(b);
    if (roof === 'antenna' || roof === 'spire') beacons.push({ x: x + w / 2, y: b.y - (roof === 'spire' ? h * .16 : 22 * s) - 2 * s, p: R() * 6.28 });

    const cols = Math.floor((w - 2 * m + gx) / (ww + gx)), rows = Math.floor((h - top - m + gy) / (wh + gy));
    if (cols > 0 && rows > 0) {
      const ox = x + (w - (cols * (ww + gx) - gx)) / 2;
      const bc = pickColor(), closed = R() < .1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          WX.push(ox + c * (ww + gx)); WY.push(b.y + top + r * (wh + gy));
          const q = R(); let kind = 0;
          if (closed ? q < .9 : q < .12) kind = 2; else if (q > (closed ? .985 : .93)) kind = 1;
          KD.push(kind); TH.push(rnd(.14, .9));
          BD.push(R() < .8 ? b.band : (b.band + (R() < .5 ? 1 : NB - 1)) % NB);
          CL.push(R() < .85 ? bc : pickColor());
          b.wi = b.wi || [WX.length - 1, 0]; b.wi[1] = WX.length;
        }
      }
    }
    x += w + rnd(cfg.gapMin, cfg.gapMax) * s;
  }

  let tower = null;
  if (cfg.tower) {
    const th = HZ * .86, tw = Math.max(8, 13 * s), tx = W * .58;
    tower = { x: tx, h: th, w: tw, podY: HZ - th * .7 };
    beacons.push({ x: tx, y: HZ - th - 2 * s, p: 0 });
  }

  const n = WX.length;
  const L = { cfg, bs, beacons, ww, wh, n, alpha: cfg.alpha,
    wx: Float32Array.from(WX), wy: Float32Array.from(WY), th: Float32Array.from(TH),
    kd: Uint8Array.from(KD), bd: Uint8Array.from(BD), b: new Float32Array(n), on: new Uint8Array(n), ord: [] };

  for (let c = 0; c < WIN_COLORS.length; c++) {
    const o = [];
    for (let i = 0; i < n; i++) if (CL[i] === c) o.push(i);
    L.ord.push(Uint32Array.from(o));
  }
  for (let i = 0; i < n; i++) {
    if (L.kd[i] === 1 || (L.kd[i] === 0 && L.th[i] < .45)) { L.on[i] = 1; L.b[i] = 1; }
  }

  const bake = day => {
    const [oc, o] = newCanvas(W, HZ);
    for (const b of bs) {
      o.fillStyle = day ? b.day : b.night;
      o.fillRect(b.x, b.y, b.w, b.h + 1);
      if (b.roof === 'step') o.fillRect(b.x + b.w * .2, b.y - b.h * .06, b.w * .6, b.h * .06 + 1);
      if (b.roof === 'slant') { o.beginPath(); o.moveTo(b.x, b.y + .5); o.lineTo(b.x + b.w, b.y - b.w * .28); o.lineTo(b.x + b.w, b.y + .5); o.fill(); }
      if (b.roof === 'antenna') { o.fillRect(b.x + b.w / 2 - 1 * s, b.y - 22 * s, 2 * s, 22 * s); o.fillRect(b.x + b.w * .3, b.y - 6 * s, b.w * .4, 6 * s); }
      if (b.roof === 'spire') { o.beginPath(); o.moveTo(b.x + b.w * .3, b.y + .5); o.lineTo(b.x + b.w / 2, b.y - b.h * .16); o.lineTo(b.x + b.w * .7, b.y + .5); o.fill(); }
      if (b.box) o.fillRect(b.x + b.w * b.box.x, b.y - b.box.h, b.w * b.box.w, b.box.h + 1);
      if (day) { o.fillStyle = b.dayShade; o.fillRect(b.x + b.w * .7, b.y, b.w * .3, b.h + 1); }
      o.fillStyle = day ? 'rgba(255,255,255,.22)' : cfg.rim; o.fillRect(b.x, b.y, b.w, Math.max(1, s));
      if (b.wi) {
        o.fillStyle = day ? b.dayGlass : cfg.glass;
        for (let i = b.wi[0]; i < b.wi[1]; i++) o.fillRect(WX[i], WY[i], ww, wh);
      }
    }
    if (tower) {
      const { x: tx, h: th, w: tw, podY } = tower, base = HZ, topY = HZ - th;
      o.fillStyle = day ? rgb(mixc(hex('#8d939e'), BHAZE, cfg.haze)) : rgb(mixc(nightBase, [120, 120, 140], .06));
      o.beginPath(); o.moveTo(tx - tw, base); o.lineTo(tx - tw * .38, podY); o.lineTo(tx + tw * .38, podY); o.lineTo(tx + tw, base); o.fill();
      o.fillRect(tx - tw * .3, topY + th * .12, tw * .6, podY - topY - th * .12);
      o.beginPath(); o.ellipse(tx, podY - tw * .2, tw * 1.7, tw * .62, 0, 0, 6.283); o.fill();
      o.fillRect(tx - tw * 1.2, podY - tw * .9, tw * 2.4, tw * .55);
      o.beginPath(); o.ellipse(tx, topY + th * .16, tw * .75, tw * .3, 0, 0, 6.283); o.fill();
      o.fillRect(tx - 1.2 * s, topY, 2.4 * s, th * .14);
      o.fillStyle = day ? 'rgba(30,45,70,.6)' : 'rgba(255,200,130,.55)';
      o.fillRect(tx - tw * 1.15, podY - tw * .72, tw * 2.3, tw * .2);
    }
    return oc;
  };

  L.sil = bake(false);
  L.day = bake(true);
  return L;
}

function updateWindows(dt, lvl, reactSetting) {
  const r = (reactSetting || 65) / 100;
  const up = 1 - Math.exp(-dt * 6), down = 1 - Math.exp(-dt * 1.6);
  for (const L of layers) {
    const n = L.n, kd = L.kd, th = L.th, bd = L.bd, on = L.on, b = L.b;
    for (let i = 0; i < n; i++) {
      const k = kd[i]; let tgt;
      if (k === 1) tgt = 1; else if (k === 2) tgt = 0;
      else {
        const v = 0.5 * (1 - r) + lvl[bd[i]] * r;
        if (on[i]) { if (v < th[i] - 0.08) on[i] = 0; } else if (v > th[i]) on[i] = 1;
        tgt = on[i];
      }
      const cur = b[i];
      b[i] = cur + (tgt - cur) * (tgt > cur ? up : down);
    }
  }
}

function makeGround() {
  const g = {};
  g.r0 = HZ + .06 * GH; g.r1 = HZ + .34 * GH; g.mid = (g.r0 + g.r1) / 2;
  g.c1 = HZ + .40 * GH; g.p0 = HZ + .52 * GH; g.p1 = HZ + .66 * GH;
  g.cwX = Math.round(W * .36); g.cwW = Math.max(46, 70 * S);
  g.cross = { walk: false, t: 0, next: rnd(12, 22), people: [] };
  g.signals = [[g.cwX - g.cwW / 2 - 8 * S, g.r0 - 1 - .2 * GH], [g.cwX + g.cwW / 2 + 8 * S, g.c1 - 2 * S - .2 * GH]];
  g.lanes = [
    { y: g.r0 + (g.mid - g.r0) * .82, dir: -1, k: .86, cars: [], next: 1 },
    { y: g.mid + (g.r1 - g.mid) * .85, dir: 1, k: 1, cars: [], next: 2.5 }
  ];

  const trees = [];
  for (let x = rnd(10, 80) * S; x < W + 40;) {
    const r = rnd(.07, .105) * GH;
    trees.push({ x, base: HZ + rnd(.47, .51) * GH, r, trunk: .08 * GH, c: R() * 3 | 0, con: R() < .3, lobes: [[0, 0, 1], [-.55, .25, .72], [.55, .22, .75], [0, -.45, .7]].map(([a, b, k]) => [a * r, b * r, k * r * rnd(.9, 1.1)]) });
    x += rnd(80, 170) * S + (R() < .2 ? rnd(70, 160) * S : 0);
  }
  const lamps = [], benches = [];
  const sp = Math.max(200, 260 * S);
  for (let x = sp * .4, i = 0; x < W + 20; x += sp, i++) {
    lamps.push({ x, base: g.p0 + 2 * S, h: .26 * GH });
    if (i % 2 === 0) benches.push({ x: x + sp * .5, base: g.p0 + .03 * GH, w: .16 * GH });
  }
  const bushes = [];
  for (let x = -30; x < W + 30;) {
    bushes.push({ x, r: rnd(.07, .12) * GH, c: R() * 2 | 0, con: R() < .4, base: H + rnd(0, .06) * GH });
    x += rnd(35, 95) * S + (R() < .15 ? rnd(60, 160) * S : 0);
  }
  g.trees = trees; g.lamps = lamps; g.benches = benches; g.sp = sp;

  const bake = pal => {
    const [c, o] = newCanvas(W, H);
    o.fillStyle = pal.side; o.fillRect(0, HZ, W, g.r0 - HZ);
    o.fillStyle = pal.road; o.fillRect(0, g.r0, W, g.r1 - g.r0);
    o.fillStyle = pal.dash;
    o.fillRect(0, g.r0 + 2 * S, W, Math.max(1, 1.5 * S)); o.fillRect(0, g.r1 - 3.5 * S, W, Math.max(1, 1.5 * S));
    o.fillStyle = pal.yellow;
    o.fillRect(0, g.mid - 3 * S, W, 2 * S); o.fillRect(0, g.mid + 1 * S, W, 2 * S);
    o.fillStyle = pal.road; o.fillRect(g.cwX - g.cwW / 2, g.r0 + 1, g.cwW, g.r1 - g.r0 - 2);
    o.fillStyle = pal.zebra;
    const nz = 9, zh = (g.r1 - g.r0) / (nz * 2 - 1);
    for (let i = 0; i < nz; i++) o.fillRect(g.cwX - g.cwW / 2, g.r0 + i * 2 * zh, g.cwW, zh);
    o.fillStyle = pal.signal;
    for (const [px, py] of [[g.cwX - g.cwW / 2 - 8 * S, g.r0 - 1], [g.cwX + g.cwW / 2 + 8 * S, g.c1 - 2 * S]]) {
      o.fillRect(px - 1.5 * S, py - .2 * GH, 3 * S, .2 * GH);
      o.fillRect(px - 4 * S, py - .2 * GH - 2 * S, 8 * S, 15 * S);
    }
    o.fillStyle = pal.curb; o.fillRect(0, g.r1, W, g.c1 - g.r1);
    const gg = o.createLinearGradient(0, g.c1, 0, H); gg.addColorStop(0, pal.grass0); gg.addColorStop(1, pal.grass1);
    o.fillStyle = gg; o.fillRect(0, g.c1, W, H - g.c1);
    o.fillStyle = pal.path; o.fillRect(0, g.p0, W, g.p1 - g.p0);
    return c;
  };

  const bakeMid = pal => {
    const [c, o] = newCanvas(W, H);
    for (const t of trees) {
      o.fillStyle = pal.trunk; o.fillRect(t.x - t.r * .09, t.base - t.trunk - t.r * .3, t.r * .18, t.trunk + t.r * .3);
      o.fillStyle = pal.crowns[t.c];
      const cy = t.base - t.trunk - t.r * .7;
      if (t.con) {
        o.fillStyle = pal.conifer;
        for (let k = 0; k < 3; k++) {
          const yb = t.base - t.trunk * .6 - k * t.r * .7, wd = t.r * (1.05 - k * .25);
          o.beginPath(); o.moveTo(t.x - wd, yb); o.lineTo(t.x, yb - t.r * 1.2); o.lineTo(t.x + wd, yb); o.fill();
        }
      } else {
        for (const [dx, dy, rr2] of t.lobes) { o.beginPath(); o.arc(t.x + dx, cy + dy, rr2, 0, 6.283); o.fill(); }
      }
    }
    for (const b of benches) {
      o.fillStyle = pal.bench;
      o.fillRect(b.x - b.w / 2, b.base - b.w * .32, b.w, b.w * .07);
      o.fillRect(b.x - b.w / 2, b.base - b.w * .5, b.w, b.w * .07);
      o.fillRect(b.x - b.w * .42, b.base - b.w * .32, b.w * .05, b.w * .32); o.fillRect(b.x + b.w * .37, b.base - b.w * .32, b.w * .05, b.w * .32);
    }
    for (const l of lamps) {
      o.fillStyle = pal.pole;
      o.fillRect(l.x - 1.5 * S, l.base - l.h, 3 * S, l.h);
      o.fillRect(l.x - 1.5 * S, l.base - l.h, 14 * S, 2.5 * S);
      o.fillRect(l.x + 9 * S, l.base - l.h, 7 * S, 4 * S);
    }
    return c;
  };

  const bakeFg = pal => {
    const [c, o] = newCanvas(W, H);
    for (const b of bushes) {
      if (b.con) {
        o.fillStyle = pal.conifer;
        for (let k = 0; k < 4; k++) {
          const yb = b.base - k * b.r * .75, wd = b.r * (1 - k * .2);
          o.beginPath(); o.moveTo(b.x - wd, yb); o.lineTo(b.x, yb - b.r * 1.3); o.lineTo(b.x + wd, yb); o.fill();
        }
      } else {
        o.fillStyle = pal.bush[b.c];
        o.beginPath(); o.arc(b.x, b.base - b.r * .9, b.r, 0, 6.283);
        o.arc(b.x - b.r * .7, b.base - b.r * .4, b.r * .8, 0, 6.283);
        o.arc(b.x + b.r * .75, b.base - b.r * .45, b.r * .85, 0, 6.283);
        o.fill();
      }
    }
    return c;
  };

  g.night = bake(GPAL.night); g.day = bake(GPAL.day);
  g.midN = bakeMid(GPAL.night); g.midD = bakeMid(GPAL.day);
  g.fgN = bakeFg(GPAL.night); g.fgD = bakeFg(GPAL.day);
  g.people = [];
  g.nextPerson = 0.5;
  return g;
}

// ----------------------------------------------------------------------------
// Traffic Simulation
// ----------------------------------------------------------------------------

function spawnCar(L, dayK) {
  const q = R(), type = q < .07 ? 'bus' : q < .19 ? 'van' : q < .29 ? 'scooter' : 'car';
  const h = .1 * GH * L.k * (type === 'bus' ? 1.45 : type === 'van' ? 1.15 : type === 'scooter' ? .95 : 1);
  const len = h * (type === 'bus' ? 3.6 : type === 'van' ? 2.3 : type === 'scooter' ? .95 : 2.35);
  const v0 = rnd(.85, 1.15) * Math.max(W, 700) / 10 * L.k * (type === 'bus' ? .8 : type === 'scooter' ? .85 : 1);
  const color = type === 'bus' ? (R() < .5 ? '#2f7fc1' : '#d94a3a') : CAR_COLORS[R() * CAR_COLORS.length | 0];
  const x = L.dir > 0 ? -len : W + len;
  const last = L.cars[L.cars.length - 1];
  if (last && Math.abs(last.x - x) < last.len + len) return false;
  L.cars.push({ x, v: v0, v0, h, len, type, color, taxi: color === '#f2c230' && type === 'car',
    rider: { shirt: SHIRTS[R() * SHIRTS.length | 0], helmet: CAR_COLORS[R() * CAR_COLORS.length | 0] } });
  return true;
}

function updateCars(dt, dayK, energy) {
  if (!ground) return;
  const stopping = ground.cross.walk || ground.cross.amber;
  const density = (.35 + .65 * dayK) * (.75 + .6 * (energy || 0.5));
  for (const L of ground.lanes) {
    L.next -= dt * density;
    if (L.next <= 0) { if (spawnCar(L, dayK)) L.next = rnd(1.4, 4.5); else L.next = .4; }
    const cs = L.cars;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i], ahead = cs[i - 1];
      let v = c.v + (c.v0 - c.v) * Math.min(1, dt * .8);
      if (ahead) {
        const gap = (ahead.x - c.x) * L.dir - (ahead.len + c.len) / 2;
        if (gap < c.h * 4) v = Math.min(v, Math.max(0, ahead.v + (gap - c.h * .9) * 1.3));
      }
      if (stopping) {
        const front = c.x + L.dir * c.len / 2;
        const line = ground.cwX - L.dir * (ground.cwW / 2 + 6 * S);
        const d = (line - front) * L.dir;
        if (d > -3) v = Math.min(v, Math.max(0, d - 1) * 1.5);
      }
      c.v = v; c.x += v * L.dir * dt;
    }
    while (cs.length && (L.dir > 0 ? cs[0].x > W + cs[0].len * 2 : cs[0].x < -cs[0].len * 2)) cs.shift();
  }
}

function drawCar(c, y, dir, nightK) {
  const { len, h } = c;
  ctx.save(); ctx.translate(c.x, y); if (dir < 0) ctx.scale(-1, 1);
  const L2 = len / 2;

  // Headlight beam
  if (nightK > .05 && c.type !== 'scooter') {
    const bg = ctx.createLinearGradient(L2, 0, L2 + len * 1.3, 0);
    bg.addColorStop(0, `rgba(255,240,200,${.32 * nightK})`); bg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(L2, -h * .5); ctx.lineTo(L2 + len * 1.3, -h * .85); ctx.lineTo(L2 + len * 1.3, h * .05); ctx.lineTo(L2, -h * .36); ctx.fill();
  }

  if (c.type === 'scooter') {
    ctx.fillStyle = '#0b0b10';
    for (const wx of [-L2 * .75, L2 * .75]) { ctx.beginPath(); ctx.arc(wx, -h * .14, h * .14, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = shade(c.color, nightK * .72);
    rr(ctx, -L2 * .9, -h * .42, len * .85, h * .2, h * .08); ctx.fill();
    ctx.fillRect(L2 * .45, -h * .75, h * .07, h * .4);
    const sk = nightK * .7;
    ctx.strokeStyle = shade('#2b3346', sk); ctx.lineWidth = h * .1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-L2 * .2, -h * .5); ctx.lineTo(L2 * .25, -h * .3); ctx.stroke();
    ctx.strokeStyle = shade(c.rider.shirt, sk); ctx.lineWidth = h * .16;
    ctx.beginPath(); ctx.moveTo(-L2 * .25, -h * .52); ctx.lineTo(-L2 * .05, -h * .9); ctx.stroke();
    ctx.lineWidth = h * .07; ctx.beginPath(); ctx.moveTo(-L2 * .05, -h * .85); ctx.lineTo(L2 * .45, -h * .74); ctx.stroke();
    ctx.fillStyle = shade(c.rider.helmet, sk); ctx.beginPath(); ctx.arc(-L2 * .02, -h * 1.02, h * .11, 0, 6.283); ctx.fill();
    ctx.fillStyle = nightK > .3 ? '#fff6d8' : '#e8e2c8'; ctx.fillRect(L2 * .5, -h * .78, h * .06, h * .07);
    if (nightK > .05) {
      const bg = ctx.createLinearGradient(L2, 0, L2 + len * 2.4, 0);
      bg.addColorStop(0, `rgba(255,240,200,${.25 * nightK})`); bg.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(L2 * .5, -h * .78); ctx.lineTo(L2 + len * 2.4, -h * 1.1); ctx.lineTo(L2 + len * 2.4, h * .05); ctx.lineTo(L2 * .5, -h * .7); ctx.fill();
    }
    ctx.fillStyle = nightK > .3 ? '#ff3b3b' : '#a83232'; ctx.fillRect(-L2 * .95, -h * .42, h * .06, h * .06);
    ctx.restore(); return;
  }

  const body = shade(c.color, nightK * .72);
  const glass = nightK > .5 ? `rgba(255,214,150,${.18 + .1 * nightK})` : rgb(mixc(hex('#a9cbe8'), [20, 24, 40], nightK * .8));
  ctx.fillStyle = body;
  if (c.type === 'bus') {
    rr(ctx, -L2, -h, len, h * .84, h * .1); ctx.fill();
    ctx.fillStyle = glass;
    const n = 6, gw = (len * .86) / n;
    for (let i = 0; i < n; i++) ctx.fillRect(-L2 + len * .05 + i * gw, -h * .9, gw * .8, h * .32);
  } else {
    rr(ctx, -L2, -h * .62, len, h * .44, h * .14); ctx.fill();
    ctx.beginPath();
    if (c.type === 'van') { ctx.moveTo(-L2 + h * .05, -h * .6); ctx.lineTo(-L2 + h * .05, -h * .98); ctx.lineTo(L2 * .45, -h * .98); ctx.lineTo(L2 * .9, -h * .6); }
    else { ctx.moveTo(-L2 * .62, -h * .6); ctx.lineTo(-L2 * .42, -h * .98); ctx.lineTo(L2 * .22, -h * .98); ctx.lineTo(L2 * .58, -h * .6); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = glass;
    if (c.type === 'van') ctx.fillRect(L2 * .02, -h * .9, L2 * .4, h * .24);
    else {
      ctx.beginPath(); ctx.moveTo(-L2 * .52, -h * .64); ctx.lineTo(-L2 * .37, -h * .9); ctx.lineTo(L2 * .18, -h * .9); ctx.lineTo(L2 * .44, -h * .64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = body; ctx.fillRect(-L2 * .08, -h * .92, h * .06, h * .3);
    }
    if (c.taxi) { ctx.fillStyle = shade('#fff4c0', nightK * .3); ctx.fillRect(-L2 * .15, -h * 1.08, L2 * .3, h * .1); }
  }

  // Wheels
  ctx.fillStyle = '#0b0b10';
  for (const wx of [-L2 * .62, L2 * .62]) { ctx.beginPath(); ctx.arc(wx, -h * .18, h * .18, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = shade('#9aa0aa', nightK * .7);
  for (const wx of [-L2 * .62, L2 * .62]) { ctx.beginPath(); ctx.arc(wx, -h * .18, h * .08, 0, 6.283); ctx.fill(); }

  // Lights
  const yl = c.type === 'bus' ? -h * .3 : -h * .5;
  ctx.fillStyle = nightK > .3 ? '#fff6d8' : '#e8e2c8'; ctx.fillRect(L2 - h * .07, yl, h * .07, h * .1);
  ctx.fillStyle = nightK > .3 ? '#ff3b3b' : '#a83232'; ctx.fillRect(-L2, yl, h * .06, h * .1);
  if (nightK > .3) { ctx.globalAlpha = .35 * nightK; ctx.beginPath(); ctx.arc(-L2, yl + h * .05, h * .22, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}

// ----------------------------------------------------------------------------
// Pedestrian Simulation
// ----------------------------------------------------------------------------

function spawnPerson(dayK) {
  if (!ground) return;
  const g = ground, dir = R() < .5 ? 1 : -1;
  const child = R() < .14, jog = !child && R() < .15;
  const h = .17 * GH * (child ? .62 : rnd(.9, 1.08));
  const y = g.p0 + (g.p1 - g.p0) * rnd(.32, .9);
  const v = h * (jog ? 1.7 : child ? 1.05 : rnd(.62, .85));
  g.people.push({ x: dir > 0 ? -30 : W + 30, y, dir, h, v, jog, child, dog: !jog && !child && R() < .12,
    shirt: SHIRTS[R() * SHIRTS.length | 0], pants: PANTS[R() * PANTS.length | 0], skin: SKIN[R() * SKIN.length | 0], ph: R() * 6.28 });
}

function updatePeople(dt, dayK) {
  if (!ground) return;
  const g = ground;
  const target = Math.round((2 + 12 * dayK) * Math.max(.6, W / 1600));
  g.nextPerson -= dt;
  if (g.nextPerson <= 0) { if (g.people.length < target) spawnPerson(dayK); g.nextPerson = rnd(1.5, 5); }
  for (const p of g.people) { p.x += p.v * p.dir * dt; p.ph += dt * p.v / (p.h * (p.jog ? .32 : .28)); }
  g.people = g.people.filter(p => p.x > -60 && p.x < W + 60);
  g.people.sort((a, b) => a.y - b.y);
}

function updateCrossing(dt, dayK) {
  if (!ground) return;
  const g = ground, cr = g.cross;
  cr.next -= dt;
  if (!cr.walk && !cr.amber && cr.next <= 0) { cr.amber = true; cr.t = 0; }
  if (cr.amber) {
    cr.t += dt;
    if (cr.t > 2.2) {
      cr.amber = false; cr.walk = true; cr.t = 0;
      const n = 1 + (R() * (1 + 3 * dayK) | 0);
      for (let i = 0; i < n; i++) {
        const down = R() < .5, child = R() < .12;
        const y0 = down ? HZ + .035 * GH : g.c1 + .02 * GH, y1 = down ? g.c1 + .03 * GH : HZ + .03 * GH;
        cr.people.push({ x: g.cwX + rnd(-.35, .35) * g.cwW, y: y0, y1, vy: (down ? 1 : -1) * GH * rnd(.09, .13), delay: rnd(0, 1.6), child,
          h: .15 * GH * (child ? .62 : rnd(.9, 1.06)), shirt: SHIRTS[R() * SHIRTS.length | 0], pants: PANTS[R() * PANTS.length | 0], skin: SKIN[R() * SKIN.length | 0], ph: R() * 6.28 });
      }
    }
  }
  for (const p of cr.people) {
    if (p.delay > 0) { p.delay -= dt; continue; }
    p.y += p.vy * dt; p.ph += dt * 7;
    if ((p.vy > 0 && p.y >= p.y1) || (p.vy < 0 && p.y <= p.y1)) p.done = true;
  }
  cr.people = cr.people.filter(p => !p.done);
  if (cr.walk) { cr.t += dt; if (cr.t > 4 && !cr.people.length) { cr.walk = false; cr.next = rnd(18, 40); } }
}

function lampLight(x) {
  if (!ground) return 0;
  let m = 0;
  for (const l of ground.lamps) { const d = (x - l.x - 12 * S) / (ground.sp * .28); m = Math.max(m, Math.exp(-d * d)); }
  return m;
}

function drawWalkerFront(p, nightK, lampK) {
  if (p.delay > 0) return;
  const depth = .88 + .2 * (p.y - HZ) / (.4 * GH), s = p.h * depth, sw = Math.sin(p.ph);
  const k = nightK * .75 * (1 - lampK * lampLight(p.x) * .4);
  ctx.save(); ctx.translate(p.x, p.y); ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, 0, s * .14, s * .035, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = shade(p.pants, k); ctx.lineWidth = s * .09;
  ctx.beginPath(); ctx.moveTo(-s * .04, -s * .47); ctx.lineTo(-s * .05, -s * .02 - Math.max(0, sw) * s * .07);
  ctx.moveTo(s * .04, -s * .47); ctx.lineTo(s * .05, -s * .02 - Math.max(0, -sw) * s * .07); ctx.stroke();
  ctx.fillStyle = shade(p.shirt, k); rr(ctx, -s * .1, -s * .8, s * .2, s * .36, s * .06); ctx.fill();
  ctx.strokeStyle = shade(p.shirt, k); ctx.lineWidth = s * .06;
  ctx.beginPath(); ctx.moveTo(-s * .11, -s * .74); ctx.lineTo(-s * .13, -s * .5 + sw * s * .03); ctx.moveTo(s * .11, -s * .74); ctx.lineTo(s * .13, -s * .5 - sw * s * .03); ctx.stroke();
  ctx.fillStyle = shade(p.skin, k); ctx.beginPath(); ctx.arc(0, -s * .9, s * .085, 0, 6.283); ctx.fill();
  ctx.restore();
}

function drawPerson(p, nightK, lampK) {
  const s = p.h, sw = Math.sin(p.ph), amp = p.jog ? .22 : .15;
  const k = nightK * .75 * (1 - lampK * lampLight(p.x) * .65);
  ctx.save(); ctx.translate(p.x, p.y); if (p.dir < 0) ctx.scale(-1, 1);
  ctx.lineCap = 'round';
  ctx.fillStyle = `rgba(0,0,0,${.12 + .1 * (1 - nightK)})`; ctx.beginPath(); ctx.ellipse(0, 0, s * .2, s * .04, 0, 0, 6.283); ctx.fill();

  if (p.dog) {
    const dx = s * .55, dsw = Math.sin(p.ph * 1.6);
    ctx.strokeStyle = shade('#3a2a1e', k); ctx.lineWidth = s * .05;
    ctx.beginPath(); ctx.moveTo(dx - s * .12, -s * .02); ctx.lineTo(dx - s * .12 + dsw * s * .05, -s * .12); ctx.moveTo(dx + s * .1, -s * .02); ctx.lineTo(dx + s * .1 - dsw * s * .05, -s * .12); ctx.stroke();
    ctx.fillStyle = shade('#6b4a2f', k); rr(ctx, dx - s * .16, -s * .2, s * .32, s * .1, s * .04); ctx.fill();
    ctx.beginPath(); ctx.arc(dx + s * .18, -s * .22, s * .06, 0, 6.283); ctx.fill();
    ctx.strokeStyle = `rgba(30,30,30,${.6 - .3 * nightK})`; ctx.lineWidth = Math.max(1, s * .012);
    ctx.beginPath(); ctx.moveTo(s * .1, -s * .55); ctx.quadraticCurveTo(dx * .6, -s * .25, dx + s * .14, -s * .2); ctx.stroke();
  }
  ctx.strokeStyle = shade(p.pants, k); ctx.lineWidth = s * .1;
  ctx.beginPath(); ctx.moveTo(0, -s * .47); ctx.lineTo(sw * s * amp, -s * .02); ctx.moveTo(0, -s * .47); ctx.lineTo(-sw * s * amp, -s * .02); ctx.stroke();
  ctx.strokeStyle = shade(p.shirt, k); ctx.lineWidth = s * .16;
  ctx.beginPath(); ctx.moveTo(0, -s * .5); ctx.lineTo(p.jog ? s * .04 : 0, -s * .78); ctx.stroke();
  ctx.lineWidth = s * .07;
  ctx.beginPath(); ctx.moveTo(0, -s * .74); ctx.lineTo(-sw * s * amp * .9, -s * (p.jog ? .6 : .5));
  ctx.moveTo(0, -s * .74); ctx.lineTo(sw * s * amp * .9, -s * (p.jog ? .6 : .5)); ctx.stroke();
  ctx.fillStyle = shade(p.skin, k); ctx.beginPath(); ctx.arc(p.jog ? s * .05 : 0, -s * .9, s * .085, 0, 6.283); ctx.fill();
  ctx.restore();
}

// ----------------------------------------------------------------------------
// Events & Music Synced FX
// ----------------------------------------------------------------------------

function checkEvents(dayK, t, playing, scene) {
  if (scene === 'yennefer' || scene === 'harry_potter' || scene === 'lotr' || scene === 'star_wars') return;
  if (playing) {
    if (nextStar === null) nextStar = t + 8 + Math.random() * 20;
    if (nextBubble === null) nextBubble = t + 4 + Math.random() * 16;
    if (t >= nextStar) { if (t - lastStarT > 6) spawnStar(t, scene); nextStar = t + 20 + Math.random() * 20; }
    if (t >= nextBubble) { if (t - lastBubbleT > 6) spawnBubble(dayK, t, scene); nextBubble = t + 20 + Math.random() * 20; }
  } else {
    nextStar = null; nextBubble = null;
  }
}

function talkers(scene) {
  if (scene === 'city' && ground) return ground.people.concat(ground.cross.people);
  if (fant && fant.people) return fant.people;
  return [];
}

function spawnBubble(dayK, t, scene) {
  let pool = talkers(scene).filter(p => p.x > W * .1 && p.x < W * .9 && !p.say && !(p.delay > 0));
  if (!pool.length) {
    if (scene === 'city' && ground) {
      spawnPerson(dayK);
      const p = ground.people[ground.people.length - 1];
      if (p) { p.x = rnd(.25, .75) * W; pool = [p]; }
    } else if (fant) {
      pool = [spawnWalker(fant, dayK, rnd(.25, .75) * W)];
    }
  }
  if (!pool.length) return;
  const p = pool[Math.random() * pool.length | 0];
  const lang = getCurrentLanguage() || 'en';
  const pack = LOCAL_PHRASES[lang] || LOCAL_PHRASES['en'];
  const worldPack = pack[scene] || pack['city'];
  const list = worldPack.any.concat(dayK > .5 ? worldPack.day : worldPack.night);
  let text; do { text = list[Math.random() * list.length | 0]; } while (text === lastPhrase && list.length > 1);
  lastPhrase = text;
  p.say = { text, t0: t, dur: 4.8 };
  lastBubbleT = t;
}

function spawnStar(t, scene) {
  if (scene !== 'city') {
    if (!fant || !fant.roofs || !fant.roofs.length) return;
    const roofs = fant.roofs.filter(r => r.x > 50 && r.x < W - 50);
    if (!roofs.length) return;
    const rf = roofs[Math.random() * roofs.length | 0];
    fx.push({ type: 'star', x: rf.x, y: rf.y - 30 * S, t0: t, dur: 2.2 });
    lastStarT = t;
    return;
  }
  if (!layers.length) return;
  const near = layers[layers.length - 1].bs.filter(b => b.x + b.w / 2 > 50 && b.x + b.w / 2 < W - 50 && b.y > 60);
  if (!near.length) return;
  near.sort((a, b) => a.y - b.y);
  const b = near[Math.random() * Math.min(near.length, 8) | 0];
  fx.push({ type: 'star', x: b.x + b.w / 2, y: b.y - 34 * S, t0: t, dur: 2.2 });
  lastStarT = t;
}

function starPath(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * .45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr2, cy + Math.sin(a) * rr2);
  }
  ctx.closePath();
}

function drawFx(t, nightK) {
  // Gold stars over rooftops
  fx = fx.filter(f => t - f.t0 < f.dur);
  for (const f of fx) {
    const p = (t - f.t0) / f.dur;
    const pop = p < .14 ? 1 + 2.7 * Math.pow(p / .14 - 1, 3) + 1.7 * Math.pow(p / .14 - 1, 2) : 1;
    const a = p < .7 ? 1 : 1 - (p - .7) / .3;
    const r = 27 * S * Math.max(0, pop), y = f.y - p * 40 * S;
    ctx.save(); ctx.globalAlpha = a;
    const gl = ctx.createRadialGradient(f.x, y, 0, f.x, y, r * 2.6);
    gl.addColorStop(0, 'rgba(255,214,90,.55)'); gl.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = gl; ctx.fillRect(f.x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
    ctx.fillStyle = '#ffe36e'; ctx.strokeStyle = '#c98a12'; ctx.lineWidth = Math.max(1.5, 2 * S);
    ctx.translate(f.x, y); ctx.rotate(Math.sin(p * 6) * .12); starPath(0, 0, r); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, r * .16); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * .28, 0); ctx.lineTo(r * .28, 0); ctx.moveTo(0, -r * .28); ctx.lineTo(0, r * .28); ctx.stroke();
    ctx.rotate(-Math.sin(p * 6) * .12);
    ctx.fillStyle = '#fff6c8';
    for (let k = 0; k < 6; k++) {
      const ang = k * Math.PI / 3 + p * 2, d = r * (1.3 + p * 1.6);
      ctx.globalAlpha = a * (1 - p); ctx.beginPath(); ctx.arc(Math.cos(ang) * d, Math.sin(ang) * d, 2 * S, 0, 6.283); ctx.fill();
    }
    ctx.restore();
  }

  // Thought bubbles above people
  const fs = Math.round(Math.max(14, 19 * S));
  ctx.font = `600 ${fs}px Assistant, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const talkerList = (ground ? ground.people.concat(ground.cross.people) : []).concat(fant && fant.people ? fant.people : []);

  for (const p of talkerList) {
    if (!p.say) continue;
    const q = (t - p.say.t0) / p.say.dur;
    if (q >= 1) { p.say = null; continue; }
    const a = q < .08 ? q / .08 : q > .85 ? (1 - q) / .15 : 1;
    const head = p.y - p.h * (p.vy !== undefined ? 1.05 : 1.02);
    const tw = ctx.measureText(p.say.text).width, bw = tw + fs * 1.6, bh = fs * 2.1;
    const bx = Math.max(bw / 2 + 8, Math.min(W - bw / 2 - 8, p.x)), by = head - fs * 2.6 - (q < .08 ? (1 - q / .08) * 6 : 0);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,30,50,.18)';
    ctx.beginPath(); ctx.ellipse(bx + 2, by + 3, bw / 2, bh / 2, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(bx, by, bw / 2, bh / 2, 0, 0, 6.283); ctx.fill();
    for (let k = 0; k < 5; k++) {
      const ang = Math.PI * (.15 + .7 * k / 4);
      ctx.beginPath(); ctx.arc(bx + Math.cos(ang + Math.PI) * bw * .38, by + Math.sin(ang + Math.PI) * bh * .42, bh * .34, 0, 6.283); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(p.x + (bx - p.x) * .25, head - fs * .95, fs * .32, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + (bx - p.x) * .1, head - fs * .38, fs * .18, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#1f2a3d';
    ctx.fillText(p.say.text, bx, by + 1);
    ctx.restore();
  }
}

// ----------------------------------------------------------------------------
// Fantasy Worlds Generator & Renderer (North & Medieval)
// ----------------------------------------------------------------------------

function jagged(x0, x1, base, hMin, hMax, step) {
  const pts = [[x0, base]];
  let up = true;
  for (let x = x0; x <= x1 + step; x += rnd(step * .6, step * 1.4)) {
    pts.push([x, base - (up ? rnd(hMin * .7, hMax) : rnd(hMin * .2, hMin * .7))]);
    up = !up;
  }
  pts.push([x1 + step * 2, base]);
  return pts;
}

function polyFill(o, pts) {
  o.beginPath(); o.moveTo(pts[0][0], pts[0][1]);
  for (const pt of pts) o.lineTo(pt[0], pt[1]);
  o.closePath(); o.fill();
}

function pine(o, x, base, h, col, snow) {
  const w = h * .42;
  o.fillStyle = col;
  for (let k = 0; k < 3; k++) {
    const yb = base - h * .12 - k * h * .26, wd = w * (1 - k * .24);
    o.beginPath(); o.moveTo(x - wd, yb); o.lineTo(x, yb - h * .42); o.lineTo(x + wd, yb); o.fill();
    if (snow) {
      o.fillStyle = snow; o.beginPath(); o.moveTo(x - wd * .35, yb - h * .27); o.lineTo(x, yb - h * .42); o.lineTo(x + wd * .35, yb - h * .27); o.fill();
      o.fillStyle = col;
    }
  }
  o.fillRect(x - h * .03, base - h * .14, h * .06, h * .14);
}

function roundTree(o, x, base, r, crown, trunk) {
  o.fillStyle = trunk; o.fillRect(x - r * .1, base - r * 1.1, r * .2, r * 1.1);
  o.fillStyle = crown;
  for (const [dx, dy, k] of [[0, -1.6, 1], [-.6, -1.25, .75], [.6, -1.3, .78], [0, -2.15, .7]]) {
    o.beginPath(); o.arc(x + dx * r, base + dy * r, r * k, 0, 6.283); o.fill();
  }
}

function buildFantasy(kind) {
  const F = { kind, people: [], beasts: [], flyers: [], roofs: [], windows: [], lights: [], chimneys: [], puffs: [], snow: [],
    nextWalker: .3, nextFlyer: 12 + Math.random() * 15, nextBeast: 3, nextWagon: 25 + Math.random() * 30, wagon: null };
  F.yV = HZ + .30 * GH; F.r0 = HZ + .36 * GH; F.r1 = HZ + .52 * GH;
  const s = S;

  if (kind === 'north') {
    F.ranges = [
      { pts: jagged(-60, W + 60, HZ + 2, HZ * .35, HZ * .62, 120 * s), snowY: HZ * .55, d: '#a3b7d1', ds: '#f5f8fc', n: '#1b2747', ns: '#5b6b91' },
      { pts: jagged(-60, W + 60, HZ + 2, HZ * .22, HZ * .42, 95 * s), snowY: HZ * .7, d: '#7286a5', ds: '#eef3f9', n: '#131d39', ns: '#48587e' },
      { pts: jagged(-60, W + 60, HZ + GH * .03, HZ * .1, HZ * .24, 70 * s), snowY: HZ * .84, d: '#4c5b72', ds: '#e8eef5', n: '#0c142b', ns: '#3a496e' }
    ];
    F.trees = [];
    for (let x = -10; x < W + 10; x += rnd(7, 15) * s) F.trees.push({ x, base: HZ + rnd(.02, .13) * GH, h: rnd(.06, .12) * GH });
    F.trees.sort((a, b) => a.base - b.base);
    for (let i = 0; i < 130; i++) F.snow.push({ x: R() * W, y: R() * H, r: rnd(.8, 2.2) * s, v: rnd(14, 40) * s, w: rnd(.5, 2), p: R() * 6.28 });
    F.stall = { x: W * .3, w: .26 * GH };
    F.giantY = HZ + .12 * GH; F.deerY = HZ + .14 * GH;
  } else {
    F.hills = [{ pts: [], d: '#9cbb86', n: '#1a2540' }, { pts: [], d: '#7ea86a', n: '#131d33' }];
    for (let k = 0; k < 2; k++) {
      const base = HZ + (k ? GH * .05 : 2), amp = HZ * (k ? .1 : .16), ph = R() * 6;
      const pts = [[-20, base]];
      for (let x = -20; x <= W + 40; x += 20 * s) pts.push([x, base - amp * (.55 + .3 * Math.sin(x / W * 5 + ph) + .15 * Math.sin(x / W * 13 + ph * 2))]);
      pts.push([W + 40, base]); F.hills[k].pts = pts;
    }
    const hp = F.hills[0].pts; const ci = Math.round(hp.length * .72); F.castle = { x: hp[ci][0], y: hp[ci][1] + 4 * s, s: .12 * GH };
    F.forest = [];
    for (let x = -20; x < W * .36; x += rnd(9, 18) * s) F.forest.push({ x, base: HZ + rnd(.03, .17) * GH, r: rnd(.03, .055) * GH, pine: R() < .35 });
    for (let x = W * .36; x < W + 20; x += rnd(60, 160) * s) F.forest.push({ x, base: HZ + rnd(.02, .08) * GH, r: rnd(.02, .035) * GH, pine: R() < .3 });
    F.forest.sort((a, b) => a.base - b.base);
    F.river = { y0: HZ + .17 * GH, y1: HZ + .225 * GH, bx: W * .27 };
    F.mill = { x: W * .9, base: HZ + .14 * GH, h: .2 * GH };
    F.mage = { x: W * .43, y: F.yV + .045 * GH, h: .15 * GH, cast: 0, cool: 0, sparks: [] };
    F.troll = { x: F.river.bx + .05 * W, y: F.river.y1 + .06 * GH, dir: -1, h: .2 * GH, ph: 0, rest: 0 };
  }

  // Village Houses
  const startX = kind === 'north' ? W * .05 : W * .38;
  for (let x = startX; x < W * .97;) {
    const hh = rnd(.14, .2) * GH, w = hh * rnd(1.5, 2.1);
    const keepX = kind === 'north' ? F.stall.x : F.mage.x, keepR = kind === 'north' ? F.stall.w * .65 : .13 * GH;
    if (x < keepX + keepR && x + w > keepX - keepR) { x = keepX + keepR + .02 * GH; continue; }
    if (x + w > W * .99) break;
    const hs = { x, w, hh, wall: hh * (kind === 'north' ? .42 : .5), base: F.yV + rnd(-.01, .01) * GH, tint: R() };
    hs.top = hs.base - hs.wall; hs.peak = hs.top - (hh - hs.wall);
    F.roofs.push({ x: x + w / 2, y: hs.peak });
    F.chimneys.push({ x: x + w * (R() < .5 ? .25 : .72), y: hs.top - (hh - hs.wall) * .55, next: R() });
    const door = { x: x + w * .5 - hh * .09, w: hh * .18, h: hs.wall * .72 };
    hs.door = door;
    for (const fx2 of [.2, .78]) F.windows.push({ x: x + w * fx2 - hh * .06, y: hs.top + hs.wall * .25, w: hh * .12, h: hs.wall * .3, band: R() * NB | 0, th: rnd(.2, .85), b: 0, on: 0 });
    F.lights.push({ x: door.x + door.w + hh * .1, y: hs.top + hs.wall * .3, kind: kind === 'north' ? 'torch' : 'lantern', p: R() * 6 });
    (F.houses = F.houses || []).push(hs);
    x += w + rnd(.04, .14) * GH;
  }

  F.rocks = []; for (let i = 0; i < 9; i++) F.rocks.push({ x: R() * W, y: F.r1 + rnd(.08, .4) * GH, r: rnd(.02, .05) * GH });
  F.fgTrees = []; for (let x = -30; x < W + 30; x += rnd(50, 140) * s) F.fgTrees.push({ x, h: rnd(.18, .32) * GH, pine: kind === 'north' || R() < .4 });
  F.back = [bakeFantasyBack(F, false), bakeFantasyBack(F, true)];
  F.mid = [bakeFantasyMid(F, false), bakeFantasyMid(F, true)];
  F.fg = [bakeFantasyFg(F, false), bakeFantasyFg(F, true)];
  return F;
}

function bakeFantasyBack(F, day) {
  const [c, o] = newCanvas(W, H);
  if (F.kind === 'north') {
    for (const r of F.ranges) {
      o.fillStyle = day ? r.d : r.n; polyFill(o, r.pts);
      o.save(); o.beginPath(); o.moveTo(r.pts[0][0], r.pts[0][1]); for (const p of r.pts) o.lineTo(p[0], p[1]); o.closePath(); o.clip();
      o.fillStyle = day ? r.ds : r.ns; o.beginPath(); o.moveTo(-60, 0); o.lineTo(-60, r.snowY);
      for (let x = -60; x <= W + 60; x += 18 * S) o.lineTo(x, r.snowY + Math.sin(x * .05) * 10 * S + (R() - .5) * 14 * S);
      o.lineTo(W + 60, 0); o.closePath(); o.fill();
      o.fillStyle = day ? 'rgba(40,60,90,.12)' : 'rgba(0,0,0,.18)';
      for (let i = 1; i < r.pts.length - 1; i += 2) { const p = r.pts[i]; o.beginPath(); o.moveTo(p[0], p[1]); o.lineTo(p[0] + 60 * S, HZ + 4); o.lineTo(p[0] + 10 * S, HZ + 4); o.fill(); }
      o.restore();
    }
    const gg = o.createLinearGradient(0, HZ, 0, H);
    gg.addColorStop(0, day ? '#eef3f8' : '#1d2742'); gg.addColorStop(1, day ? '#dce6f0' : '#121a30');
    o.fillStyle = gg; o.fillRect(0, HZ, W, H - HZ);
    for (const t of F.trees) pine(o, t.x, t.base, t.h, day ? '#2f5b45' : '#0b1a17', day ? '#f4f8fb' : '#3a4a68');
  } else {
    for (let k = 0; k < 2; k++) { o.fillStyle = day ? F.hills[k].d : F.hills[k].n; polyFill(o, F.hills[k].pts); }
    const C = F.castle, cs = C.s;
    o.fillStyle = day ? '#b8b1a3' : '#272a3f';
    o.fillRect(C.x - cs * 1.4, C.y - cs * .55, cs * 2.8, cs * .6);
    o.fillRect(C.x - cs * .4, C.y - cs * 1.15, cs * .8, cs * 1.2);
    for (const tx of [-1.4, -.6, .6, 1.4]) o.fillRect(C.x + tx * cs - cs * .16, C.y - cs * (Math.abs(tx) > 1 ? .9 : 1.0), cs * .32, cs);
    for (let x = C.x - cs * 1.4; x < C.x + cs * 1.4; x += cs * .16) o.fillRect(x, C.y - cs * .64, cs * .08, cs * .1);
    o.fillStyle = day ? '#9a3a2e' : '#1d1424';
    for (const tx of [-1.4, -.6, .6, 1.4, 0]) {
      const top = tx === 0 ? C.y - cs * 1.15 : C.y - cs * (Math.abs(tx) > 1 ? .9 : 1.0), w2 = tx === 0 ? cs * .46 : cs * .22;
      o.beginPath(); o.moveTo(C.x + tx * cs - w2, top); o.lineTo(C.x + tx * cs, top - cs * .5); o.lineTo(C.x + tx * cs + w2, top); o.fill();
    }
    const gg = o.createLinearGradient(0, HZ, 0, H);
    gg.addColorStop(0, day ? '#79a85f' : '#14231f'); gg.addColorStop(1, day ? '#5e8f48' : '#0c1714');
    o.fillStyle = gg; o.fillRect(0, HZ + GH * .05, W, H - HZ);
    const RV = F.river;
    o.fillStyle = day ? '#4f8fc4' : '#142446'; o.fillRect(0, RV.y0, W, RV.y1 - RV.y0);
    o.fillStyle = day ? 'rgba(255,255,255,.35)' : 'rgba(150,170,220,.15)';
    for (let x = 0; x < W; x += 40 * S) o.fillRect(x + (R() * 20), RV.y0 + R() * (RV.y1 - RV.y0), 14 * S, 1.5);
    for (const t of F.forest) {
      if (t.pine) pine(o, t.x, t.base, t.r * 3.2, day ? '#2c5a3a' : '#0a1712', null);
      else roundTree(o, t.x, t.base, t.r, day ? (t.x % 3 < 1.5 ? '#3d7a3f' : '#2f6a36') : '#0c1a14', day ? '#5a3d28' : '#120c0a');
    }
    o.fillStyle = day ? '#a8a092' : '#2a2c3c';
    const bx = RV.bx, bw = .16 * GH;
    o.beginPath(); o.moveTo(bx - bw, RV.y1 + 2); o.lineTo(bx - bw * .7, RV.y0 - .02 * GH); o.lineTo(bx + bw * .7, RV.y0 - .02 * GH); o.lineTo(bx + bw, RV.y1 + 2);
    o.lineTo(bx + bw * .45, RV.y1 + 2); o.quadraticCurveTo(bx, RV.y0 + .005 * GH, bx - bw * .45, RV.y1 + 2); o.closePath(); o.fill();
    const M = F.mill;
    o.fillStyle = day ? '#d8c9a6' : '#2b2a38';
    o.beginPath(); o.moveTo(M.x - M.h * .18, M.base); o.lineTo(M.x - M.h * .1, M.base - M.h * .8); o.lineTo(M.x + M.h * .1, M.base - M.h * .8); o.lineTo(M.x + M.h * .18, M.base); o.fill();
    o.fillStyle = day ? '#7c4a32' : '#1d1520';
    o.beginPath(); o.moveTo(M.x - M.h * .14, M.base - M.h * .78); o.lineTo(M.x, M.base - M.h * .98); o.lineTo(M.x + M.h * .14, M.base - M.h * .78); o.fill();
    o.fillStyle = day ? '#a7a39a' : '#24253a';
    o.beginPath(); o.ellipse(F.mage.x, F.mage.y - .005 * GH, .1 * GH, .02 * GH, 0, 0, 6.283); o.fill();
    for (let k = 0; k < 5; k++) { const a = Math.PI * (1.05 + k * .225); o.fillRect(F.mage.x + Math.cos(a) * .1 * GH - 3 * S, F.mage.y + Math.sin(a) * .02 * GH - .05 * GH, 6 * S, .05 * GH); }
  }
  // Road
  o.fillStyle = F.kind === 'north' ? (day ? '#b9a78f' : '#2a2b3e') : (day ? '#b9a07a' : '#2b2733');
  o.beginPath(); o.moveTo(0, F.r0);
  for (let x = 0; x <= W; x += 30 * S) o.lineTo(x, F.r0 + Math.sin(x * .02) * 3 * S);
  o.lineTo(W, F.r1); for (let x = W; x >= 0; x -= 30 * S) o.lineTo(x, F.r1 + Math.sin(x * .017 + 1) * 3 * S); o.closePath(); o.fill();
  o.fillStyle = day ? 'rgba(90,70,50,.18)' : 'rgba(0,0,0,.2)';
  for (let x = 0; x < W; x += 22 * S) o.fillRect(x, F.r0 + (F.r1 - F.r0) * (.3 + .4 * R()), 9 * S, 2);
  return c;
}

function bakeFantasyMid(F, day) {
  const [c, o] = newCanvas(W, H);
  const north = F.kind === 'north';
  for (const hs of F.houses) {
    const { x, w, top, peak, base, hh } = hs;
    if (north) {
      o.fillStyle = day ? (hs.tint < .5 ? '#7a5638' : '#6a4a30') : '#22160e'; o.fillRect(x, top, w, base - top);
      o.fillStyle = day ? 'rgba(40,25,12,.35)' : 'rgba(0,0,0,.35)';
      for (let y = top + 4 * S; y < base; y += 6 * S) o.fillRect(x, y, w, 1.2 * S);
      o.fillStyle = day ? '#4e3e30' : '#17110d';
      o.beginPath(); o.moveTo(x - hh * .08, top + 2); o.lineTo(x + w / 2, peak); o.lineTo(x + w + hh * .08, top + 2); o.fill();
      o.fillStyle = day ? '#f3f7fb' : '#4a5a7c';
      o.beginPath(); o.moveTo(x - hh * .08, top + 2); o.lineTo(x + w / 2, peak); o.lineTo(x + w + hh * .08, top + 2); o.lineTo(x + w + hh * .02, top - hh * .03); o.lineTo(x + w / 2, peak + hh * .07); o.lineTo(x - hh * .02, top - hh * .03); o.fill();
      o.strokeStyle = day ? '#3b2a1c' : '#120c08'; o.lineWidth = 3 * S; o.lineCap = 'round';
      o.beginPath(); o.moveTo(x + w / 2 - hh * .1, peak - hh * .12); o.lineTo(x + w / 2 + hh * .05, peak + hh * .05); o.moveTo(x + w / 2 + hh * .1, peak - hh * .12); o.lineTo(x + w / 2 - hh * .05, peak + hh * .05); o.stroke();
    } else {
      o.fillStyle = day ? (hs.tint < .5 ? '#ece0c4' : '#e3d3b2') : '#2e2a33'; o.fillRect(x, top, w, base - top);
      o.strokeStyle = day ? '#5a3e2a' : '#16100d'; o.lineWidth = 2.5 * S;
      o.strokeRect(x, top, w, base - top);
      o.beginPath(); for (let k = 1; k < 4; k++) { o.moveTo(x + w * k / 4, top); o.lineTo(x + w * k / 4, base); } o.moveTo(x, top + (base - top) * .45); o.lineTo(x + w, top + (base - top) * .45);
      o.moveTo(x, top); o.lineTo(x + w / 4, top + (base - top) * .45); o.moveTo(x + w, top); o.lineTo(x + w * .75, top + (base - top) * .45); o.stroke();
      o.fillStyle = day ? '#c9a35a' : '#2b2318';
      o.beginPath(); o.moveTo(x - hh * .1, top + 3); o.quadraticCurveTo(x + w * .12, peak + hh * .05, x + w / 2, peak); o.quadraticCurveTo(x + w * .88, peak + hh * .05, x + w + hh * .1, top + 3); o.fill();
      o.fillStyle = day ? 'rgba(120,85,30,.35)' : 'rgba(0,0,0,.3)';
      for (let k = 0; k < 7; k++) o.fillRect(x + w * (.1 + k * .12), top - (top - peak) * .35, 1.5 * S, (top - peak) * .3);
    }
    o.fillStyle = day ? '#3a2616' : '#0c0806'; o.fillRect(hs.door.x, base - hs.door.h, hs.door.w, hs.door.h);
  }
  for (const ch of F.chimneys) { o.fillStyle = day ? '#7d7468' : '#1b1a22'; o.fillRect(ch.x - 4 * S, ch.y - 10 * S, 8 * S, 14 * S); }
  for (const wdw of F.windows) { o.fillStyle = day ? 'rgba(40,50,70,.75)' : 'rgba(10,10,20,.9)'; o.fillRect(wdw.x, wdw.y, wdw.w, wdw.h); }
  if (north) {
    const st = F.stall, y = F.yV, w = st.w;
    o.fillStyle = day ? '#6b4a2e' : '#1e140d';
    o.fillRect(st.x - w / 2, y - w * .32, w, w * .08); o.fillRect(st.x - w * .45, y - w * .32, w * .05, w * .32); o.fillRect(st.x + w * .4, y - w * .32, w * .05, w * .32);
    o.fillRect(st.x - w * .48, y - w * .8, w * .04, w * .8); o.fillRect(st.x + w * .44, y - w * .8, w * .04, w * .8);
    for (let k = 0; k < 6; k++) { o.fillStyle = k % 2 ? (day ? '#e8c45a' : '#3a3220') : (day ? '#b8433a' : '#2c1518'); o.fillRect(st.x - w * .52 + k * w * 1.04 / 6, y - w * .86, w * 1.04 / 6 + 1, w * .14); }
    const goods = ['#d9a441', '#8fbf5a', '#c95a3c', '#7a9fd1', '#e0d3b0'];
    for (let k = 0; k < 6; k++) { o.fillStyle = day ? goods[k % 5] : '#2a2630'; o.fillRect(st.x - w * .4 + k * w * .14, y - w * .4, w * .1, w * .08); }
  }
  return c;
}

function bakeFantasyFg(F, day) {
  const [c, o] = newCanvas(W, H);
  for (const r of F.rocks) {
    o.fillStyle = F.kind === 'north' ? (day ? '#8d97a6' : '#232a3d') : (day ? '#8f8a7e' : '#22222e');
    o.beginPath(); o.ellipse(r.x, r.y, r.r * 1.3, r.r * .7, 0, Math.PI, 0); o.fill();
    if (F.kind === 'north') {
      o.fillStyle = day ? '#f5f8fb' : '#46557a';
      o.beginPath(); o.ellipse(r.x, r.y - r.r * .45, r.r * .9, r.r * .25, 0, Math.PI, 0); o.fill();
    }
  }
  if (F.kind === 'medieval') {
    o.strokeStyle = day ? '#7a5a3a' : '#1a130e'; o.lineWidth = 3 * S;
    const fy = F.r1 + .07 * GH;
    o.beginPath(); o.moveTo(0, fy - .03 * GH); o.lineTo(W, fy - .03 * GH); o.moveTo(0, fy - .06 * GH); o.lineTo(W, fy - .06 * GH);
    for (let x = 10; x < W; x += 50 * S) { o.moveTo(x, fy); o.lineTo(x, fy - .08 * GH); } o.stroke();
  }
  for (const t of F.fgTrees) {
    if (t.pine) pine(o, t.x, H + t.h * .15, t.h, F.kind === 'north' ? (day ? '#244a37' : '#08140f') : (day ? '#2a5a38' : '#081410'), F.kind === 'north' ? (day ? '#f5f8fb' : '#3a4a68') : null);
    else roundTree(o, t.x, H + t.h * .5, t.h * .3, day ? '#3a7a3a' : '#0a1812', day ? '#5a3d28' : '#100b09');
  }
  return c;
}

function spawnWalker(F, dayK, forceX) {
  const north = F.kind === 'north';
  const dir = R() < .5 ? 1 : -1, q = R();
  let kind;
  if (north) kind = q < .16 ? 'catfolk' : q < .32 ? 'guard' : q < .45 ? 'child' : q < .7 ? 'cloak' : 'villager';
  else kind = q < .14 ? 'hunter' : q < .28 ? 'guard' : q < .4 ? 'child' : q < .62 ? 'cloak' : 'villager';
  const h = .16 * GH * (kind === 'child' ? .64 : rnd(.92, 1.06));
  const p = { kind, dir, h, x: forceX !== undefined ? forceX : (dir > 0 ? -30 : W + 30), y: F.r0 + (F.r1 - F.r0) * rnd(.35, .95), v: h * rnd(.55, .8), ph: R() * 6.28, stop: 0,
    shirt: CLOAKS[R() * CLOAKS.length | 0], pants: ['#3a3028', '#4a4038', '#2e2e36'][R() * 3 | 0], skin: SKIN[R() * SKIN.length | 0],
    fur: ['#c99a5a', '#8a6a4a', '#d8c4a0', '#5a4636'][R() * 4 | 0], basket: kind === 'villager' && R() < .4, traded: false };
  p.robe = kind === 'cloak' || kind === 'catfolk' || (kind === 'villager' && R() < .5);
  F.people.push(p);
  return p;
}

function drawFolk(p, nightK, light) {
  const s = p.h, moving = !(p.stop > 0), sw = moving ? Math.sin(p.ph) : 0, amp = .14;
  const k = nightK * .72 * (1 - (light || 0) * .55);
  const C = c => shade(c, k);
  ctx.save(); ctx.translate(p.x, p.y); if (p.dir < 0) ctx.scale(-1, 1); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(0, 0, s * .2, s * .04, 0, 0, 6.283); ctx.fill();

  if (p.kind === 'catfolk') {
    ctx.strokeStyle = C(p.fur); ctx.lineWidth = s * .06;
    ctx.beginPath(); ctx.moveTo(-s * .06, -s * .42); ctx.quadraticCurveTo(-s * .36, -s * .32 + Math.sin(p.ph * .5 + 1) * s * .06, -s * .3, -s * .62 + Math.sin(p.ph * .7) * s * .05); ctx.stroke();
  }
  ctx.strokeStyle = C(p.kind === 'catfolk' ? p.fur : p.pants); ctx.lineWidth = s * .1;
  ctx.beginPath(); ctx.moveTo(0, -s * .46); ctx.lineTo(sw * s * amp, -s * .02); ctx.moveTo(0, -s * .46); ctx.lineTo(-sw * s * amp, -s * .02); ctx.stroke();
  if (p.robe) {
    ctx.fillStyle = C(p.shirt);
    ctx.beginPath(); ctx.moveTo(-s * .1, -s * .8); ctx.lineTo(s * .1, -s * .8); ctx.lineTo(s * .17 + sw * s * .03, -s * .12); ctx.lineTo(-s * .17 + sw * s * .03, -s * .12); ctx.closePath(); ctx.fill();
  } else {
    ctx.strokeStyle = C(p.shirt); ctx.lineWidth = s * .17; ctx.beginPath(); ctx.moveTo(0, -s * .5); ctx.lineTo(0, -s * .78); ctx.stroke();
  }
  ctx.strokeStyle = C(p.shirt); ctx.lineWidth = s * .07;
  ctx.beginPath(); ctx.moveTo(0, -s * .74); ctx.lineTo(-sw * s * .12, -s * .5); ctx.moveTo(0, -s * .74);
  if (p.kind === 'guard') ctx.lineTo(s * .12, -s * .55); else ctx.lineTo(sw * s * .12, -s * .5);
  ctx.stroke();

  if (p.kind === 'guard') {
    ctx.strokeStyle = C('#6a5038'); ctx.lineWidth = s * .03; ctx.beginPath(); ctx.moveTo(s * .14, -s * .02); ctx.lineTo(s * .14, -s * 1.15); ctx.stroke();
    ctx.fillStyle = C('#b9bec6'); ctx.beginPath(); ctx.moveTo(s * .14, -s * 1.25); ctx.lineTo(s * .1, -s * 1.13); ctx.lineTo(s * .18, -s * 1.13); ctx.fill();
    ctx.fillStyle = C(F_SHIELD); ctx.beginPath(); ctx.ellipse(-s * .02, -s * .58, s * .13, s * .16, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = C('#c9a54a'); ctx.lineWidth = s * .025; ctx.stroke();
  }
  if (p.kind === 'hunter') {
    ctx.strokeStyle = C('#9aa0a8'); ctx.lineWidth = s * .03; ctx.beginPath(); ctx.moveTo(-s * .12, -s * .45); ctx.lineTo(s * .12, -s * .98); ctx.stroke();
  }
  if (p.basket) { ctx.fillStyle = C('#b98a4a'); ctx.fillRect(s * .05 + sw * s * .1, -s * .56, s * .14, s * .1); }

  const hx = 0, hy = -s * .9;
  ctx.fillStyle = C(p.kind === 'catfolk' ? p.fur : p.skin); ctx.beginPath(); ctx.arc(hx, hy, s * .085, 0, 6.283); ctx.fill();
  if (p.kind === 'catfolk') {
    ctx.beginPath(); ctx.moveTo(-s * .07, hy - s * .04); ctx.lineTo(-s * .05, hy - s * .15); ctx.lineTo(-s * .01, hy - s * .07); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * .01, hy - s * .07); ctx.lineTo(s * .05, hy - s * .15); ctx.lineTo(s * .07, hy - s * .04); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s * .07, hy + s * .02, s * .045, s * .03, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = nightK > .5 ? '#d8ff7a' : '#2a2a20'; ctx.beginPath(); ctx.arc(s * .045, hy - s * .015, s * .014, 0, 6.283); ctx.fill();
  } else if (p.kind === 'guard') {
    ctx.fillStyle = C('#8e949c'); ctx.beginPath(); ctx.arc(hx, hy - s * .01, s * .095, Math.PI, 0); ctx.fill(); ctx.fillRect(s * .03, hy - s * .02, s * .02, s * .08);
  } else if (p.kind === 'cloak' || p.kind === 'hunter') {
    ctx.fillStyle = C(p.shirt); ctx.beginPath(); ctx.arc(hx - s * .015, hy - s * .005, s * .1, Math.PI * .6, Math.PI * 2.05); ctx.fill();
  }
  ctx.restore();
}

function drawQuad(a, nightK) {
  const s = a.s, k = nightK * .75;
  const col = shade(a.col, k);
  ctx.save(); ctx.translate(a.x, a.y); if (a.dir < 0) ctx.scale(-1, 1); ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, 0, s * .5, s * .06, 0, 0, 6.283); ctx.fill();
  const legH = s * (a.kind === 'crawler' ? .28 : a.kind === 'dog' ? .3 : .5), bodyY = -legH;
  ctx.strokeStyle = col; ctx.lineWidth = s * (a.kind === 'horse' ? .09 : .07);
  ctx.beginPath();
  for (const [lx, ph] of [[-.3, 0], [-.22, Math.PI], [.25, Math.PI], [.33, 0]]) {
    const m = a.moving ? Math.sin(a.ph + ph) : 0;
    if (a.kind === 'crawler') { ctx.moveTo(s * lx, bodyY); ctx.lineTo(s * (lx + .12) + m * s * .1, bodyY + legH * .2); ctx.lineTo(s * (lx + .05) + m * s * .12, 0); }
    else { ctx.moveTo(s * lx, bodyY); ctx.lineTo(s * lx + m * s * .1, 0); }
  }
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, bodyY - s * .08, s * .42, s * (a.kind === 'crawler' ? .13 : .16), a.kind === 'crawler' ? -.15 : 0, 0, 6.283); ctx.fill();
  const graze = a.graze > 0;
  const nx = s * .38, ny = bodyY - s * .12, hx = s * (graze ? .55 : .6), hy = graze ? -s * .08 : bodyY - s * (a.kind === 'crawler' ? .2 : .42);
  ctx.lineWidth = s * (a.kind === 'horse' ? .14 : .1); ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(hx + s * .06, hy, s * .11, s * .065, graze ? .9 : .2, 0, 6.283); ctx.fill();

  if (a.kind === 'deer') {
    ctx.strokeStyle = shade('#d8c6a2', k); ctx.lineWidth = s * .025; ctx.beginPath();
    ctx.moveTo(hx, hy - s * .05); ctx.lineTo(hx - s * .1, hy - s * .28); ctx.lineTo(hx - s * .2, hy - s * .32); ctx.moveTo(hx - s * .06, hy - s * .18); ctx.lineTo(hx + s * .02, hy - s * .3);
    ctx.moveTo(hx + s * .03, hy - s * .05); ctx.lineTo(hx + s * .02, hy - s * .3); ctx.lineTo(hx + s * .1, hy - s * .36); ctx.stroke();
  }
  if (a.kind === 'horse') {
    ctx.strokeStyle = shade('#3a2a20', k); ctx.lineWidth = s * .05; ctx.beginPath(); ctx.moveTo(nx, ny - s * .05); ctx.lineTo(hx - s * .04, hy - s * .06); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .42, bodyY - s * .1); ctx.quadraticCurveTo(-s * .55, bodyY, -s * .5, bodyY + s * .2); ctx.stroke();
  }
  if (a.kind === 'dog') {
    ctx.strokeStyle = col; ctx.lineWidth = s * .05; ctx.beginPath(); ctx.moveTo(-s * .4, bodyY - s * .1); ctx.lineTo(-s * .55, bodyY - s * .3 + Math.sin(a.ph * 2) * s * .05); ctx.stroke();
  }
  ctx.restore();
}

function drawBrute(g, nightK, troll) {
  const s = g.h, sw = g.rest > 0 ? 0 : Math.sin(g.ph), k = nightK * .78;
  const skin = shade(troll ? '#7d8a6a' : '#b49b80', k), fur = shade(troll ? '#4a4a3a' : '#6b4f36', k);
  ctx.save(); ctx.translate(g.x, g.y); if (g.dir < 0) ctx.scale(-1, 1); ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(0, 0, s * .28, s * .04, 0, 0, 6.283); ctx.fill();
  ctx.strokeStyle = skin; ctx.lineWidth = s * .13;
  ctx.beginPath(); ctx.moveTo(-s * .05, -s * .42); ctx.lineTo(-s * .05 + sw * s * .09, -s * .03); ctx.moveTo(s * .05, -s * .42); ctx.lineTo(s * .05 - sw * s * .09, -s * .03); ctx.stroke();
  const lean = troll ? .12 : 0;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(s * lean, -s * .62, s * .2, s * .24, troll ? .25 : 0, 0, 6.283); ctx.fill();
  ctx.fillStyle = fur; ctx.fillRect(-s * .17, -s * .5, s * .34, s * .12);
  ctx.strokeStyle = skin; ctx.lineWidth = s * .1;
  ctx.beginPath(); ctx.moveTo(s * (lean + .02), -s * .78); ctx.lineTo(s * (lean - .1) - sw * s * .08, -s * (troll ? .25 : .45)); ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(s * (lean + .14), -s * (troll ? .86 : .95), s * .085, 0, 6.283); ctx.fill();
  if (troll) {
    ctx.fillStyle = shade('#efe6cf', k); ctx.beginPath(); ctx.moveTo(s * (lean + .19), -s * .84); ctx.lineTo(s * (lean + .22), -s * .92); ctx.lineTo(s * (lean + .17), -s * .86); ctx.fill();
  } else {
    ctx.fillStyle = shade('#d9d2c4', k); ctx.beginPath(); ctx.moveTo(s * .08, -s * .92); ctx.lineTo(s * .24, -s * .92); ctx.lineTo(s * .17, -s * .78); ctx.fill();
  }
  ctx.strokeStyle = skin; ctx.lineWidth = s * .1; ctx.beginPath(); ctx.moveTo(s * (lean + .05), -s * .78); ctx.lineTo(s * (lean + .2), -s * (troll ? .35 : .62)); ctx.stroke();
  ctx.strokeStyle = shade('#5a4030', k); ctx.lineWidth = s * .07;
  ctx.beginPath(); if (troll) { ctx.moveTo(s * (lean + .2), -s * .35); ctx.lineTo(s * (lean + .32), -s * .02); } else { ctx.moveTo(s * .2, -s * .62); ctx.lineTo(s * .05, -s * 1.15); } ctx.stroke();
  ctx.restore();
}

function drawWing(span, flap, col) {
  const f = flap;
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(-span * .3, -span * .55 * f - span * .05); ctx.lineTo(-span * .9, -span * .7 * f + span * .05);
  ctx.lineTo(-span * .7, -span * .25 * f + span * .12); ctx.lineTo(-span * .55, -span * .1 * f + span * .2); ctx.lineTo(-span * .3, span * .12); ctx.closePath(); ctx.fill();
}

function drawFlyer(d, t, nightK, dayK) {
  const s = d.s, flap = Math.sin(t * d.fs + d.p);
  ctx.save(); ctx.translate(d.x, d.y + Math.sin(t * 1.3 + d.p) * s * .08); if (d.dir < 0) ctx.scale(-1, 1);
  if (d.kind === 'dragon') {
    const body = mixc(hex('#3c4555'), [8, 10, 18], nightK * .85), dark = rgb(mixc(body, [0, 0, 0], .3));
    ctx.save(); ctx.translate(s * .08, -s * .06); drawWing(s * 1.5, flap, dark); ctx.restore();
    ctx.fillStyle = rgb(body);
    ctx.beginPath(); ctx.moveTo(-s * .35, -s * .05);
    const tw = Math.sin(t * 2 + d.p) * s * .08;
    ctx.quadraticCurveTo(-s * .9, s * .05 + tw, -s * 1.35, -s * .02 + tw * 1.6); ctx.lineTo(-s * 1.32, s * .04 + tw * 1.6); ctx.quadraticCurveTo(-s * .9, s * .12 + tw, -s * .35, s * .07); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * 1.35, -s * .02 + tw * 1.6); ctx.lineTo(-s * 1.48, -s * .08 + tw * 1.6); ctx.lineTo(-s * 1.44, s * .06 + tw * 1.6); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, 0, s * .45, s * .15, -.05, 0, 6.283); ctx.fill();
    ctx.strokeStyle = rgb(body); ctx.lineWidth = s * .12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * .3, -s * .04); ctx.quadraticCurveTo(s * .6, -s * .1, s * .78, -s * .24); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * .74, -s * .32); ctx.lineTo(s * 1.04, -s * .27); ctx.lineTo(s * 1.06, -s * .21); ctx.lineTo(s * .76, -s * .17); ctx.closePath(); ctx.fill();
    ctx.lineWidth = s * .025; ctx.beginPath(); ctx.moveTo(s * .78, -s * .31); ctx.lineTo(s * .64, -s * .42); ctx.moveTo(s * .84, -s * .31); ctx.lineTo(s * .74, -s * .44); ctx.stroke();
    ctx.lineWidth = s * .05; ctx.beginPath(); ctx.moveTo(s * .2, s * .1); ctx.lineTo(s * .28, s * .22); ctx.moveTo(-s * .2, s * .1); ctx.lineTo(-s * .12, s * .23); ctx.stroke();
    if (nightK > .4) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(s * .9, -s * .27, s * .02, 0, 6.283); ctx.fill(); }
    if (d.fire > 0) {
      const fl = Math.min(1, d.fire);
      const fg = ctx.createLinearGradient(s * 1.05, -s * .23, s * 2.1, -s * .05);
      fg.addColorStop(0, `rgba(255,240,180,${.95 * fl})`); fg.addColorStop(.35, `rgba(255,150,40,${.8 * fl})`); fg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(s * 1.05, -s * .24); ctx.lineTo(s * 2.1, -s * .38 + Math.sin(t * 30) * s * .03); ctx.lineTo(s * 2.15, s * .15); ctx.lineTo(s * 1.05, -s * .2); ctx.fill();
    }
    ctx.save(); ctx.translate(-s * .02, -s * .02); drawWing(s * 1.6, flap * .9 + .15, rgb(mixc(body, [255, 255, 255], .12))); ctx.restore();
  } else {
    const tawny = shade('#b98a4e', nightK * .8), wing = shade('#7a5a3a', nightK * .8), white = shade('#ece4d2', nightK * .8);
    ctx.save(); ctx.translate(s * .1, -s * .08); drawWing(s * .95, flap, shade('#5c4430', nightK * .8)); ctx.restore();
    ctx.fillStyle = tawny; ctx.beginPath(); ctx.ellipse(-s * .05, 0, s * .4, s * .15, 0, 0, 6.283); ctx.fill();
    ctx.strokeStyle = tawny; ctx.lineWidth = s * .06; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * .4, -s * .02); ctx.quadraticCurveTo(-s * .7, -s * .05, -s * .75, -s * .2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .3, s * .1); ctx.lineTo(-s * .38, s * .3); ctx.moveTo(-s * .18, s * .1); ctx.lineTo(-s * .24, s * .3); ctx.stroke();
    ctx.fillStyle = white; ctx.beginPath(); ctx.ellipse(s * .3, -s * .06, s * .18, s * .14, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.arc(s * .48, -s * .18, s * .1, 0, 6.283); ctx.fill();
    ctx.fillStyle = shade('#e8b030', nightK * .6); ctx.beginPath(); ctx.moveTo(s * .56, -s * .21); ctx.lineTo(s * .68, -s * .16); ctx.lineTo(s * .56, -s * .13); ctx.fill();
    ctx.strokeStyle = shade('#e8b030', nightK * .6); ctx.lineWidth = s * .035; ctx.beginPath(); ctx.moveTo(s * .3, s * .08); ctx.lineTo(s * .36, s * .28); ctx.moveTo(s * .2, s * .1); ctx.lineTo(s * .24, s * .29); ctx.stroke();
    ctx.save(); ctx.translate(s * .05, -s * .05); drawWing(s * 1.0, flap * .9 + .1, wing); ctx.restore();
  }
  ctx.restore();
}

function drawAurora(t, nightK, bass) {
  const a0 = Math.pow(nightK, 2) * (.55 + .6 * (bass || 0));
  if (a0 < .02) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const bands = [[HZ * .18, '#3cffb0', 1.0], [HZ * .26, '#4ad8ff', .7], [HZ * .12, '#b07aff', .5]];
  for (let b = 0; b < bands.length; b++) {
    const [by, col, k] = bands[b], len = HZ * .22;
    const ag = ctx.createLinearGradient(0, by - HZ * .08, 0, by + len);
    ag.addColorStop(0, 'rgba(0,0,0,0)'); ag.addColorStop(.25, col); ag.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ag;
    for (let x = 0; x < W; x += 6) {
      const y = by + Math.sin(x * .004 + t * .18 + b) * HZ * .05 + Math.sin(x * .011 - t * .11 + b * 2) * HZ * .025;
      const fl = .5 + .5 * Math.sin(x * .02 + t * .9 + b * 1.7);
      ctx.globalAlpha = a0 * k * (.25 + .55 * fl) * .5;
      ctx.fillRect(x, y, 6, len * (.6 + .4 * fl));
    }
  }
  ctx.restore();
}

function drawFantasy(t, dt, dayK, nightK, warm, moon, bass) {
  const F = fant, north = F.kind === 'north';
  const cross = arr => {
    if (dayK < .99) ctx.drawImage(arr[0], 0, 0, W, H);
    if (dayK > .01) { ctx.globalAlpha = dayK; ctx.drawImage(arr[1], 0, 0, W, H); ctx.globalAlpha = 1; }
  };

  if (north) drawAurora(t, nightK, bass);

  // Flyers (dragons / griffins)
  F.nextFlyer -= dt;
  if (F.nextFlyer <= 0) {
    const dir = R() < .5 ? 1 : -1, sz = (north ? rnd(.07, .11) : rnd(.045, .07)) * H;
    F.flyers.push({ kind: north ? 'dragon' : 'griffin', dir, x: dir > 0 ? -sz * 2 : W + sz * 2, y: rnd(.1, .38) * HZ, s: sz, v: W / rnd(14, 22), fs: north ? rnd(3.5, 4.5) : rnd(5, 6.5), p: R() * 6, fire: 0, fireAt: north && R() < .45 ? rnd(.3, .7) : -1 });
    F.nextFlyer = north ? rnd(35, 80) : rnd(25, 60);
  }
  cross(F.back);

  for (const d of F.flyers) {
    d.x += d.v * d.dir * dt;
    const prog = d.dir > 0 ? d.x / W : 1 - d.x / W;
    if (d.fireAt > 0 && prog > d.fireAt) { d.fire = 1.6; d.fireAt = -1; }
    if (d.fire > 0) d.fire -= dt;
    drawFlyer(d, t, nightK, dayK);
  }
  F.flyers = F.flyers.filter(d => d.x > -d.s * 3 && d.x < W + d.s * 3);

  // Ground creatures behind village
  F.nextBeast -= dt;
  if (F.nextBeast <= 0) {
    F.nextBeast = rnd(6, 14);
    if (north) {
      const q = R();
      if (q < .3 && !F.beasts.some(b => b.kind === 'giant')) { const dir = R() < .5 ? 1 : -1; F.beasts.push({ kind: 'giant', dir, x: dir > 0 ? -60 : W + 60, y: F.giantY, h: .26 * GH, v: .26 * GH * .14, ph: 0, rest: 0 }); }
      else if (q < .75 && F.beasts.filter(b => b.kind === 'deer').length < 3) { const dir = R() < .5 ? 1 : -1; F.beasts.push({ kind: 'deer', dir, x: dir > 0 ? -30 : W + 30, y: F.deerY + rnd(-.01, .02) * GH, s: .06 * GH, col: '#8a6446', v: .06 * GH * .7, ph: 0, moving: true, graze: 0 }); }
      else if (F.beasts.filter(b => b.kind === 'dog').length < 1) { const dir = R() < .5 ? 1 : -1; F.beasts.push({ kind: 'dog', dir, x: dir > 0 ? -20 : W + 20, y: F.r0 + (F.r1 - F.r0) * .5, s: .05 * GH, col: '#6a5644', v: .05 * GH * 2.2, ph: 0, moving: true, graze: 0, road: true }); }
    } else {
      const crawlers = F.beasts.filter(b => b.kind === 'crawler').length;
      if (crawlers < (nightK > .5 ? 4 : 2) && R() < .5 + nightK * .4) F.beasts.push({ kind: 'crawler', dir: 1, x: rnd(.04, .3) * W, y: HZ + rnd(.12, .16) * GH, s: .065 * GH, col: '#7d8f74', v: .065 * GH * rnd(.6, 1), ph: R() * 6, moving: true, graze: 0, life: rnd(8, 16), home: 0 });
      else if (F.beasts.filter(b => b.kind === 'dog').length < 1) { const dir = R() < .5 ? 1 : -1; F.beasts.push({ kind: 'dog', dir, x: dir > 0 ? -20 : W + 20, y: F.r0 + (F.r1 - F.r0) * .5, s: .05 * GH, col: '#7a6040', v: .05 * GH * 2.2, ph: 0, moving: true, graze: 0, road: true }); }
    }
  }

  for (const b of F.beasts) {
    if (b.kind === 'giant') { if (b.rest > 0) b.rest -= dt; else { b.x += b.v * b.dir * dt; b.ph += dt * 1.6; if (R() < dt * .03) b.rest = rnd(2, 5); } continue; }
    if (b.kind === 'deer') { if (b.graze > 0) { b.graze -= dt; b.moving = false; } else { b.moving = true; b.x += b.v * b.dir * dt; b.ph += dt * 5; if (R() < dt * .12) b.graze = rnd(2, 6); } continue; }
    if (b.kind === 'crawler') { b.life -= dt; if (b.life < 0 && !b.home) { b.dir = -1; b.home = 1; } b.x += b.v * b.dir * dt; b.ph += dt * 7; continue; }
    b.x += b.v * b.dir * dt; b.ph += dt * 9;
  }
  F.beasts = F.beasts.filter(b => b.x > -80 && b.x < W + 80 && !(b.kind === 'crawler' && b.home && b.x < -20));
  for (const b of F.beasts) if (!b.road) { if (b.kind === 'giant') drawBrute(b, nightK, false); else drawQuad(b, nightK); }

  if (!north) {
    const T = F.troll;
    if (T.rest > 0) T.rest -= dt; else { T.x += T.h * .12 * T.dir * dt; T.ph += dt * 1.8; if (Math.abs(T.x - (F.river.bx + .02 * W)) > .07 * W) T.dir = Math.sign(F.river.bx + .02 * W - T.x); if (R() < dt * .05) T.rest = rnd(3, 7); }
    drawBrute(T, nightK, true);
    const M = F.mill, ang = t * .5;
    ctx.save(); ctx.translate(M.x, M.base - M.h * .82); ctx.rotate(ang);
    ctx.fillStyle = shade('#efe3c4', nightK * .8); ctx.strokeStyle = shade('#6a4a30', nightK * .8); ctx.lineWidth = 2 * S;
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.fillRect(M.h * .03, -M.h * .035, M.h * .5, M.h * .07); ctx.strokeRect(M.h * .03, -M.h * .035, M.h * .5, M.h * .07); }
    ctx.restore();
    const C = F.castle;
    ctx.strokeStyle = shade('#4a4038', nightK * .7); ctx.lineWidth = 1.5;
    for (const [i, tx] of [[0, -.6], [1, .6], [2, 0]].map(([idx, x]) => [idx, x])) {
      const ctop = tx === 0 ? C.y - C.s * 1.65 : C.y - C.s * 1.5, fxp = C.x + tx * C.s;
      ctx.beginPath(); ctx.moveTo(fxp, ctop); ctx.lineTo(fxp, ctop - C.s * .3); ctx.stroke();
      ctx.fillStyle = shade(i === 2 ? '#d9b23a' : '#3a5fa8', nightK * .7);
      ctx.beginPath(); ctx.moveTo(fxp, ctop - C.s * .3); ctx.quadraticCurveTo(fxp + C.s * .15, ctop - C.s * .3 + Math.sin(t * 4 + i) * C.s * .04, fxp + C.s * .28, ctop - C.s * .25); ctx.lineTo(fxp, ctop - C.s * .18); ctx.fill();
    }
    if (nightK > .3) { ctx.fillStyle = `rgba(255,200,120,${.8 * nightK})`; for (const tx of [-.6, 0, .6]) ctx.fillRect(C.x + tx * C.s - 2, C.y - C.s * .75, 4, 6); }
  }

  // Chimney smoke
  for (const ch of F.chimneys) { ch.next -= dt; if (ch.next <= 0) { ch.next = rnd(.5, .9); F.puffs.push({ x: ch.x, y: ch.y - 12 * S, r: 4 * S, a: .5, vx: rnd(4, 10) * S }); } }
  cross(F.mid);
  ctx.fillStyle = dayK > .5 ? '#e8e8ec' : '#9aa0b8';
  for (const pf of F.puffs) { pf.y -= 14 * S * dt; pf.x += pf.vx * dt; pf.r += 6 * S * dt; pf.a -= dt * .13; if (pf.a > 0) { ctx.globalAlpha = pf.a * (.35 + .4 * dayK); ctx.beginPath(); ctx.arc(pf.x, pf.y, pf.r, 0, 6.283); ctx.fill(); } }
  ctx.globalAlpha = 1; F.puffs = F.puffs.filter(pf => pf.a > 0);

  // Reactive Windows
  ctx.fillStyle = '#ffc870';
  for (const w of F.windows) {
    const a = (w.b || 0) * (.25 + .7 * nightK);
    if (a > .03) { ctx.globalAlpha = a; ctx.fillRect(w.x, w.y, w.w, w.h); }
  }
  ctx.globalAlpha = 1;

  // Torches / Lanterns
  for (const L of F.lights) {
    const fl = .75 + .25 * Math.sin(t * 13 + L.p) * Math.sin(t * 7.3 + L.p * 2);
    if (L.kind === 'torch') { ctx.fillStyle = shade('#5a3a22', nightK * .6); ctx.fillRect(L.x - 1.5 * S, L.y, 3 * S, 14 * S); }
    else { ctx.fillStyle = shade('#3a3a3a', nightK * .5); ctx.fillRect(L.x - 4 * S, L.y - 2 * S, 8 * S, 10 * S); }
    ctx.fillStyle = L.kind === 'torch' ? '#ffb340' : '#ffd88a';
    ctx.beginPath(); ctx.ellipse(L.x, L.y - (L.kind === 'torch' ? 3 * S : -3 * S), 3 * S * fl, 5 * S * fl, 0, 0, 6.283); ctx.fill();
    if (nightK > .15) {
      const lgl = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 40 * S * fl);
      lgl.addColorStop(0, `rgba(255,180,80,${.45 * nightK})`); lgl.addColorStop(1, 'rgba(255,180,80,0)');
      ctx.fillStyle = lgl; ctx.fillRect(L.x - 40 * S, L.y - 40 * S, 80 * S, 80 * S);
    }
  }

  // Merchant stall (north)
  if (north) {
    const st = F.stall;
    drawFolk({ kind: 'catfolk', dir: -1, h: .15 * GH, x: st.x + st.w * .1, y: F.yV - st.w * .3, ph: t * 1.2, stop: 1, shirt: '#7a3b6a', pants: '#3a3028', fur: '#c99a5a', skin: '#c99a5a', robe: true }, nightK, nightK > .3 ? .8 : 0);
  }

  // Spellcasting Mage (medieval)
  if (!north) {
    const M = F.mage; M.cool -= dt; M.cast -= dt;
    if (M.cool <= 0 && ((bass || 0) > .72 || R() < dt * .08)) {
      M.cast = 2.2; M.cool = rnd(5, 10);
      for (let i = 0; i < 40; i++) M.sparks.push({ a: R() * 6.28, r: 0, v: rnd(20, 70) * S, h: 0, vh: rnd(20, 80) * S, life: rnd(1, 2), col: R() < .5 ? '#9ad7ff' : '#d39bff' });
    }
    const casting = M.cast > 0, s = M.h;
    ctx.save(); ctx.translate(M.x, M.y); ctx.lineCap = 'round';
    const k = nightK * .7;
    ctx.fillStyle = shade('#3b3a8a', k); ctx.beginPath(); ctx.moveTo(-s * .12, -s * .78); ctx.lineTo(s * .12, -s * .78); ctx.lineTo(s * .2, 0); ctx.lineTo(-s * .2, 0); ctx.fill();
    ctx.strokeStyle = shade('#3b3a8a', k); ctx.lineWidth = s * .07;
    ctx.beginPath(); ctx.moveTo(0, -s * .72); ctx.lineTo(s * .18, casting ? -s * 1.05 : -s * .5); ctx.moveTo(0, -s * .72); ctx.lineTo(-s * .16, casting ? -s * 1.0 : -s * .5); ctx.stroke();
    ctx.fillStyle = shade('#e8d4b8', k); ctx.beginPath(); ctx.arc(0, -s * .88, s * .085, 0, 6.283); ctx.fill();
    ctx.fillStyle = shade('#d8d8e0', k); ctx.beginPath(); ctx.moveTo(-s * .06, -s * .85); ctx.lineTo(s * .06, -s * .85); ctx.lineTo(0, -s * .62); ctx.fill();
    ctx.fillStyle = shade('#2d2c70', k); ctx.beginPath(); ctx.moveTo(-s * .15, -s * .93); ctx.lineTo(s * .15, -s * .93); ctx.lineTo(s * .03, -s * 1.3); ctx.fill();
    const sx = s * .18, sy = casting ? -s * 1.05 : -s * .5;
    ctx.strokeStyle = shade('#6a4a30', k); ctx.lineWidth = s * .03; ctx.beginPath(); ctx.moveTo(sx, sy + s * .45); ctx.lineTo(sx, sy - s * .25); ctx.stroke();
    const orb = .5 + .5 * Math.sin(t * 3) + (casting ? 1 : 0);
    const og = ctx.createRadialGradient(sx, sy - s * .28, 0, sx, sy - s * .28, s * .25 * (1 + orb * .5));
    og.addColorStop(0, `rgba(170,220,255,${.9})`); og.addColorStop(1, 'rgba(120,120,255,0)');
    ctx.fillStyle = og; ctx.beginPath(); ctx.arc(sx, sy - s * .28, s * .25 * (1 + orb * .5), 0, 6.283); ctx.fill();
    if (casting) { ctx.strokeStyle = `rgba(160,140,255,${Math.min(1, M.cast) * .8})`; ctx.lineWidth = 2 * S; ctx.beginPath(); ctx.ellipse(0, 0, s * .5 * (2.2 - M.cast + .4), s * .1 * (2.2 - M.cast + .4), 0, 0, 6.283); ctx.stroke(); }
    for (const sp of M.sparks) { sp.r += sp.v * dt; sp.h += sp.vh * dt; sp.life -= dt; if (sp.life > 0) { ctx.globalAlpha = Math.min(1, sp.life); ctx.fillStyle = sp.col; ctx.beginPath(); ctx.arc(sx + Math.cos(sp.a) * sp.r, sy - s * .28 - sp.h + Math.sin(sp.a) * sp.r * .3, 2.2 * S, 0, 6.283); ctx.fill(); } }
    ctx.globalAlpha = 1; M.sparks = M.sparks.filter(sp => sp.life > 0);
    ctx.restore();
  }

  // Caravan Wagon
  F.nextWagon -= dt;
  if (!F.wagon && F.nextWagon <= 0) {
    const dir = R() < .5 ? 1 : -1;
    F.wagon = { dir, x: dir > 0 ? -.4 * GH : W + .4 * GH, y: F.r0 + (F.r1 - F.r0) * .55, v: .16 * GH * .5, ph: 0 };
    if (north) F.wagon.walker = { kind: 'catfolk', dir, h: .15 * GH, x: 0, y: F.wagon.y + .04 * GH, ph: 0, shirt: '#3a6a7a', pants: '#3a3028', fur: '#d8c4a0', skin: '#d8c4a0', robe: true };
  }

  // Walkers on the road
  F.nextWalker -= dt;
  const want = Math.round((3 + 9 * dayK) * Math.max(.6, W / 1600));
  if (F.nextWalker <= 0) { if (F.people.length < want) spawnWalker(F, dayK); F.nextWalker = rnd(1.5, 4.5); }
  for (const p of F.people) {
    if (p.stop > 0) { p.stop -= dt; continue; }
    if (north && !p.traded && Math.abs(p.x - F.stall.x) < 8 && R() < .5) { p.traded = true; p.stop = rnd(3, 6); continue; }
    if (north && Math.abs(p.x - F.stall.x) < 8) p.traded = true;
    p.x += p.v * p.dir * dt; p.ph += dt * p.v / (p.h * .28);
  }
  F.people = F.people.filter(p => p.x > -60 && p.x < W + 60);

  const drawList = F.people.slice();
  for (const b of F.beasts) if (b.road) drawList.push(b);
  if (F.wagon) drawList.push(F.wagon);
  drawList.sort((a, b) => a.y - b.y);

  const lightAt = x => { let m = 0; for (const L of F.lights) { const d = (x - L.x) / (60 * S); m = Math.max(m, Math.exp(-d * d)); } return m * nightK; };
  for (const it of drawList) {
    if (it === F.wagon) drawWagon(F, it, dt, nightK, north);
    else if (it.kind === 'dog') drawQuad(it, nightK);
    else drawFolk(it, nightK, lightAt(it.x));
  }

  cross(F.fg);

  // Falling snow
  if (north) {
    ctx.fillStyle = '#ffffff';
    for (const f of F.snow) {
      f.y += f.v * dt; f.x += Math.sin(t * f.w + f.p) * 12 * S * dt;
      if (f.y > H) { f.y = -5; f.x = R() * W; }
      ctx.globalAlpha = .55 + .3 * dayK; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawWagon(F, w, dt, nightK, north) {
  w.x += w.v * w.dir * dt; w.ph += dt * 4;
  if (w.x < -.6 * GH || w.x > W + .6 * GH) { F.wagon = null; F.nextWagon = rnd(45, 90); return; }
  const s = .16 * GH, k = nightK * .72;
  const horse = { kind: 'horse', dir: w.dir, x: w.x + w.dir * s * 1.25, y: w.y, s: s * .95, col: '#6a4a30', ph: w.ph * 1.6, moving: true, graze: 0 };
  drawQuad(horse, nightK);
  ctx.save(); ctx.translate(w.x, w.y); if (w.dir < 0) ctx.scale(-1, 1);
  ctx.strokeStyle = shade('#4a3422', k); ctx.lineWidth = s * .04; ctx.beginPath(); ctx.moveTo(s * .45, -s * .3); ctx.lineTo(s * .95, -s * .4); ctx.stroke();
  ctx.fillStyle = shade('#7a5636', k); ctx.fillRect(-s * .6, -s * .5, s * 1.05, s * .25);
  if (north) {
    ctx.fillStyle = shade('#b8433a', k); ctx.beginPath(); ctx.moveTo(-s * .62, -s * .5); ctx.quadraticCurveTo(-s * .08, -s * 1.15, s * .47, -s * .5); ctx.fill();
    ctx.fillStyle = shade('#e8c45a', k); ctx.beginPath(); ctx.moveTo(-s * .3, -s * .5); ctx.quadraticCurveTo(-s * .08, -s * 1.0, s * .15, -s * .5); ctx.fill();
  } else {
    ctx.fillStyle = shade('#d9b552', k); ctx.beginPath(); ctx.ellipse(-s * .08, -s * .58, s * .5, s * .2, 0, Math.PI, 0); ctx.fill();
  }
  for (const wx of [-s * .4, s * .25]) {
    ctx.strokeStyle = shade('#3a2a1c', k); ctx.lineWidth = s * .035; ctx.beginPath(); ctx.arc(wx, -s * .16, s * .16, 0, 6.283); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = w.ph * 1.5 + i * Math.PI / 4;
      ctx.beginPath(); ctx.moveTo(wx - Math.cos(a) * s * .15, -s * .16 - Math.sin(a) * s * .15); ctx.lineTo(wx + Math.cos(a) * s * .15, -s * .16 + Math.sin(a) * s * .15); ctx.stroke();
    }
  }
  ctx.restore();
  if (w.walker) { const p = w.walker; p.x = w.x - w.dir * s * .9; p.ph += dt * 6; drawFolk(p, nightK, 0); }
}
