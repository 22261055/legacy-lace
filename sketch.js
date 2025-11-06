/* LEGACY LACE : 1920x1080 (p5.js)
   - 폰트: 시스템 기본 고딕(sans-serif)
   - 배경: #000000
   - 도트/파티클: #ACACAC
   - 시작 문장(#FFFFFF): 숨쉬는 듯 밝기 변화, 클릭 시 체험 시작
   - 자막: #C8FF00, 하단 중앙, 온점 단위 3초 유지
   - 방향키 인터랙션(↑, ↓, →, ←), R 리셋
*/

// ----- 컬렉션 (ArrayList -> 배열) -----
let rainParticles = [];   // Particle[]
let letters = [];         // LPix[]
let evapParticles = [];   // Evap[]

// ----- 화면 기본 설정 -----
const BASE_W = 1920;
const BASE_H = 1080;
let scaleFactor = 1.0, offsetX = 0, offsetY = 0;

// ----- 텍스트 설정 -----
let TEXT_STR = "LEGACY LACE";
let TEXT_SIZE = 220;
let SAMPLE_STEP = 2;
let DOT_SIZE_BASE = 4.6;
let DOT_SIZE_PART = 3.8;
let STAGGER_ROWS = true;

// ----- 매트릭스 -----
let GRID_STEP = 10;
const DOT_FG = 0xAC;     // #ACACAC (그레이 스케일로 사용)
const BG_ALPHA = 60;
const FG_ALPHA = 255;

// ----- 파티클 물리 -----
let EMIT_PER_FRAME = 15;
const GRAVITY = new p5.Vector(0, 0.15);
const RAIN_FADE = 2.0;
const FRICTION = 0.990;
const START_ALPHA = 180, DUST_FADE = 1.0, DUST_JIT = 0.45, DUST_SPEED0 = 0.9;

// ----- 모드 플래그 -----
let rainMode=false, fadeAll=false, sweepMode=false, pourMode=false;
let started=false;
let EVAP_PER_FRAME=40;
let sweepX=0, sweepSpeed=6.0;
let minX=1e9, maxX=-1e9;

// ----- 폰트 / 색상 -----
let textG, textMask; // p5.Graphics
let uiFont = 'sans-serif';
const BG_COLOR = 0x00;       // #000000
const PIX_COLOR = 0xAC;      // #ACACAC (그레이)
const SUB_COLOR = '#C8FF00'; // 자막
const START_COLOR = 255;     // white

// ----- 시작 문장 -----
const START_CAPTION = "오래된 문고의 한가운데, 먼지 쌓인 활자들이 깨워보세요";
const CAPTION_SIZE = 48;
const CAPTION_Y = BASE_H - 160;
let captionLeft, captionRight, captionTop, captionBot;

// ----- 자막 -----
const SUB_UP = [
  "기억이 흩날리다.",
  "문장의 끝자락이 바람을 타고 사라진다.",
  "한때 누군가의 손끝에서 태어난 단어들이.",
  "오래된 시간의 먼지처럼 천천히 흩어지며 공기 속에 녹아든다."
];
const SUB_DOWN = [
  "시간의 비가 내리다.",
  "천장의 틈새로 떨어지는 빛의 먼지.",
  "종이 위를 적시는 기억의 비.",
  "낡은 활자들이 눈처럼 흩날리며 다시 세상 위로 내려온다."
];
const SUB_RIGHT = [
  "언어의 해체.",
  "한 권의 책이 터지듯, 말들이 흩어진다.",
  "문장들은 형태를 잃고, 의미는 부서진 채 공기 중으로 퍼진다.",
  "그러나 그 혼란 속에서 새로운 문맥이 태어난다."
];
const SUB_LEFT = [
  "기억의 귀환.",
  "흩어진 조각들이 다시 하나의 문장으로 모인다.",
  "책장은 스스로를 다시 엮고, 오래된 문장은 숨을 되찾는다."
];

