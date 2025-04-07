export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const baseFreq = 400;
const step = 20;
const MESSAGE_TERMINATOR = '#';

// Unique ID for this device
export const myID = localStorage.getItem('deviceId') || (() => {
  const id = Math.random().toString(36).substring(2, 8);
  localStorage.setItem('deviceId', id);
  return id;
})();

// Override if you’re the chosen one
if (myID === 'iam') localStorage.setItem('uniqueID', 'Iam');

function charToFreq(char) {
  return baseFreq + (char.charCodeAt(0) * step);
}

export function sendMessage(message, onVolume) {
  const fullMessage = message + MESSAGE_TERMINATOR;
  let index = 0;

  console.log("📤 Sending message:", fullMessage);

  function playNextChar() {
    if (index >= fullMessage.length) return;

    const char = fullMessage[index];
    const freq = charToFreq(char);
    console.log(`📡 Sending '${char}' at ${freq.toFixed(1)} Hz`);

    playTone(freq, 100);
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
