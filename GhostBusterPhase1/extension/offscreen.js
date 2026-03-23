/**
 * Offscreen document for microphone recording.
 * Runs getUserMedia + MediaRecorder in this context since
 * service workers can't access these APIs.
 */

let recorder = null;
let chunks = [];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'start-recording') {
    startRecording().then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'stop-recording') {
    stopRecording().then(audioBase64 => sendResponse({ success: true, audioBase64 }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(1000); // collect chunks every second
}

function stopRecording() {
  return new Promise((resolve, reject) => {
    if (!recorder || recorder.state === 'inactive') {
      resolve('');
      return;
    }
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        // Stop all tracks
        recorder.stream.getTracks().forEach(t => t.stop());
        recorder = null;
        chunks = [];
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };
    recorder.stop();
  });
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
