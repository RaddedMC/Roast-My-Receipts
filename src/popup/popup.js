import { generateRoast } from "../lib/api.js";
import { queryActiveTab, sendMessage } from "../lib/runtime.js";

const savedCount = document.querySelector("#saved-count");
const moneySaved = document.querySelector("#money-saved");
const avgRegret = document.querySelector("#avg-regret");
const roastedToday = document.querySelector("#roasted-today");
const recentRoasts = document.querySelector("#recent-roasts");
const popupStatus = document.querySelector("#popup-status");
const roastCurrentButton = document.querySelector("#roast-current");

void hydrate();

document.querySelector("#open-settings")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

roastCurrentButton?.addEventListener("click", async () => {
  popupStatus.textContent = "Looking at the current tab...";
  setRoastButtonDisabled(true);

  try {
    const [tab] = await queryActiveTab();
    if (!tab?.id || !tab.url?.includes("amazon.ca")) {
      popupStatus.textContent = "Open an Amazon.ca product page first.";
      return;
    }

    const pageResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "page/get-product"
    });

    if (!pageResponse?.ok || !pageResponse.product?.itemName) {
      popupStatus.textContent = "Roastii couldn't find product details on this page.";
      return;
    }

    const storageResponse = await sendMessage("storage/get");
    if (!storageResponse.ok) {
      throw new Error(storageResponse.error || "Unable to load settings.");
    }

    const { settings, questions, items } = storageResponse.data;
    popupStatus.textContent = "Generating roast...";

    const roastData = await generateRoast(settings, pageResponse.product, questions, items);

    await chrome.tabs.sendMessage(tab.id, {
      type: "page/show-roast",
      product: pageResponse.product,
      roastData
    });

    popupStatus.textContent = `Roast ready: ${roastData.regretScore}/10 regret potential.`;
  } catch (error) {
    popupStatus.textContent = `Roast failed: ${error.message || "Unknown error"}`;
  } finally {
    setRoastButtonDisabled(false);
  }
});

async function hydrate() {
  const response = await sendMessage("storage/get");
  if (!response.ok) {
    popupStatus.textContent = `Unable to load Roastii data: ${response.error}`;
    return;
  }

  const { items, stats } = response.data;
  const averageRegret = items.length
    ? (items.reduce((sum, item) => sum + Number(item.regretScore || 0), 0) / items.length).toFixed(1)
    : "0.0";

  savedCount.textContent = `${stats.savedCount || 0}`;
  moneySaved.textContent = `$${Number(stats.moneySaved || 0).toFixed(2)}`;
  avgRegret.textContent = `${averageRegret}/10`;
  roastedToday.textContent = `${stats.roastedToday || 0}`;

  recentRoasts.innerHTML = items.length
    ? items.slice(0, 5).map((item) => `
        <article class="roastii-panel roastii-stack">
          <strong>${item.itemName}</strong>
          <p class="roastii-inline-note">$${Number(item.itemPrice || 0).toFixed(2)} CAD · Regret ${item.regretScore}/10</p>
          <p class="roastii-copy">${item.roast}</p>
        </article>
      `).join("")
    : `<p class="roastii-inline-note">No roasts yet. Go tempt fate on Amazon.ca.</p>`;
}

function setRoastButtonDisabled(disabled) {
  if (!(roastCurrentButton instanceof HTMLButtonElement)) {
    return;
  }

  roastCurrentButton.disabled = disabled;
}