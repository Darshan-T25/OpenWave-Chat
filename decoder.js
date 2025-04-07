import { audioCtx } from './encoder.js';

const baseFreq = 620;
const step = 12;
const MESSAGE_START = '~';
const MESSAGE_END = '^';
let incomingBuffer = '';
let isReceiving = false;
let silenceTimeout = null;

// Character set must match encoder.js exactly
const CHAR_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#|~^[](){}<>_-+=:;,.*@!? ';
const freqToCharMap = {};

CHAR_SET.split('').forEach((char, i) => {
  const freq = baseFreq + (i * step);
  freqToCharMap[Math.round(freq)] = char;
});

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

export function decodeMic(onMessageDecoded) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    const micStream = new Uint8Array(analyser.frequencyBinCount);
  
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
  
      let currentMessage = "";
      let isReceiving = false;
      let lastChar = "";
  
      function getClosestChar(freq) {
        let minDiff = Infinity;
        let matchedChar = null;
        for (const [char, f] of Object.entries(CHAR_TO_FREQ)) {
          const diff = Math.abs(freq - f);
          if (diff < minDiff && diff <= 10) {
            minDiff = diff;
            matchedChar = char;
          }
        }
        return matchedChar;
      }
  
      function analyze() {
        analyser.getByteFrequencyData(micStream);
  
        let maxAmp = 0, maxIndex = -1;
        for (let i = 0; i < micStream.length; i++) {
          if (micStream[i] > maxAmp) {
            maxAmp = micStream[i];
            maxIndex = i;
          }
        }
  
        const freq = maxIndex * (audioCtx.sampleRate / analyser.fftSize);
        const char = getClosestChar(freq);
  
        if (char && char !== lastChar) {
          lastChar = char;
  
          if (char === '~') {
            isReceiving = true;
            currentMessage = "";
          } else if (char === '^' && isReceiving) {
            isReceiving = false;
            onMessageDecoded(currentMessage);
          } else if (isReceiving) {
            currentMessage += char;
          }
  
          console.log(`🎵 ${Math.round(freq)} Hz → '${char}'`);
        }
  
        requestAnimationFrame(analyze);
      }
  
      analyze();
    }).catch(err => {
      console.error('Mic error:', err);
      const errorEl = document.getElementById('mic-error');
      if (errorEl) errorEl.innerText = 'Mic access denied';
    });
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
