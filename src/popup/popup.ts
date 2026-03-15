import { getPopupMoodUrl } from "../lib/mood-helpers.ts";
import { queryActiveTab, sendMessage } from "../lib/runtime.ts";

const savedCount = document.querySelector("#saved-count");
const moneySaved = document.querySelector("#money-saved");
const avgRegret = document.querySelector("#avg-regret");
const roastedToday = document.querySelector("#roasted-today");
const recentRoasts = document.querySelector("#recent-roasts");
const popupStatus = document.querySelector("#popup-status");
const roastCurrentButton = document.querySelector("#roast-current");
const streamState = document.querySelector("#stream-state");
const streamPreview = document.querySelector("#stream-preview");
const popupMoodImage = document.querySelector("#popup-mood-image");

let activeStreamRequestId = "";
let activeStreamBuffer = "";

void hydrate();

document.querySelector("#open-settings")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "roast/stream" || message.requestId !== activeStreamRequestId) {
    return false;
  }

  activeStreamBuffer += message.chunk || "";
  const preview = extractRoastPreview(activeStreamBuffer);
  setStreamingState({
    status: "Creating your roast...",
    stateLabel: preview ? "Creating roast..." : "Roastii is thinking...",
    preview: preview || activeStreamBuffer.trim() || "Still thinking..."
  });
  return false;
});

roastCurrentButton?.addEventListener("click", async () => {
  setRoastButtonDisabled(true);
  activeStreamRequestId = crypto.randomUUID();
  activeStreamBuffer = "";
  setStreamingState({
    status: "Looking at the current tab...",
    stateLabel: "Checking the page...",
    preview: "I'm looking for the product details."
  });

  try {
    const [tab] = await queryActiveTab();
    if (!tab?.id || !tab.url?.includes("amazon.ca")) {
      setStreamingState({
        status: "Open an Amazon.ca product page!",
        stateLabel: "No supported page",
        preview: "Open a product page on Amazon.ca, then try again."
      });
      return;
    }

    const pageResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "page/get-product"
    });
    const product = pageResponse?.product;

    if (!pageResponse?.ok || !product?.itemName) {
      setStreamingState({
        status: "I couldn't find product details on this page.",
        stateLabel: "Product not found",
        preview: "I can't roast this page. It's not a product!"
      });
      return;
    }

    setStreamingState({
      status: "Streaming roast...",
      stateLabel: "Roastii is thinking...",
      preview: "Waiting for the first tokens..."
    });

    const roastResponse = await sendMessage("roast/generate", {
      product,
      requestId: activeStreamRequestId
    });

    if (!roastResponse.ok || !roastResponse.roastData) {
      throw new Error(roastResponse.error || "Unable to generate roast.");
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: "page/show-roast",
      product,
      roastData: roastResponse.roastData
    });

    setStreamingState({
      status: `Roast ready: ${roastResponse.roastData.regretScore}/10 regret potential.`,
      stateLabel: "Final roast ready",
      preview: roastResponse.roastData.roast || "Roast complete."
    });
    await hydrate();
  } catch (error) {
    setStreamingState({
      status: `Roast failed: ${error.message || "Unknown error"}`,
      stateLabel: "Streaming failed",
      preview: "My brain stopped working. Check the endpoint, model, and key in Settings."
    });
  } finally {
    activeStreamRequestId = "";
    activeStreamBuffer = "";
    setRoastButtonDisabled(false);
  }
});

async function hydrate() {
  const response = await sendMessage("storage/get");
  if (!response.ok) {
    popupStatus.textContent = `Unable to load data: ${response.error}`;
    return;
  }

  const { items, stats } = response.data;
  const rawAverageRegret = items.length
    ? items.reduce((sum, item) => sum + Number(item.regretScore || 0), 0) / items.length
    : 0;
  const averageRegret = rawAverageRegret.toFixed(1);
  const popupMoodScore = Number.parseFloat(averageRegret);

  savedCount.textContent = `${stats.savedCount || 0}`;
  moneySaved.textContent = `$${Number(stats.moneySaved || 0).toFixed(2)}`;
  avgRegret.textContent = `${averageRegret}/10`;
  roastedToday.textContent = `${stats.roastedToday || 0}`;

  if (popupMoodImage instanceof HTMLImageElement) {
    popupMoodImage.src = Number.isFinite(popupMoodScore) ? getPopupMoodUrl(popupMoodScore) : getPopupMoodUrl(0);
  }

  recentRoasts.innerHTML = items.length
    ? items.slice(0, 5).map((item) => `
        <article class="roastii-panel roastii-stack">
          <strong>${item.itemName}</strong>
          <p class="roastii-inline-note">$${Number(item.itemPrice || 0).toFixed(2)} CAD · Regret ${item.regretScore}/10</p>
          <p class="roastii-copy">${item.roast}</p>
        </article>
      `).join("")
    : `<p class="roastii-inline-note">No roasts yet. Go tempt fate on Amazon.ca.</p>`;

  if (streamState && !activeStreamRequestId) {
    streamState.textContent = "Standing by";
  }

  if (streamPreview && !activeStreamRequestId) {
    streamPreview.textContent = "Start a roast!";
  }
}

function setRoastButtonDisabled(disabled) {
  if (!(roastCurrentButton instanceof HTMLButtonElement)) {
    return;
  }

  roastCurrentButton.disabled = disabled;
}

function setStreamingState({ status, stateLabel, preview }) {
  popupStatus.textContent = status;
  if (streamState) {
    streamState.textContent = stateLabel;
  }

  if (streamPreview) {
    streamPreview.textContent = preview;
  }
}

function extractRoastPreview(rawText) {
  const roastKeyIndex = rawText.indexOf('"roast"');
  if (roastKeyIndex === -1) {
    return "";
  }

  const colonIndex = rawText.indexOf(":", roastKeyIndex);
  if (colonIndex === -1) {
    return "";
  }

  const firstQuoteIndex = rawText.indexOf('"', colonIndex + 1);
  if (firstQuoteIndex === -1) {
    return "";
  }

  let result = "";
  let escaped = false;
  for (let index = firstQuoteIndex + 1; index < rawText.length; index += 1) {
    const character = rawText[index];

    if (escaped) {
      switch (character) {
        case "n":
          result += "\n";
          break;
        case "r":
          result += "\r";
          break;
        case "t":
          result += "\t";
          break;
        default:
          result += character;
          break;
      }
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      break;
    }

    result += character;
  }

  return result.trim();
}
