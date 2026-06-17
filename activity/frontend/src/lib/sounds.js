// FutBot sound engine — Web Audio API, no files needed

let _ctx = null
let _muted = localStorage.getItem('futbot-muted') === 'true'

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (_ctx.state === 'suspended') _ctx.resume()
  return _ctx
}

function master(vol = 1) {
  const g = ctx().createGain()
  g.gain.value = _muted ? 0 : vol
  g.connect(ctx().destination)
  return g
}

export function isMuted() { return _muted }
export function setMuted(v) {
  _muted = v
  localStorage.setItem('futbot-muted', v)
}
export function toggleMute() { setMuted(!_muted); return _muted }

// ── Pink noise buffer (stadium crowd base) ──────────────────────
function pinkNoiseBuf(seconds) {
  const c = ctx()
  const len = Math.ceil(c.sampleRate * seconds)
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856
      b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980
      d[i] = (b0+b1+b2+b3+b4+b5+w*0.5362) * 0.11
    }
  }
  return buf
}

// ── White noise burst ────────────────────────────────────────────
function noiseBuf(seconds) {
  const c = ctx()
  const len = Math.ceil(c.sampleRate * seconds)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

// ────────────────────────────────────────────────────────────────
// DRAMATIC REVEAL — deep bass thud + rarity-tuned harmonic chord
// ────────────────────────────────────────────────────────────────
export function dramaticReveal(rarity = 'Rare', type = '') {
  const c = ctx(); const now = c.currentTime

  // Deep cinematic bass thud
  const bass = c.createOscillator(); bass.type = 'sine'
  bass.frequency.setValueAtTime(58, now)
  bass.frequency.exponentialRampToValueAtTime(28, now + 0.45)
  const bassGain = c.createGain()
  bassGain.gain.setValueAtTime(0.75, now)
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
  bass.connect(bassGain); bassGain.connect(master(1))
  bass.start(now); bass.stop(now + 0.55)

  // Rarity-tuned harmonic chord (staggered, fades slowly)
  const chords = {
    Icon:     [880, 1320, 2093],  // bright E-B-C (ethereal)
    Hero:     [698, 1047, 1568],  // warm F-C-G
    CopaAm:   [587, 880, 1175],   // blue D-E-D
    EuroTOTT: [659, 988, 1319],   // orange E-B-E
    RareStd:  [523, 784, 1047],   // gold C-G-C
    Uncommon: [440, 659, 880],    // yellow A-E-A
    Common:   [370, 554],         // soft F#-C#
  }
  const key = rarity === 'Rare'
    ? (type === 'Icon' ? 'Icon' : type === 'Hero' ? 'Hero'
      : type === 'Copa America TOTT' ? 'CopaAm'
      : type === 'Euro TOTT' ? 'EuroTOTT' : 'RareStd')
    : rarity === 'Uncommon' ? 'Uncommon' : 'Common'

  const freqs = chords[key] || chords.RareStd
  freqs.forEach((freq, i) => {
    const t = now + 0.04 + i * 0.055
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.28 / (i + 1), t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
    osc.connect(gain); gain.connect(master(0.75))
    osc.start(t); osc.stop(t + 0.9)
  })
}

// ────────────────────────────────────────────────────────────────
// PACK SHAKE — rhythmic bass thuds matching the animation
// ────────────────────────────────────────────────────────────────
export function packShake() {
  const c = ctx(); const now = c.currentTime
  const hits = [0, 0.18, 0.36, 0.55, 0.72]
  hits.forEach((t, i) => {
    const osc = c.createOscillator(); osc.type = 'sine'
    const pitchFall = 60 + i * 4
    osc.frequency.setValueAtTime(pitchFall * 1.6, now + t)
    osc.frequency.exponentialRampToValueAtTime(pitchFall * 0.8, now + t + 0.1)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.45 + i * 0.04, now + t)
    gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.13)
    osc.connect(gain); gain.connect(master(1))
    osc.start(now + t); osc.stop(now + t + 0.15)
  })
}