let currentSubs = null;
let subIndex = 0, subStartMillis = 0, SUB_DURATION = 3000;
let subtitleOn = false;

function setup() {
  const cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('app');
  pixelDensity(1);
  computeScale();

  textFont(uiFont);
  textAlign(CENTER, CENTER);
  noStroke();
  ellipseMode(CENTER);

  buildLetterPixels();
  renderTextMask();

  // 시작 시 스윕 초기 기준
  sweepX = minX - 20;
}

function draw() {
  background(BG_COLOR);

  // 1920x1080 비율 유지 + 중앙 정렬
  const sx = width / BASE_W, sy = height / BASE_H;
  scaleFactor = Math.min(sx, sy);
  const drawW = BASE_W * scaleFactor, drawH = BASE_H * scaleFactor;
  offsetX = (width - drawW) / 2;
  offsetY = (height - drawH) / 2;

  push();
  translate(offsetX, offsetY);
  scale(scaleFactor);

  if (!started) {
    drawDotMatrixBase(false);
    emitEvaporation();
    updateEvaporation();
    drawStartCaption();
  } else {
    drawDotMatrixBase(true);
    updateAndDrawLetterEffects();
    if (rainMode) emitRain();

    for (let i = rainParticles.length - 1; i >= 0; i--) {
      const p = rainParticles[i];
      p.update();
      p.display();
      if (p.isDead()) rainParticles.splice(i, 1);
    }

    loopEffectsIfFinished();
    drawSubtitles();
  }

  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeScale();
}

function computeScale() {
  const sx = width / BASE_W;
  const sy = height / BASE_H;
  scaleFactor = Math.min(sx, sy);
  offsetX = (width - BASE_W * scaleFactor) / 2;
  offsetY = (height - BASE_H * scaleFactor) / 2;
}

/* ---------- 숨쉬는 시작 문장 ---------- */
function drawStartCaption() {
  textFont(uiFont);
  textAlign(CENTER, CENTER);
  textSize(CAPTION_SIZE);

  const t = millis() * 0.003;
  const a = lerp(120, 255, (sin(t) * 0.5 + 0.5));
  fill(START_COLOR, a);
  text(START_CAPTION, BASE_W / 2, CAPTION_Y);

  const tw = textWidth(START_CAPTION);
  const th = CAPTION_SIZE * 1.2;
  const pad = 10;
  captionLeft = BASE_W / 2 - tw / 2 - pad;
  captionRight = BASE_W / 2 + tw / 2 + pad;
  captionTop = CAPTION_Y - th / 2 - pad;
  captionBot = CAPTION_Y + th / 2 + pad;
}

/* ---------- 클릭으로 체험 시작 ---------- */
function mousePressed() {
  if (started) return;
  const vmx = (mouseX - offsetX) / scaleFactor;
  const vmy = (mouseY - offsetY) / scaleFactor;
  if (vmx >= captionLeft && vmx <= captionRight && vmy >= captionTop && vmy <= captionBot) {
    started = true;
    evapParticles.length = 0;
  }
}

/* ---------- 텍스트 픽셀 생성 ---------- */
function buildLetterPixels() {
  letters.length = 0;
  const canvasH = TEXT_SIZE + 40;

  textG = createGraphics(BASE_W, canvasH);
  textG.pixelDensity(1);
  textG.background(255);
  textG.fill(0);
  textG.textAlign(CENTER, CENTER);
  textG.textSize(TEXT_SIZE);
  textG.textFont(uiFont);
  textG.text(TEXT_STR, textG.width / 2, textG.height / 2);
  textG.loadPixels();

  const yOffset = (BASE_H - canvasH) * 0.5;
  minX = 1e9; maxX = -1e9;

  for (let y = 0; y < textG.height; y += SAMPLE_STEP) {
    const rowIndex = floor(y / SAMPLE_STEP);
    const ox = (STAGGER_ROWS && (rowIndex % 2 === 1)) ? SAMPLE_STEP * 0.5 : 0;
    for (let xf = 0; xf < textG.width; xf += SAMPLE_STEP) {
      const xi = round(xf + ox);
      if (xi < 0 || xi >= textG.width) continue;
      const idx = (y * textG.width + xi) * 4; // RGBA
      const r = textG.pixels[idx]; // 흑백 렌더링이므로 R만 봐도 됨
      if (r < 128) {
        const sx = xf + ox;
        const sy = yOffset + y;
        letters.push(new LPix(sx, sy));
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
      }
    }
  }
}

