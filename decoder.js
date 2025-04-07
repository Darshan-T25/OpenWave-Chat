import { audioCtx } from './encoder.js';

const baseFreq = 400;              // Must match encoder.js!
const step = 10;                   // Must match encoder.js!
const MESSAGE_START = '~';
const MESSAGE_END = '^';
let incomingBuffer = '';
let isReceiving = false;
let silenceTimeout = null;

// Use the same character set as in encoder.js
const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#|~^[](){}<>_-+=:;,.*@!? ';
// Build a reverse lookup map: frequency → character
const freqToCharMap = {};
CHAR_SET.split('').forEach((char, i) => {
  const freq = baseFreq + (i * step);
  freqToCharMap[Math.round(freq)] = char;
});

// Helper: get the closest character within a tolerance (±5 Hz)
function getClosestChar(freq) {
  let minDiff = Infinity;
  let matchedChar = null;
  for (const [key, char] of Object.entries(freqToCharMap)) {
    const mappedFreq = Number(key);
    const diff = Math.abs(freq - mappedFreq);
    if (diff < minDiff && diff <= 5) {  // Tolerance of 5 Hz
      minDiff = diff;
      matchedChar = char;
    }
  }
  return matchedChar;
}

let micStream = null;
let analyser = null;
let scriptNode = null;
let isMicOn = false;

export async function startMic(onDecoded, onMicError, onMicStarted, visualizerCanvas) {
  if (isMicOn) return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    isMicOn = true;
    if (onMicStarted) onMicStarted();

    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    if (visualizerCanvas) {
      initVisualizer(analyser, visualizerCanvas);
    }

    scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
    scriptNode.onaudioprocess = (e) => decodeMic(e, analyser, onDecoded);
    analyser.connect(scriptNode);
    scriptNode.connect(audioCtx.destination);
  } catch (err) {
    if (onMicError) onMicError();
    isMicOn = false;
  }
}

export function stopMic() {
  if (!isMicOn) return;
  isMicOn = false;
  if (scriptNode) scriptNode.disconnect();
  if (analyser) analyser.disconnect();
  if (micStream) micStream.getTracks().forEach(t => t.stop());
}

function decodeMic(e, analyser, onDecoded) {
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  let maxVal = 0, maxIndex = 0;
  for (let i = 0; i < dataArray.length; i++) {
    if (dataArray[i] > maxVal) {
      maxVal = dataArray[i];
      maxIndex = i;
    }
  }

  if (maxVal > 150) {
    const detectedFreq = (maxIndex * audioCtx.sampleRate) / analyser.fftSize / 2;
    const roundedFreq = Math.round(detectedFreq);
    const decodedChar = getClosestChar(roundedFreq);
    if (decodedChar) {
      console.log(`🎵 Freq: ${roundedFreq} Hz → '${decodedChar}'`);
      
      // If start marker is detected, begin a new message.
      if (decodedChar === MESSAGE_START) {
        isReceiving = true;
        incomingBuffer = '';
        return;
      }
      
      // If end marker is detected, finish the message.
      if (decodedChar === MESSAGE_END) {
        isReceiving = false;
        console.log("📥 Decoded Message:", incomingBuffer);
        onDecoded(incomingBuffer);
        incomingBuffer = '';
        return;
      }
      
      // Append character if we are in receiving mode.
      if (isReceiving) {
        incomingBuffer += decodedChar;
      }
      
      if (silenceTimeout) clearTimeout(silenceTimeout);
      silenceTimeout = setTimeout(() => {
        if (incomingBuffer.length > 0) {
          console.log("⌛ Timeout - Partial Message:", incomingBuffer);
          onDecoded(incomingBuffer);
          incomingBuffer = '';
          isReceiving = false;
        }
      }, 2000);
    }
  }
}

function initVisualizer(analyser, canvas) {
  const ctx = canvas.getContext('2d');
  function draw() {
    requestAnimationFrame(draw);
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'red';
    ctx.beginPath();
    const sliceWidth = canvas.width / analyser.frequencyBinCount;
    let x = 0;
    for (let i = 0; i < analyser.frequencyBinCount; i++) {
      const v = data[i] / 128.0;
      const y = (v * canvas.height) / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.stroke();
  }
  draw();
}