// ────────────────────────────────────────────────────────────────
// RARITY FLASH — impact tuned to card rarity/type
// ────────────────────────────────────────────────────────────────
export function rarityFlash(rarity, type) {
  const c = ctx(); const now = c.currentTime
  const freqMap = {
    Common:   [220, 380],
    Uncommon: [330, 600],
    RareStd:  [440, 880],
    Hero:     [500, 1100],
    Icon:     [660, 1600],
    CopaAm:   [480, 960],
    EuroTOTT: [520, 1040],
  }
  let key = rarity === 'Rare'
    ? (type === 'Icon' ? 'Icon' : type === 'Hero' ? 'Hero'
      : type === 'Copa America TOTT' ? 'CopaAm'
      : type === 'Euro TOTT' ? 'EuroTOTT' : 'RareStd')
    : rarity
  const [f0, f1] = freqMap[key] || [330, 600]

  const osc = c.createOscillator(); osc.type = 'sine'
  osc.frequency.setValueAtTime(f0, now)
  osc.frequency.exponentialRampToValueAtTime(f1, now + 0.25)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.5, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
  osc.connect(gain); gain.connect(master(1))
  osc.start(now); osc.stop(now + 0.4)
}

// ────────────────────────────────────────────────────────────────
// STAT REVEAL — ping per stat, big chord for OVR
// ────────────────────────────────────────────────────────────────
export function statReveal(step) {
  const c = ctx(); const now = c.currentTime
  if (step >= 5) {
    // OVR — big ascending chord
    [[523, 0], [659, 0.06], [784, 0.12], [1047, 0.2]].forEach(([freq, t]) => {
      const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq
      const gain = c.createGain()
      gain.gain.setValueAtTime(0.3, now + t); gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.55)
      osc.connect(gain); gain.connect(master(0.8))
      osc.start(now + t); osc.stop(now + t + 0.6)
    })
  } else {
    const baseFreqs = [0, 300, 380, 460, 540]
    const freq = baseFreqs[step] || 350
    const osc = c.createOscillator(); osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.6, now + 0.12)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.28, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc.connect(gain); gain.connect(master(0.7))
    osc.start(now); osc.stop(now + 0.25)
  }
}

// ────────────────────────────────────────────────────────────────
// CARD FLIP — noise whoosh
// ────────────────────────────────────────────────────────────────
export function cardFlip() {
  const c = ctx(); const now = c.currentTime
  const src = c.createBufferSource(); src.buffer = noiseBuf(0.22)
  const filt = c.createBiquadFilter(); filt.type = 'bandpass'; filt.Q.value = 2
  filt.frequency.setValueAtTime(200, now); filt.frequency.exponentialRampToValueAtTime(4000, now + 0.18)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
  src.connect(filt); filt.connect(gain); gain.connect(master(0.9))
  src.start(now)
}

// ────────────────────────────────────────────────────────────────
// SHINE SWEEP — ascending sparkle tones
// ────────────────────────────────────────────────────────────────
export function shineSweep() {
  const c = ctx(); const now = c.currentTime
  for (let i = 0; i < 6; i++) {
    const t = now + i * 0.07
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 1800 + i * 500
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.14, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
    osc.connect(gain); gain.connect(master(0.6))
    osc.start(t); osc.stop(t + 0.2)
  }
}

// ────────────────────────────────────────────────────────────────
// COIN EARNED — bright piano ding
// ────────────────────────────────────────────────────────────────
export function coinEarned() {
  const c = ctx(); const now = c.currentTime
  [[523, 0.4], [1047, 0.2], [2093, 0.08]].forEach(([freq, vol]) => {
    const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq
    const gain = c.createGain()
    gain.gain.setValueAtTime(vol, now); gain.gain.setValueAtTime(vol, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
    osc.connect(gain); gain.connect(master(0.7))
    osc.start(now); osc.stop(now + 0.8)
  })
}

// ────────────────────────────────────────────────────────────────
// DECK SAVED — two-note ascending chime
// ────────────────────────────────────────────────────────────────
export function deckSaved() {
  const c = ctx(); const now = c.currentTime
  [[523, 0], [784, 0.14]].forEach(([freq, t]) => {
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.3, now + t); gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.5)
    osc.connect(gain); gain.connect(master(0.8))
    osc.start(now + t); osc.stop(now + t + 0.6)
  })
}

