import { audioCtx } from './encoder.js'; // For consistency, this line can be removed if redundant.
import { charToFreqMap, MESSAGE_START, MESSAGE_END } from './utils.js';

export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Unique ID for this device (stored under 'deviceId')
export const myID = localStorage.getItem('deviceId') || (() => {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase();
  localStorage.setItem('deviceId', id);
  return id;
})();

if (myID === 'iam') localStorage.setItem('deviceId', 'Iam');

export function sendMessage(message, onVolume) {
  // Wrap the message with start and end markers
  const fullMessage = MESSAGE_START + message + MESSAGE_END;
  let index = 0;
  console.log("📤 Sending message:", fullMessage);

  function playNextChar() {
    if (index >= fullMessage.length) return;
    const char = fullMessage[index];
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
    gainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      if (onVolume) onVolume('Playing...');
    }, duration);
  }

  playNextChar();
}