/* ---------- 매트릭스 마스크 ---------- */
function renderTextMask() {
  textMask = createGraphics(BASE_W, BASE_H);
  textMask.pixelDensity(1);
  textMask.background(0);
  textMask.fill(255);
  textMask.textAlign(CENTER, CENTER);
  textMask.textSize(TEXT_SIZE);
  textMask.textFont(uiFont);
  textMask.text(TEXT_STR, BASE_W / 2, BASE_H / 2);
  textMask.loadPixels();
}

/* ---------- 도트 매트릭스 ---------- */
function drawDotMatrixBase(considerSweep) {
  // textMask.pixels: RGBA 배열
  for (let y = 0; y < BASE_H; y += GRID_STEP) {
    for (let x = 0; x < BASE_W; x += GRID_STEP) {
      const idx = (y * BASE_W + x) * 4;
      // 밝기 판단: 흑백이므로 R 채널만 확인
      const r = textMask.pixels[idx];
      let a = (r > 127) ? FG_ALPHA : BG_ALPHA;

      if (considerSweep && sweepMode) {
        const fade = constrain(map(sweepX - x, -40, 120, 0, 1), 0, 1);
        a = lerp(a, 0, fade);
      }
      fill(DOT_FG, a);
      ellipse(x, y, DOT_SIZE_BASE, DOT_SIZE_BASE);
    }
  }
}

/* ---------- 키보드 입력 ---------- */
function keyPressed() {
  // R : 언제든 시작 화면으로 리셋
  if (key === 'r' || key === 'R') { resetToStart(); return; }
  if (!started) return;

  if (keyCode === UP_ARROW) {
    resetLettersVisible();
    fadeAll = true; sweepMode = false; rainMode = false; pourMode = false;
    triggerSubs(SUB_UP);
  } else if (keyCode === DOWN_ARROW) {
    resetLettersVisible();
    rainMode = true; fadeAll = false; sweepMode = false; pourMode = false;
    triggerSubs(SUB_DOWN);
  } else if (keyCode === RIGHT_ARROW) {
    resetLettersVisible();
    fadeAll = false; sweepMode = true; rainMode = false; pourMode = false;
    sweepX = minX - 20;
    triggerSubs(SUB_RIGHT);
  } else if (keyCode === LEFT_ARROW) {
    resetLettersVisible();
    pourMode = true; rainMode = false; sweepMode = false; fadeAll = false;
    for (const lp of letters) lp.startPour();
    triggerSubs(SUB_LEFT);
  }
}

/* ---------- 전체 초기화(시작 화면 복귀) ---------- */
function resetToStart() {
  started = false;
  // 모드/이펙트
  rainMode = false; fadeAll = false; sweepMode = false; pourMode = false;
  sweepX = minX - 20;
  // 파티클 비우기
  rainParticles.length = 0;
  evapParticles.length = 0;
  // 자막 상태 초기화
  subtitleOn = false; currentSubs = null; subIndex = 0; subStartMillis = 0;
  // 글자 파티클 원위치
  for (const lp of letters) lp.reset();
}

/* ---------- 자막 ---------- */
function triggerSubs(arr) {
  currentSubs = arr;
  subIndex = 0;
  subStartMillis = millis();
  subtitleOn = true;
}

