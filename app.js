import { sendMessage, myID } from './encoder.js';
import { startMic, stopMic } from './decoder.js';
import { addSentLog, addRecvLog, showMonitorIcon, hideMonitorIcon } from './visualizer.js';
import { MESSAGE_START, MESSAGE_END } from './utils.js';

const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const darkModeBtn = document.getElementById('darkModeBtn');
const darkModeMsg = document.getElementById('darkModeMsg');
const stopListenBtn = document.getElementById('stopListenBtn');
const listenIcon = document.getElementById('listenIcon');
const listenText = document.getElementById('listenText');
const micError = document.getElementById('micError');
const volumeLevel = document.getElementById('volumeLevel');
const visualizerCanvas = document.getElementById('visualizer');

// === Device ID generation ===
function generateDeviceId() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}
let deviceId = localStorage.getItem('tempDeviceId');
if (!deviceId) {
  deviceId = generateDeviceId();
  localStorage.setItem('tempDeviceId', deviceId);
}
window.addEventListener('beforeunload', () => {
  localStorage.removeItem('tempDeviceId');
});
const deviceDisplay = document.getElementById('deviceIDDisplay');
if (deviceDisplay) {
  deviceDisplay.textContent = deviceId;
}

let isMicActive = false;
let isDark = false;
let monitorMode = JSON.parse(localStorage.getItem('monitorMode')) || false;
const seenMessageIds = new Set();

function generateMessageID() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// === Send Message ===
// Note: Do NOT wrap the raw message here because encoder.js wraps it.
sendBtn.addEventListener('click', () => {
  const msg = messageInput.value.trim();
  if (!msg) return;
  const receiver = prompt("Enter receiver ID (leave empty for broadcast):") || 'broadcast';
  const id = generateMessageID();
  // Construct header; encoder.js will add the start/end markers.
  const payload = `[${deviceId}->${receiver}#${id}|hop0] ` + msg;
  addSentLog(`To ${receiver}: ${msg}`);
  sendMessage(payload, showSpeakerVolume);
  messageInput.value = '';
});

function showSpeakerVolume(val) {
  volumeLevel.textContent = document.body.classList.contains('dark') ? '' : `🔊 Speaker: ${val}`;
}

// === Dark mode toggle ===
darkModeBtn.addEventListener('click', () => {
  const wasDark = document.body.classList.contains('dark');
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  if (!wasDark && isDark) {
    darkModeMsg.style.display = 'block';
    darkModeMsg.classList.add('fadeOut');
    setTimeout(() => {
      darkModeMsg.style.display = 'none';
      darkModeMsg.classList.remove('fadeOut');
    }, 2000);
  }
});

// === Mic toggle ===
stopListenBtn.addEventListener('click', () => {
  if (isMicActive) {
    stopMic();
    isMicActive = false;
    listenIcon.textContent = '🎤';
    listenText.style.textDecoration = 'none';
  } else {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        micError.style.display = 'none';
        startMic(
          handleDecodedMessage,
          () => {
            micError.style.display = 'block';
            micError.style.cursor = 'pointer';
            micError.title = 'Click to grant mic access';
            micError.addEventListener('click', requestMicAccessOnce, { once: true });
          },
          () => { micError.style.display = 'none'; },
          visualizerCanvas
        );
        isMicActive = true;
        listenIcon.textContent = '🔇';
        listenText.style.textDecoration = 'line-through';
      })
      .catch(() => {
        micError.style.display = 'block';
        micError.style.cursor = 'pointer';
        micError.title = 'Click to grant mic access';
        addRecvLog("🚫 Microphone access denied. Please allow mic access and try again.");
        micError.addEventListener('click', requestMicAccessOnce, { once: true });
      });
  }
});

function requestMicAccessOnce() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => {
      micError.style.display = 'none';
      if (!isMicActive) stopListenBtn.click();
    })
    .catch(() => {
      alert("Microphone access is still blocked. Please enable it from your browser settings.");
    });
}

// === Message handler ===
// Expected format: "[sender->receiver#id|hop] rawMessage"
// Decoder (in decoder.js) returns only the raw message (without start/end markers).
function handleDecodedMessage(fullMessage) {
  if (!fullMessage.includes(']')) return;
  const match = fullMessage.match(/\[([^\-]+)->([^\#]+)#([^\|]+)\|hop(\d+)\]\s?(.*)/);
  if (!match) return;
  const [_, from, to, msgID, hop, remainder] = match;
  // Extract message between MESSAGE_START and MESSAGE_END
  const startIdx = remainder.indexOf(MESSAGE_START);
  const endIdx = remainder.indexOf(MESSAGE_END);
  if (startIdx === -1 || endIdx === -1) return;
  const msg = remainder.substring(startIdx + 1, endIdx);
  
  if (seenMessageIds.has(msgID)) return;
  seenMessageIds.add(msgID);
  
  const hopNum = parseInt(hop);
  const rebroadcast = `[${from}->${to}#${msgID}|hop${hopNum + 1}] ${MESSAGE_START}${msg}${MESSAGE_END}`;
  
  if (to === deviceId || to === 'broadcast') {
    addRecvLog(`From ${from}: ${msg}`);
  } else if (monitorMode && deviceId === 'Iam') {
    addRecvLog(`🔁 Relayed: From ${from} to ${to}: "${msg}"`);
  }
  
  if (to !== deviceId) {
    sendMessage(rebroadcast, showSpeakerVolume);
  }
}

// === Monitor mode toggle (Shift + M) ===
document.addEventListener('keydown', (e) => {
  if (deviceId === 'Iam' && e.shiftKey && e.key.toLowerCase() === 'm') {
    monitorMode = !monitorMode;
    localStorage.setItem('monitorMode', JSON.stringify(monitorMode));
    updateMonitorIcon();
    addRecvLog(`🕹️ Monitor mode ${monitorMode ? 'enabled' : 'disabled'}`);
  }
});
function updateMonitorIcon() {
  let icon = document.getElementById('monitorIcon');
  if (!icon) {
    icon = document.createElement('span');
    icon.id = 'monitorIcon';
    icon.style.marginLeft = '0.5rem';
    stopListenBtn.parentNode.insertBefore(icon, stopListenBtn.nextSibling);
  }
  icon.textContent = monitorMode ? '🕹️' : '';
}

// === Init on page load ===
window.addEventListener('DOMContentLoaded', () => {
  stopListenBtn.style.display = 'inline-flex';
  updateMonitorIcon();
  if (!isMicActive) stopListenBtn.click();
  const deviceInfoEl = document.getElementById('deviceIDDisplay');
  if (deviceInfoEl) {
    deviceInfoEl.textContent = deviceId;
  }
});
