export function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({
    type,
    payload
  });
}

export function queryActiveTab() {
  return chrome.tabs.query({
    active: true,
    currentWindow: true
  });
}