function drawSubtitles() {
  if (!subtitleOn || !currentSubs || currentSubs.length === 0) return;
  const elapsed = millis() - subStartMillis;
  if (elapsed >= SUB_DURATION) {
    subIndex++;
    subStartMillis = millis();
    if (subIndex >= currentSubs.length) { subtitleOn = false; return; }
  }
  const s = currentSubs[subIndex];
  fill(SUB_COLOR);
  textFont(uiFont);
  textSize(34);
  textAlign(CENTER, TOP);
  textLeading(44);
  text(s, BASE_W / 2, BASE_H - 120);
}

/* ---------- 리셋 ---------- */
function resetLettersVisible() {
  for (const lp of letters) lp.reset();
  rainParticles.length = 0;
}

/* ---------- 루프 제어 ---------- */
function loopEffectsIfFinished() {
  if (fadeAll) {
    let allGone = true;
    for (const lp of letters) { if (lp.alpha > 0) { allGone = false; break; } }
    if (allGone) {
      resetLettersVisible();
      for (const lp of letters) lp.startFade(false);
    }
  }
  if (sweepMode) {
    if (sweepX > maxX + 40) { resetLettersVisible(); sweepX = minX - 20; }
  }
  if (pourMode) {
    let allArrived = true;
    for (const lp of letters) { if (!lp.pouredArrived) { allArrived = false; break; } }
    if (allArrived) {
      for (const lp of letters) lp.startPour();
    }
  }
}

/* ---------- LPix ---------- */
class LPix {
  constructor(x, y) {
    this.home = new p5.Vector(x, y);
    this.pos = new p5.Vector(random(BASE_W), random(BASE_H));
    this.vel = new p5.Vector(random(-2, 2), random(-2, 2));
    this.fading = false;
    this.pouring = false;
    this.pouredArrived = true;
    this.settling = false;
    this.alpha = 0;
    this.baseAlpha = 255;
  }
  startPour() {
    this.fading = false; this.pouring = true; this.settling = false; this.pouredArrived = false;
    this.alpha = 160; this.baseAlpha = 0;
    this.pos.x = this.home.x + random(-30, 30);
    this.pos.y = -random(20, BASE_H * 1.2);
    this.vel.x = random(-0.6, 0.6);
    this.vel.y = random(2.0, 6.0);
  }
  updatePour() {
    if (this.pouring) {
      this.vel.y += 0.25;
      this.vel.x += (this.home.x - this.pos.x) * 0.05;
      this.pos.add(this.vel);
      this.vel.mult(0.995);
      this.alpha = min(255, this.alpha + 1.2);
      if (this.pos.y >= this.home.y) { this.pouring = false; this.settling = true; }
    } else if (this.settling) {
      this.pos.x = lerp(this.pos.x, this.home.x, 0.18);
      this.pos.y = lerp(this.pos.y, this.home.y, 0.18);
      this.vel.mult(0.9);
      this.baseAlpha = min(255, this.baseAlpha + 6);
      if (dist(this.pos.x, this.pos.y, this.home.x, this.home.y) < 0.6) {
        this.pos.set(this.home.x, this.home.y);
        this.vel.set(0, 0);
        this.settling = false; this.pouredArrived = true; this.alpha = 0; this.baseAlpha = 255;
      }
    }
  }
  startFade(biasRight) {
    this.fading = true; this.alpha = START_ALPHA; this.baseAlpha = 255;
    this.vel = p5.Vector.random2D();
    this.vel.mult(random(0.2, DUST_SPEED0));
    if (biasRight) this.vel.x += random(0.2, 0.7);
  }
  update() {
    if (this.fading) {
      this.pos.x += sin(frameCount * 0.05 + this.pos.y * 0.02) * (DUST_JIT * 0.6);
      this.pos.y += cos(frameCount * 0.05 + this.pos.x * 0.02) * (DUST_JIT * 0.6);
      this.pos.add(this.vel);
      this.vel.mult(FRICTION);
      this.alpha = max(0, this.alpha - DUST_FADE);
    }
  }
  reset() {
    this.fading = false; this.pouring = false; this.settling = false; this.pouredArrived = true;
    this.alpha = 0; this.baseAlpha = 255; this.pos.set(this.home.x, this.home.y); this.vel.set(0, 0);
  }
}

