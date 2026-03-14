import { generateOnboardingFinalRoast, generateOnboardingQuestion, generateRoast, testConnection } from "../lib/api.ts";
import { STORAGE_KEYS } from "../lib/constants.ts";
import { addPurchaseItem, addQuestionAnswer, clearAllData, completeOnboarding, getData, resetOnboarding, updateSettings, updateStats } from "../lib/storage.ts";

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") {
    await chrome.storage.local.clear();
    await getData();
    await chrome.runtime.openOptionsPage();
    chrome.tabs.create({
      url: chrome.runtime.getURL("onboarding/onboarding.html")
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handleMessage(message)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: error.message || "Unknown error" }));

  return true;
});

async function handleMessage(message) {
  const data = await getData();
  const settings = data[STORAGE_KEYS.settings];

  switch (message.type) {
    case "storage/get":
      return {
        data
      };
    case "settings/update":
      return {
        settings: await updateSettings(message.payload)
      };
    case "settings/test":
      return {
        result: await testConnection({
          ...settings,
          ...message.payload
        })
      };
    case "onboarding/next":
      return {
        result: await generateOnboardingQuestion(settings, data[STORAGE_KEYS.questions])
      };
    case "onboarding/answer": {
      const questions = await addQuestionAnswer({
        questionId: message.payload.question.id,
        questionTitle: message.payload.question.title,
        userAnswer: message.payload.answer,
        llmNotesOnAnswer: ""
      });
      return {
        questions
      };
    }
    case "onboarding/final-roast":
      return {
        result: await generateOnboardingFinalRoast(settings, data[STORAGE_KEYS.questions])
      };
    case "onboarding/complete":
      await completeOnboarding();
      return {
        completed: true
      };
    case "onboarding/reset":
      await resetOnboarding();
      return {
        reset: true
      };
    case "roast/generate": {
      const roastData = await generateRoast(
        settings,
        message.payload.product,
        data[STORAGE_KEYS.questions],
        data[STORAGE_KEYS.items],
        {
          onChunk(chunk) {
            void emitStreamChunk(message.payload.requestId, chunk);
          }
        }
      );
      return {
        roastData
      };
    }
    case "purchase/record": {
      const items = await addPurchaseItem(message.payload.item);
      const stats = await updateStats({
        roastedToday: (data[STORAGE_KEYS.stats].roastedToday || 0) + 1
      });
      await chrome.action.setBadgeText({
        text: `${Math.min(stats.roastedToday, 99)}`
      });
      return { items };
    }
    case "wallet/save": {
      const stats = await updateStats({
        savedCount: (data[STORAGE_KEYS.stats].savedCount || 0) + 1,
        moneySaved: Number((data[STORAGE_KEYS.stats].moneySaved + (message.payload.amount || 0)).toFixed(2)),
        roastedToday: (data[STORAGE_KEYS.stats].roastedToday || 0) + 1
      });
      await chrome.action.setBadgeText({
        text: `${Math.min(stats.roastedToday, 99)}`
      });
      return { stats };
    }
    case "data/clear":
      await clearAllData();
      await chrome.action.setBadgeText({ text: "" });
      return {
        cleared: true
      };
    default:
      return {};
  }
}

async function emitStreamChunk(requestId, chunk) {
  if (!requestId || !chunk) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: "roast/stream",
      requestId,
      chunk
    });
  } catch (_error) {
    // Ignore missing listeners so popup closure does not fail roast generation.
  }
}