// ────────────────────────────────────────────────────────────────
// MATCH WIN — ascending fanfare
// ────────────────────────────────────────────────────────────────
export function matchWin() {
  const c = ctx(); const now = c.currentTime
  [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38]].forEach(([freq, t]) => {
    const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.35, now + t); gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.5)
    osc.connect(gain); gain.connect(master(0.9))
    osc.start(now + t); osc.stop(now + t + 0.6)
  })
  // Dramatic hit after fanfare
  setTimeout(() => dramaticReveal('Rare', 'Standard'), 400)
}

// ────────────────────────────────────────────────────────────────
// MATCH LOSE — descending minor chord
// ────────────────────────────────────────────────────────────────
export function matchLose() {
  const c = ctx(); const now = c.currentTime
  [[523, 0], [466, 0.18], [392, 0.36], [349, 0.54]].forEach(([freq, t]) => {
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.28, now + t); gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.55)
    osc.connect(gain); gain.connect(master(0.7))
    osc.start(now + t); osc.stop(now + t + 0.7)
  })
}

// ────────────────────────────────────────────────────────────────
// ROUND WIN / LOSE
// ────────────────────────────────────────────────────────────────
export function roundWin() {
  const c = ctx(); const now = c.currentTime
  [[523, 0], [659, 0.1]].forEach(([freq, t]) => {
    const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.28, now + t); gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.35)
    osc.connect(gain); gain.connect(master(0.7))
    osc.start(now + t); osc.stop(now + t + 0.4)
  })
}

export function roundLose() {
  const c = ctx(); const now = c.currentTime
  const osc = c.createOscillator(); osc.type = 'sine'
  osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(220, now + 0.32)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
  osc.connect(gain); gain.connect(master(0.6))
  osc.start(now); osc.stop(now + 0.4)
}

// ────────────────────────────────────────────────────────────────
// BUTTON CLICK — subtle tick
// ────────────────────────────────────────────────────────────────
export function buttonClick() {
  const c = ctx(); const now = c.currentTime
  const src = c.createBufferSource(); src.buffer = noiseBuf(0.018)
  const filt = c.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 1200
  const gain = c.createGain(); gain.gain.value = 0.25
  src.connect(filt); filt.connect(gain); gain.connect(master(0.5))
  src.start(now)
}

// ────────────────────────────────────────────────────────────────
// TIMER TICK — subtle heartbeat/clock tick
// ────────────────────────────────────────────────────────────────
export function timerTick() {
  const c = ctx(); const now = c.currentTime
  const osc = c.createOscillator(); osc.type = 'triangle'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(100, now + 0.05)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
  osc.connect(gain); gain.connect(master(0.6))
  osc.start(now); osc.stop(now + 0.15)
}

// ────────────────────────────────────────────────────────────────
// TOAST POP — soft bubble
// ────────────────────────────────────────────────────────────────
export function toastPop() {
  const c = ctx(); const now = c.currentTime
  const osc = c.createOscillator(); osc.type = 'sine'
  osc.frequency.setValueAtTime(400, now)
  osc.frequency.exponentialRampToValueAtTime(800, now + 0.08)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.2, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
  osc.connect(gain); gain.connect(master(0.7))
  osc.start(now); osc.stop(now + 0.2)
}

// ────────────────────────────────────────────────────────────────
// ERROR BUZZ — deep thud for wrong guesses/eliminations
// ────────────────────────────────────────────────────────────────
export function errorBuzz() {
  const c = ctx(); const now = c.currentTime
  const osc = c.createOscillator(); osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(100, now)
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.2)
  const filt = c.createBiquadFilter(); filt.type = 'lowpass'
  filt.frequency.setValueAtTime(500, now); filt.frequency.exponentialRampToValueAtTime(100, now + 0.2)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.3, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
  osc.connect(filt); filt.connect(gain); gain.connect(master(0.8))
  osc.start(now); osc.stop(now + 0.3)
}
