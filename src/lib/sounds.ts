/**
 * DUEL — Synthesized Sound Engine
 *
 * All sounds are generated at runtime using the Web Audio API — no files,
 * no network requests, no dependencies. The AudioContext is lazily created
 * on first use (required by browsers that block autoplay until a user gesture).
 *
 * Sounds are skipped entirely if `prefers-reduced-motion` is set, since
 * players who opt out of motion typically want a quieter experience too.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  // Resume if suspended (e.g. after tab switch)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => undefined);
  }
  return ctx;
}

/** Short haptic pulse via Vibration API. Silently no-ops if unsupported. */
function haptic(pattern: number | number[]) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // Vibration API not available — ignore
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function playTone(
  ac: AudioContext,
  opts: {
    type: OscillatorType;
    freq: number;
    gain: number;
    duration: number;
    attack?: number;
    decay?: number;
    detune?: number;
  },
) {
  const { type, freq, gain, duration, attack = 0.005, decay = 0.08, detune = 0 } = opts;
  const osc = ac.createOscillator();
  const env = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  osc.detune.setValueAtTime(detune, ac.currentTime);

  env.gain.setValueAtTime(0, ac.currentTime);
  env.gain.linearRampToValueAtTime(gain, ac.currentTime + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

  osc.connect(env);
  env.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration + decay);
}

function playNoise(ac: AudioContext, gain: number, duration: number, filterFreq = 800) {
  const bufferSize = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = ac.createBufferSource();
  source.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(filterFreq, ac.currentTime);

  const env = ac.createGain();
  env.gain.setValueAtTime(gain, ac.currentTime);
  env.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);

  source.connect(filter);
  filter.connect(env);
  env.connect(ac.destination);
  source.start();
  source.stop(ac.currentTime + duration);
}

// ── Sound Events ─────────────────────────────────────────────────────────────

/** Soft click when a card is tapped / hovered-selected. */
export function soundCardSelect() {
  const ac = getCtx();
  if (!ac) return;
  playTone(ac, { type: "sine", freq: 880, gain: 0.18, duration: 0.08, attack: 0.002 });
  playTone(ac, { type: "sine", freq: 1100, gain: 0.09, duration: 0.06, attack: 0.002 });
  haptic(12);
}

/** Heavy impact when cards clash (fires at the ~550ms animation mark). */
export function soundCardClash() {
  const ac = getCtx();
  if (!ac) return;
  // Low thud
  playTone(ac, { type: "triangle", freq: 80, gain: 0.7, duration: 0.18, attack: 0.003 });
  // Mid punch
  playTone(ac, { type: "square", freq: 200, gain: 0.3, duration: 0.12, attack: 0.001 });
  // Noise burst
  playNoise(ac, 0.5, 0.1, 1200);
  haptic([20, 10, 20]);
}

/** When the player's HP drops. */
export function soundPlayerDamage() {
  const ac = getCtx();
  if (!ac) return;
  playTone(ac, { type: "sawtooth", freq: 180, gain: 0.4, duration: 0.15, attack: 0.002 });
  playTone(ac, { type: "sine", freq: 120, gain: 0.25, duration: 0.2, attack: 0.005 });
  haptic(30);
}

/** When CIPHER's HP drops. */
export function soundAiDamage() {
  const ac = getCtx();
  if (!ac) return;
  playTone(ac, { type: "sine", freq: 660, gain: 0.25, duration: 0.12, attack: 0.003 });
  playTone(ac, { type: "sine", freq: 880, gain: 0.15, duration: 0.08, attack: 0.002 });
  haptic(8);
}

/** Lifesteal heal spark. */
export function soundHeal() {
  const ac = getCtx();
  if (!ac) return;
  // Rising arpeggio
  [440, 554, 659].forEach((freq, i) => {
    setTimeout(() => {
      const a = getCtx();
      if (a) playTone(a, { type: "sine", freq, gain: 0.15, duration: 0.1, attack: 0.004 });
    }, i * 40);
  });
}

/** Ascending triumphant chord on victory. */
export function soundVictory() {
  const ac = getCtx();
  if (!ac) return;
  const notes = [523, 659, 784, 1046]; // C E G C — C major arpeggio
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const a = getCtx();
      if (!a) return;
      playTone(a, { type: "triangle", freq, gain: 0.3, duration: 0.5, attack: 0.01 });
      playTone(a, { type: "sine", freq: freq * 2, gain: 0.1, duration: 0.3, attack: 0.02 });
    }, i * 100);
  });
  haptic([50, 30, 80]);
}

/** Descending minor chord on defeat. */
export function soundDefeat() {
  const ac = getCtx();
  if (!ac) return;
  const notes = [392, 311, 261, 196]; // G Eb C G — descending minor
  notes.forEach((freq, i) => {
    setTimeout(() => {
      const a = getCtx();
      if (!a) return;
      playTone(a, { type: "triangle", freq, gain: 0.22, duration: 0.6, attack: 0.01 });
    }, i * 130);
  });
  haptic([60, 20, 40, 20, 20]);
}

/** Perfect duel sparkle trill. */
export function soundPerfectDuel() {
  const ac = getCtx();
  if (!ac) return;
  const freqs = [880, 1046, 1318, 1568, 1760];
  freqs.forEach((freq, i) => {
    setTimeout(() => {
      const a = getCtx();
      if (a) playTone(a, { type: "sine", freq, gain: 0.2, duration: 0.12, attack: 0.004 });
    }, i * 55);
  });
  haptic([10, 5, 10, 5, 20]);
}

/** Begin duel — low rumble build-up. */
export function soundDuelStart() {
  const ac = getCtx();
  if (!ac) return;
  playNoise(ac, 0.15, 0.3, 300);
  setTimeout(() => {
    const a = getCtx();
    if (a) {
      playTone(a, { type: "sawtooth", freq: 110, gain: 0.2, duration: 0.25, attack: 0.05 });
      playTone(a, { type: "square", freq: 220, gain: 0.1, duration: 0.2, attack: 0.05 });
    }
  }, 100);
  haptic([15, 10, 30]);
}

/** Clutch turn warning buzz. */
export function soundClutchTurn() {
  const ac = getCtx();
  if (!ac) return;
  playTone(ac, { type: "sawtooth", freq: 330, gain: 0.15, duration: 0.08, attack: 0.002 });
  setTimeout(() => {
    const a = getCtx();
    if (a) playTone(a, { type: "sawtooth", freq: 440, gain: 0.2, duration: 0.1, attack: 0.002 });
  }, 100);
  haptic([8, 8, 20]);
}

/** Ascending double-chime for combo trigger. */
export function playComboSound() {
  const ac = getCtx();
  if (!ac) return;
  playTone(ac, { type: "sine", freq: 440, gain: 0.15, duration: 0.1, attack: 0.005 });
  setTimeout(() => {
    const a = getCtx();
    if (a) playTone(a, { type: "sine", freq: 880, gain: 0.2, duration: 0.2, attack: 0.005 });
  }, 100);
  haptic([10, 20]);
}

/** Rapid shuffling tick sound for card deal. */
export function playDealSound(pitchMult: number = 1) {
  const ac = getCtx();
  if (!ac) return;
  playTone(ac, { type: "triangle", freq: 300 * pitchMult, gain: 0.08, duration: 0.05, attack: 0.001 });
}

/** Swish sound for card flip. */
export function playFlipSound() {
  const ac = getCtx();
  if (!ac) return;
  playNoise(ac, 0.15, 0.15, 600);
}
