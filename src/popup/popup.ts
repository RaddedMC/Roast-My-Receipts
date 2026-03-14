import { generateRoast } from "../lib/api.ts";
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

void hydrate();

document.querySelector("#open-settings")?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

roastCurrentButton?.addEventListener("click", async () => {
  setStreamingState({
    status: "Looking at the current tab...",
    stateLabel: "Checking the page...",
    preview: "Roastii is looking for the product details first."
  });
  setRoastButtonDisabled(true);

  try {
    const [tab] = await queryActiveTab();
    if (!tab?.id || !tab.url?.includes("amazon.ca")) {
      setStreamingState({
        status: "Open an Amazon.ca product page first.",
        stateLabel: "No supported page",
        preview: "Open a product page on Amazon.ca, then try again."
      });
      return;
    }

    const pageResponse = await chrome.tabs.sendMessage(tab.id, {
      type: "page/get-product"
    });

    if (!pageResponse?.ok || !pageResponse.product?.itemName) {
      setStreamingState({
        status: "Roastii couldn't find product details on this page.",
        stateLabel: "Product not found",
        preview: "This page did not expose enough product info for a roast."
      });
      return;
    }

    const storageResponse = await sendMessage("storage/get");
    if (!storageResponse.ok) {
      throw new Error(storageResponse.error || "Unable to load settings.");
    }

    const { settings, questions, items } = storageResponse.data;
    let streamBuffer = "";

    setStreamingState({
      status: "Streaming roast...",
      stateLabel: "Roastii is thinking...",
      preview: "Waiting for the first tokens..."
    });

    const roastData = await generateRoast(settings, pageResponse.product, questions, items, {
      onChunk(chunk) {
        streamBuffer += chunk;
        const preview = extractRoastPreview(streamBuffer);
        if (streamState) {
          streamState.textContent = preview ? "Streaming live..." : "Roastii is thinking...";
        }

        if (streamPreview) {
          streamPreview.textContent = preview || streamBuffer.trim() || "Waiting for the first tokens...";
        }
      }
    });

    await chrome.tabs.sendMessage(tab.id, {
      type: "page/show-roast",
      product: pageResponse.product,
      roastData
    });

    setStreamingState({
      status: `Roast ready: ${roastData.regretScore}/10 regret potential.`,
      stateLabel: "Final roast ready",
      preview: roastData.roast || "Roast complete."
    });
  } catch (error) {
    setStreamingState({
      status: `Roast failed: ${error.message || "Unknown error"}`,
      stateLabel: "Streaming failed",
      preview: "Roastii hit a snag talking to the model. Check the endpoint, model, and key in Settings."
    });
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

  if (streamState) {
    streamState.textContent = "Standing by";
  }

  if (streamPreview) {
    streamPreview.textContent = "Start a roast to watch Roastii stream the takedown live.";
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
