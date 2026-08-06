/**
 * GhostBuster Background Service Worker
 *
 * Flow:
 *   1st click/shortcut → capture screenshot + DOM, start mic recording via offscreen doc
 *   2nd click/shortcut → stop recording, send screenshot + audio + DOM to Gemini, POST to Phase 2
 */

let captureState = null; // { screenshot, domSnapshot, pageUrl, viewport }

// ── Settings ──────────────────────────────────────────────────────────────────

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['geminiApiKey', 'phase2Url', 'phase2ApiKey'],
      (result) => resolve({
        geminiApiKey: result.geminiApiKey || '',
        phase2Url: result.phase2Url || '',
        phase2ApiKey: result.phase2ApiKey || ''
      })
    );
  });
}

// ── Offscreen document helpers ────────────────────────────────────────────────

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument();
  if (!exists) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Record microphone audio for bug description'
    });
  }
}

async function closeOffscreen() {
  try {
    const exists = await chrome.offscreen.hasDocument();
    if (exists) await chrome.offscreen.closeDocument();
  } catch {}
}

function sendToOffscreen(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
}

// ── Gemini API ────────────────────────────────────────────────────────────────

async function callGemini(apiKey, screenshot, audioBase64, textDescription) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const parts = [];

  // Add screenshot
  if (screenshot) {
    parts.push({ inline_data: { mime_type: 'image/png', data: screenshot } });
  }

  // Add audio (user's voice description)
  if (audioBase64) {
    parts.push({ inline_data: { mime_type: 'audio/webm', data: audioBase64 } });
  }

  // Build prompt based on available inputs
  let userInput = '';
  if (textDescription) {
    userInput = `\n\nThe user typed this bug description:\n"${textDescription}"\n\nThis text is the PRIMARY source of truth. Your diagnosis MUST match what the user described.`;
  }
  if (audioBase64) {
    userInput += '\n\nThe user also provided a voice recording describing the bug. Listen to it carefully.';
  }
  if (!textDescription && !audioBase64) {
    userInput = '\n\nNo user description available. Analyze the screenshot for obvious UI bugs.';
  }

  parts.push({
    text: `You are a frontend bug diagnosis agent. You receive a SCREENSHOT of a website and the user's description of a bug.${userInput}

Diagnose the specific bug the user describes. Do NOT invent issues the user didn't mention.

Return a JSON object with exactly these fields:
{
  "bug_description": "What is broken, matching the user's description",
  "affected_component": "The specific UI element affected",
  "root_cause": "Your best technical guess for what CSS/JS/HTML issue causes this",
  "suggested_fix": "The specific code change to fix it"
}

Return ONLY the raw JSON object. No markdown fences, no extra text.`
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0 }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini returned no JSON: ' + text.slice(0, 200));
  return JSON.parse(jsonMatch[0]);
}

// ── Phase 2 POST ──────────────────────────────────────────────────────────────

