import { audioCtx } from './encoder.js';

const baseFreq = 400;
const step = 20;
const MESSAGE_TERMINATOR = '#';
let incomingBuffer = '';
let silenceTimeout = null;

function freqToChar(freq) {
  const code = Math.round((freq - baseFreq) / step);
  if (code >= 32 && code <= 126) {
    return String.fromCharCode(code);
  }
  return ''; // Ignore out-of-range chars
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
    const freq = (maxIndex * audioCtx.sampleRate) / analyser.fftSize / 2;
    const decodedChar = freqToChar(freq);

    if (decodedChar) {
      console.log(`🎵 Freq: ${freq.toFixed(1)} Hz → '${decodedChar}'`);
      incomingBuffer += decodedChar;

      if (decodedChar === MESSAGE_TERMINATOR) {
        const completeMsg = incomingBuffer;
        console.log("📥 Decoded Message:", completeMsg);
        incomingBuffer = '';
        onDecoded(completeMsg);
      }

      if (silenceTimeout) clearTimeout(silenceTimeout);
      silenceTimeout = setTimeout(() => {
        if (incomingBuffer.length > 0) {
          console.log("⌛ Timeout - Partial Message:", incomingBuffer);
          onDecoded(incomingBuffer);
          incomingBuffer = '';
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
