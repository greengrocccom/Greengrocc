/**
 * Notification Sound Synthesizer using Web Audio API
 * Generates clear, high-fidelity audio chimes directly in the browser
 * without relying on external MP3 files or network latency.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export const SOUND_PRESETS = [
  { id: 'chime', label: 'Crystal Chime', description: 'Harmonic two-tone bell chime' },
  { id: 'bell', label: 'Executive Bell', description: 'Pure resonant chime' },
  { id: 'urgent', label: 'Urgent Alert', description: 'High-visibility dual alert ping' },
  { id: 'soft', label: 'Soft Pop', description: 'Subtle notification click' },
];

export function getSoundSettings() {
  if (typeof window === 'undefined') {
    return { enabled: true, preset: 'chime', volume: 0.8 };
  }
  try {
    const stored = localStorage.getItem('greengrocc_admin_sound_settings');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    // ignore
  }
  return { enabled: true, preset: 'chime', volume: 0.8 };
}

export function saveSoundSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('greengrocc_admin_sound_settings', JSON.stringify(settings));
  } catch (e) {
    // ignore
  }
}

/**
 * Play synthesized notification audio
 */
export function playNotificationSound(presetId = 'chime', customVolume = null) {
  try {
    const settings = getSoundSettings();
    if (!settings.enabled && customVolume === null) return;

    const volumeLevel = customVolume !== null ? customVolume : (settings.volume ?? 0.8);
    const preset = presetId || settings.preset || 'chime';

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0.01, Math.min(1, volumeLevel)), now);
    masterGain.connect(ctx.destination);

    switch (preset) {
      case 'bell': {
        // Executive Bell: 830Hz fundamental with harmonic decay
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(830.61, now); // G#5

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 1.2);
        break;
      }

      case 'urgent': {
        // Urgent alert: Rapid ascending two-tone ping
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(587.33, now); // D5
        gain1.gain.setValueAtTime(0.6, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.18);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12); // A5
        gain2.gain.setValueAtTime(0.8, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.9);
        break;
      }

      case 'soft': {
        // Soft pop / droplet
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.25);
        break;
      }

      case 'chime':
      default: {
        // Modern Crystal Chime: 3-tone harmonic arpeggio (E5 -> A5 -> E6)
        const notes = [
          { freq: 659.25, time: 0, dur: 0.8, vol: 0.5 },     // E5
          { freq: 880.00, time: 0.08, dur: 0.9, vol: 0.7 },  // A5
          { freq: 1318.51, time: 0.16, dur: 1.1, vol: 0.8 }, // E6
        ];

        notes.forEach(({ freq, time, dur, vol }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0, now + time);
          gain.gain.linearRampToValueAtTime(vol, now + time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

          osc.connect(gain);
          gain.connect(masterGain);

          osc.start(now + time);
          osc.stop(now + time + dur);
        });
        break;
      }
    }
  } catch (err) {
    console.warn('Could not play notification chime:', err);
  }
}
