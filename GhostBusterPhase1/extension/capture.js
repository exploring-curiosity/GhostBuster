/**
 * Capture fallback page — opens when mic recording fails.
 * Reads screenshot from storage, lets user type description, sends to background.
 */

const screenshotImg = document.getElementById('screenshot');
const descriptionEl = document.getElementById('description');
const sendBtn = document.getElementById('sendBtn');
const statusBar = document.getElementById('statusBar');

// Load screenshot
chrome.storage.local.get(['captureData'], (result) => {
  const data = result.captureData;
  if (data?.screenshot) {
    screenshotImg.src = 'data:image/png;base64,' + data.screenshot;
  }
});

sendBtn.addEventListener('click', () => {
  const text = descriptionEl.value.trim();
  if (!text) {
    showStatus('Please type a bug description.', 'error');
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Analyzing...';
  showStatus('Sending to Gemini for analysis...', '');

  chrome.storage.local.get(['captureData'], (result) => {
    const data = result.captureData || {};
    chrome.runtime.sendMessage({
      type: 'ghostbuster-text-analyze',
      payload: {
        screenshot: data.screenshot || '',
        textDescription: text,
        pageUrl: data.pageUrl || '',
        viewport: data.viewport || { width: 1440, height: 900 }
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to Agent';
        return;
      }
      if (response?.success) {
        showStatus('Bug sent to agent! ID: ' + response.diagnosisId + '\nAnalysis: ' + response.bugDescription, 'success');
        sendBtn.textContent = 'Sent!';
        chrome.storage.local.remove('captureData');
      } else {
        showStatus('Failed: ' + (response?.error || 'Unknown'), 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send to Agent';
      }
    });
  });
});

function showStatus(msg, type) {
  statusBar.textContent = msg;
  statusBar.className = 'status-bar visible' + (type ? ' ' + type : '');
}
