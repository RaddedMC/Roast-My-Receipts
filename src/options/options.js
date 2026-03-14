import { MODEL_OPTIONS } from "../lib/model-config.js";
import { sendMessage } from "../lib/runtime.js";

const form = document.querySelector("#settings-form");
const endpointInput = document.querySelector("#api-endpoint");
const apiKeyInput = document.querySelector("#api-key");
const modelSelect = document.querySelector("#model");
const enabledInput = document.querySelector("#enabled");
const autoRoastInput = document.querySelector("#auto-roast");
const intensitySelect = document.querySelector("#roast-intensity");
const saveStatus = document.querySelector("#save-status");
const connectionStatus = document.querySelector("#connection-status");

modelSelect.innerHTML = MODEL_OPTIONS.map((option) => `<option value="${option.id}">${option.label}</option>`).join("");

void hydrate();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveStatus.textContent = "Saving...";
  const payload = collectSettings();
  const response = await sendMessage("settings/update", payload);
  saveStatus.textContent = response.ok ? "Settings saved." : `Save failed: ${response.error}`;
});

document.querySelector("#test-connection")?.addEventListener("click", async () => {
  connectionStatus.textContent = "Testing...";
  const response = await sendMessage("settings/test", collectSettings());
  connectionStatus.textContent = response.ok
    ? "Connection succeeded. Roastii can reach the configured endpoint."
    : `Connection failed: ${response.error}`;
});

document.querySelector("#clear-data")?.addEventListener("click", async () => {
  const confirmed = window.confirm("Clear Roastii's stored profile, history, and stats?");
  if (!confirmed) {
    return;
  }
  const response = await sendMessage("data/clear");
  saveStatus.textContent = response.ok ? "All data cleared." : `Clear failed: ${response.error}`;
  if (response.ok) {
    await hydrate();
  }
});

document.querySelector("#redo-onboarding")?.addEventListener("click", async () => {
  await sendMessage("onboarding/reset");
  await chrome.tabs.create({
    url: chrome.runtime.getURL("onboarding/onboarding.html")
  });
});

async function hydrate() {
  const response = await sendMessage("storage/get");
  if (!response.ok) {
    saveStatus.textContent = `Unable to load settings: ${response.error}`;
    return;
  }

  const { settings } = response.data;
  endpointInput.value = settings.apiEndpoint;
  apiKeyInput.value = settings.apiKey;
  modelSelect.value = settings.model;
  enabledInput.checked = Boolean(settings.enabled);
  autoRoastInput.checked = Boolean(settings.autoRoastOnAddToCart);
  intensitySelect.value = settings.roastIntensity;
}

function collectSettings() {
  return {
    apiEndpoint: endpointInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    model: modelSelect.value,
    enabled: enabledInput.checked,
    autoRoastOnAddToCart: autoRoastInput.checked,
    roastIntensity: intensitySelect.value
  };
}