/* ---------- 증발 파티클 ---------- */
class Evap {
  constructor(x, y, v0, a0) {
    this.pos = new p5.Vector(x, y);
    this.vel = v0.copy();
    this.acc = a0.copy();
    this.alpha = 200;
    this.size = DOT_SIZE_PART;
  }
  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.pos.x += sin(frameCount * 0.08 + this.pos.y * 0.02) * 0.15;
    this.alpha -= 1.3;
  }
  display() {
    fill(PIX_COLOR, this.alpha);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
  }
  isDead() {
    return (this.alpha <= 0 || this.pos.y < -120 || this.pos.x < -120 || this.pos.x > BASE_W + 120);
  }
}

/* ---------- Rain Particle ---------- */
class Particle {
  constructor(x, y, v0, a0) {
    this.pos = new p5.Vector(x, y);
    this.vel = v0.copy();
    this.acc = a0.copy();
    this.alpha = 255;
    this.size = DOT_SIZE_PART;
  }
  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.vel.mult(FRICTION);
    this.alpha -= RAIN_FADE;
  }
  display() {
    fill(PIX_COLOR, this.alpha);
    ellipse(this.pos.x, this.pos.y, this.size, this.size);
  }
  isDead() {
    return (this.alpha <= 0 || this.pos.x < -120 || this.pos.x > BASE_W + 120 || this.pos.y < -120 || this.pos.y > BASE_H + 120);
  }
}

/* ---------- 시작 화면 위로 증발 ---------- */
function emitEvaporation() {
  if (letters.length === 0) return;
  for (let i = 0; i < EVAP_PER_FRAME; i++) {
    const src = letters[floor(random(letters.length))];
    const v = new p5.Vector(random(-0.25, 0.25), random(-2.5, -0.8));
    const a = new p5.Vector(0, -0.02);
    evapParticles.push(new Evap(src.home.x, src.home.y, v, a));
  }
}
function updateEvaporation() {
  for (let i = evapParticles.length - 1; i >= 0; i--) {
    const e = evapParticles[i];
    e.update(); e.display();
    if (e.isDead()) evapParticles.splice(i, 1);
  }
}

/* ---------- 효과 업데이트 ---------- */
function updateAndDrawLetterEffects() {
  if (sweepMode) sweepX += sweepSpeed;

  for (const lp of letters) {
    if (!pourMode) {
      if (sweepMode && !lp.fading && lp.home.x <= sweepX) lp.startFade(true);
      if (fadeAll && !lp.fading) lp.startFade(false);
    }
    if (pourMode) {
      lp.updatePour();
      if (!lp.pouredArrived) {
        fill(PIX_COLOR, lp.alpha);
        ellipse(lp.pos.x, lp.pos.y, DOT_SIZE_PART, DOT_SIZE_PART);
      }
    } else {
      lp.update();
      if (lp.fading) {
        fill(PIX_COLOR, lp.alpha);
        ellipse(lp.pos.x, lp.pos.y, DOT_SIZE_PART, DOT_SIZE_PART);
      }
    }
  }
}

/* ---------- 비 ---------- */
function emitRain() {
  if (letters.length === 0) return;
  for (let i = 0; i < EMIT_PER_FRAME; i++) {
    const src = letters[floor(random(letters.length))];
    const v = new p5.Vector(random(-0.3, 0.3), random(0.8, 1.5));
    rainParticles.push(new Particle(src.home.x, src.home.y, v, GRAVITY.copy()));
  }
}
