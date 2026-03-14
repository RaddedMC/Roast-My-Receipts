import { queryActiveTab, sendMessage } from "../lib/runtime.js";

const savedCount = document.querySelector("#saved-count");
const moneySaved = document.querySelector("#money-saved");
const avgRegret = document.querySelector("#avg-regret");
const roastedToday = document.querySelector("#roasted-today");
const recentRoasts = document.querySelector("#recent-roasts");
const popupStatus = document.querySelector("#popup-status");

void hydrate();

document.querySelector("#open-settings")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

document.querySelector("#roast-current")?.addEventListener("click", async () => {
  popupStatus.textContent = "Looking at the current tab...";
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

  const roastResponse = await sendMessage("roast/generate", {
    product: pageResponse.product
  });

  if (!roastResponse.ok) {
    popupStatus.textContent = `Roast failed: ${roastResponse.error}`;
    return;
  }

  await chrome.tabs.sendMessage(tab.id, {
    type: "page/show-roast",
    product: pageResponse.product,
    roastData: roastResponse.roastData
  });
  popupStatus.textContent = `Roast ready: ${roastResponse.roastData.regretScore}/10 regret potential.`;
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
