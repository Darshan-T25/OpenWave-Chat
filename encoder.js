export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const baseFreq = 620;
const step = 12;
const MESSAGE_START = '~';
const MESSAGE_END = '^';

// Define characters you want to support
const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#|~^[](){}<>_-+=:;,.*@!? ';

// Map each character to a frequency in the range 620–1480 Hz
const charToFreqMap = {};
CHAR_SET.split('').forEach((char, i) => {
  charToFreqMap[char] = baseFreq + (i * step);
});

// Unique ID for this device (stored under 'deviceId')
export const myID = localStorage.getItem('deviceId') || (() => {
  const id = Math.random().toString(36).substring(2, 8);
  localStorage.setItem('deviceId', id);
  return id;
})();

// Override if you’re the chosen one (if myID equals 'iam', then set to 'Iam')
if (myID === 'iam') localStorage.setItem('deviceId', 'Iam');

export function sendMessage(message, onVolume) {
  // Wrap the message with start and end markers
  const fullMessage = MESSAGE_START + message + MESSAGE_END;
  let index = 0;

  console.log("📤 Sending message:", fullMessage);

  function playNextChar() {
    if (index >= fullMessage.length) return;
    const char = fullMessage[index];
    // Use charToFreqMap instead of undefined CHAR_TO_FREQ
    const freq = charToFreqMap[char];
    if (freq) {
      console.log(`📡 Sending '${char}' at ${freq.toFixed(1)} Hz`);
      playTone(freq, 100);
    } else {
      console.warn(`⚠️ Unsupported character: '${char}'`);
    }
    index++;
    setTimeout(playNextChar, 120);
  }

  function playTone(freq, duration) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.frequency.value = freq;
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      if (onVolume) onVolume('Playing...');
    }, duration);
  }

  playNextChar();
}
