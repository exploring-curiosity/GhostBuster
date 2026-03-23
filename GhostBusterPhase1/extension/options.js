const form = document.getElementById('settings-form');
const geminiKeyInput = document.getElementById('geminiApiKey');
const phase2UrlInput = document.getElementById('phase2Url');
const phase2ApiKeyInput = document.getElementById('phase2ApiKey');
const savedMsg = document.getElementById('savedMsg');

chrome.storage.sync.get(
  ['geminiApiKey', 'phase2Url', 'phase2ApiKey'],
  ({ geminiApiKey, phase2Url, phase2ApiKey }) => {
    if (geminiApiKey) geminiKeyInput.value = geminiApiKey;
    if (phase2Url) phase2UrlInput.value = phase2Url;
    if (phase2ApiKey) phase2ApiKeyInput.value = phase2ApiKey;
  }
);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  chrome.storage.sync.set(
    {
      geminiApiKey: geminiKeyInput.value.trim(),
      phase2Url: phase2UrlInput.value.trim().replace(/\/$/, ''),
      phase2ApiKey: phase2ApiKeyInput.value.trim()
    },
    () => {
      savedMsg.textContent = 'Settings saved!';
      savedMsg.style.display = 'block';
      setTimeout(() => { savedMsg.style.display = 'none'; }, 2500);
    }
  );
});
