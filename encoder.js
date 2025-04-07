export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const baseFreq = 620;
const step = 12;
const MESSAGE_START = '~';
const MESSAGE_END = '^';

// Define characters you want to support
const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#|~^[](){}<>_-+=:;,.*@!? ';

// Map each character to a frequency in range 620–1480 Hz
const charToFreqMap = {};
CHAR_SET.split('').forEach((char, i) => {
  charToFreqMap[char] = baseFreq + (i * step);
});

// Unique ID
export const myID = localStorage.getItem('deviceId') || (() => {
  const id = Math.random().toString(36).substring(2, 8);
  localStorage.setItem('deviceId', id);
  return id;
})();

// Special mode
if (myID === 'iam') localStorage.setItem('deviceId', 'Iam');

export function sendMessage(message, showVolume = false) {
  const MESSAGE_START = '~';
  const MESSAGE_END = '^';
  const fullMessage = MESSAGE_START + message + MESSAGE_END;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContext();
  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime); // louder output
  gainNode.connect(audioCtx.destination);

  let index = 0;

  function playTone(freq, duration) {
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    oscillator.connect(gainNode);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration / 1000);
  }

  function playNextChar() {
    if (index >= fullMessage.length) {
      audioCtx.close();
      return;
    }
    const char = fullMessage[index++];
    const freq = CHAR_TO_FREQ[char];
    if (freq) {
      playTone(freq, 150);
    }
    setTimeout(playNextChar, 200); // leave a slight gap for decoding
  }

  playNextChar();

  if (showVolume) {
    visualizeSpeakerOutput(gainNode); // optional visualizer
  }
}