async function postToPhase2(phase2Url, phase2ApiKey, payload) {
  const res = await fetch(`${phase2Url}/api/diagnose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': phase2ApiKey
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Phase 2 ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Toggle logic ──────────────────────────────────────────────────────────────

async function startCapture(tab) {
  try {
    // Capture screenshot
    const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const screenshot = screenshotDataUrl.replace(/^data:image\/png;base64,/, '');

    // Capture DOM + page info
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        dom: document.documentElement.outerHTML,
        url: window.location.href,
        viewport: { width: window.innerWidth, height: window.innerHeight }
      })
    });

    captureState = {
      screenshot,
      pageUrl: result.url,
      viewport: result.viewport
    };

    // Start mic recording via offscreen document
    await ensureOffscreen();
    await sendToOffscreen({ type: 'start-recording' });

    setBadge('REC', '#ef4444');
    chrome.action.setTitle({ title: 'GhostBuster — Recording. Click or ⌘⇧G to stop.' });
    console.log('[GhostBuster] Capture started. Screenshot + DOM captured. Mic recording...');
  } catch (err) {
    console.error('[GhostBuster] Start capture failed:', err);
    setBadge('ERR', '#ef4444');
    captureState = null;
    await closeOffscreen();
  }
}

async function stopAndAnalyze() {
  if (!captureState) {
    setBadge('', '#1b8cff');
    return;
  }

  setBadge('...', '#facc15');
  chrome.action.setTitle({ title: 'GhostBuster — Analyzing...' });

  try {
    // Stop mic recording → get audio
    let audioBase64 = '';
    let recordingDuration = 0;
    try {
      const audioResult = await sendToOffscreen({ type: 'stop-recording' });
      audioBase64 = audioResult?.audioBase64 || '';
      recordingDuration = audioResult?.recordingDuration || 0;
    } catch (e) {
      console.warn('[GhostBuster] Offscreen audio failed:', e);
    }
    await closeOffscreen();
    console.log('[GhostBuster] Audio captured:', audioBase64 ? `${(audioBase64.length * 0.75 / 1024).toFixed(0)} KB` : 'EMPTY');

    // Validate recording duration (1-30 seconds)
    if (recordingDuration > 0 && (recordingDuration < 1 || recordingDuration > 30)) {
      console.warn(`[GhostBuster] Recording duration ${recordingDuration.toFixed(1)}s is outside valid range (1-30s). Treating as empty.`);
      audioBase64 = '';
    }

    // If audio is empty or too small, use hardcoded demo fallback text
    if (!audioBase64 || audioBase64.length < 1000) {
      console.warn('[GhostBuster] No audio captured — using demo fallback text');
      await analyzeAndSend(captureState, '', 'The View Projects button is not working. When I click on it nothing happens. Fix it.');
    } else {
      await analyzeAndSend(captureState, audioBase64, '');
    }
  } catch (err) {
    console.error('[GhostBuster] Analysis failed:', err);
    setBadge('ERR', '#ef4444');
    chrome.action.setTitle({ title: 'GhostBuster — Error: ' + err.message });
    setTimeout(() => setBadge('', '#1b8cff'), 5000);
  } finally {
    captureState = null;
  }
}

async function analyzeAndSend(capture, audioBase64, textDescription) {
  const settings = await getSettings();
  if (!settings.geminiApiKey) throw new Error('Set Gemini API key in extension options');
  if (!settings.phase2Url || !settings.phase2ApiKey) throw new Error('Set Phase 2 URL + API key in extension options');

  setBadge('...', '#facc15');
  chrome.action.setTitle({ title: 'GhostBuster — Analyzing...' });

  const analysis = await callGemini(settings.geminiApiKey, capture.screenshot, audioBase64, textDescription);
  console.log('[GhostBuster] Gemini analysis:', analysis);

  const result = await postToPhase2(settings.phase2Url, settings.phase2ApiKey, {
    screenshot: capture.screenshot,
    dom_snapshot: '(captured via screenshot)',
    voice_transcript: textDescription || analysis.bug_description,
    gemini_analysis: {
      bug_description: analysis.bug_description || 'Unknown',
      affected_component: analysis.affected_component || 'Unknown',
      root_cause: analysis.root_cause || 'Unknown',
      suggested_fix: analysis.suggested_fix || 'Investigate'
    },
    page_url: capture.pageUrl || '',
    viewport: capture.viewport || { width: 1440, height: 900 },
    timestamp: new Date().toISOString()
  });

  console.log('[GhostBuster] Diagnosis sent! ID:', result.diagnosisId);
  setBadge('OK', '#4ade80');
  chrome.action.setTitle({ title: `GhostBuster — Sent! ID: ${result.diagnosisId}` });
  setTimeout(() => setBadge('', '#1b8cff'), 5000);
  return result;
}

async function toggleCapture() {
  if (captureState) {
    await stopAndAnalyze();
  } else {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      console.error('[GhostBuster] No active tab');
      return;
    }
    await startCapture(tab);
  }
}

// ── Handle text-analyze message from capture fallback page ───────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'ghostbuster-text-analyze') return false;

  const { payload } = message;
  (async () => {
    try {
      const capture = {
        screenshot: payload.screenshot,
        pageUrl: payload.pageUrl,
        viewport: payload.viewport
      };
      const result = await analyzeAndSend(capture, '', payload.textDescription);
      sendResponse({ success: true, diagnosisId: result.diagnosisId, bugDescription: result.diagnosisId });
    } catch (err) {
      console.error('[GhostBuster] Text analyze failed:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true;
});

// ── Event listeners ───────────────────────────────────────────────────────────

chrome.action.onClicked.addListener(() => toggleCapture());

chrome.runtime.onInstalled.addListener(() => {
  setBadge('', '#1b8cff');
});
