const toggleBtn = document.getElementById('toggle');
const statusEl = document.getElementById('status');
const dotEl = document.getElementById('dot');
const transcriptEl = document.getElementById('transcript');
const settingsLink = document.getElementById('openSettings');

let isRecording = false;
let recognition = null;
let fullTranscript = '';
let screenshotDataUrl = null;
let domSnapshot = null;
let pageUrl = null;
let viewport = null;

function setUI(state, msg) {
  statusEl.textContent = msg;
  dotEl.className = 'dot' + (state === 'recording' ? ' recording' : state === 'busy' ? ' busy' : '');
  toggleBtn.disabled = state === 'busy';
  toggleBtn.textContent = state === 'recording' ? 'Stop & Analyze' : 'Start Capture';
  toggleBtn.className = state === 'recording' ? 'stop' : '';
  if (state === 'recording') {
    transcriptEl.classList.add('active');
  }
}

settingsLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function startCapture() {
  try {
    // 1. Capture screenshot
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    // 2. Capture DOM + page info
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        dom: document.documentElement.outerHTML,
        url: window.location.href,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      })
    });
    domSnapshot = result.dom;
    pageUrl = result.url;
    viewport = result.viewport;

    // 3. Start speech recognition (no getUserMedia needed — Chrome handles mic internally)
    fullTranscript = '';
    transcriptEl.textContent = 'Listening...';
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        fullTranscript = final.trim();
        transcriptEl.textContent = fullTranscript + (interim ? ' ' + interim : '') || 'Listening...';
        transcriptEl.scrollTop = transcriptEl.scrollHeight;
      };
      recognition.onerror = (e) => {
        console.warn('Speech recognition error:', e.error);
        if (e.error === 'no-speech') return;
      };
      recognition.onend = () => {
        // Restart if still recording (recognition auto-stops after silence)
        if (isRecording && recognition) {
          try { recognition.start(); } catch {}
        }
      };
      recognition.start();
    } else {
      transcriptEl.textContent = 'Speech recognition unavailable. Type your description after stopping.';
    }

    isRecording = true;
    setUI('recording', 'Recording... Describe the bug you see, then click Stop & Analyze.');
  } catch (err) {
    cleanup();
    setUI('idle', 'Error: ' + err.message);
  }
}

function cleanup() {
  if (recognition) { try { recognition.stop(); } catch {} recognition = null; }
  isRecording = false;
}

async function stopAndAnalyze() {
  cleanup();
  setUI('busy', 'Analyzing with Gemini...');

  const transcript = fullTranscript || '(No voice description provided)';
  const screenshotBase64 = screenshotDataUrl ? screenshotDataUrl.replace(/^data:image\/png;base64,/, '') : null;

  // Send to background for Gemini analysis + Phase 2 POST
  chrome.runtime.sendMessage({
    type: 'ghostbuster-analyze',
    payload: {
      screenshot: screenshotBase64,
      dom_snapshot: domSnapshot ? domSnapshot.slice(0, 50000) : '',
      voice_transcript: transcript,
      page_url: pageUrl,
      viewport: viewport
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      setUI('idle', 'Error: ' + chrome.runtime.lastError.message);
      return;
    }
    if (response?.success) {
      setUI('idle', 'Bug sent to agent! Diagnosis ID: ' + (response.diagnosisId || 'unknown'));
      transcriptEl.textContent = 'Analysis: ' + (response.bugDescription || 'Sent to agent');
    } else {
      setUI('idle', 'Failed: ' + (response?.error || 'Unknown error'));
    }
  });
}

toggleBtn.addEventListener('click', async () => {
  if (isRecording) {
    await stopAndAnalyze();
  } else {
    await startCapture();
  }
});
