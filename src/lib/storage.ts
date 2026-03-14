import { DEFAULT_SETTINGS, DEFAULT_STATS, ONBOARDING_QUESTIONS, STORAGE_KEYS } from "./constants.ts";

const DEFAULT_STORE = {
  [STORAGE_KEYS.onboardingComplete]: false,
  [STORAGE_KEYS.questions]: [],
  [STORAGE_KEYS.items]: [],
  [STORAGE_KEYS.settings]: DEFAULT_SETTINGS,
  [STORAGE_KEYS.stats]: DEFAULT_STATS
};

function normalizeQuestions(questions = []) {
  const byId = new Map();
  const orderById = new Map(
    ONBOARDING_QUESTIONS.map((question, index) => [question.id, index])
  );

  for (const question of questions) {
    if (!question?.questionId) {
      continue;
    }

    byId.set(question.questionId, question);
  }

  return Array.from(byId.values()).sort(
    (left, right) => (orderById.get(left.questionId) ?? Number.MAX_SAFE_INTEGER) - (orderById.get(right.questionId) ?? Number.MAX_SAFE_INTEGER)
  );
}

export async function getData() {
  const result = await chrome.storage.local.get(DEFAULT_STORE);
  const questions = normalizeQuestions(result[STORAGE_KEYS.questions] || []);
  return {
    ...DEFAULT_STORE,
    ...result,
    [STORAGE_KEYS.questions]: questions,
    [STORAGE_KEYS.settings]: {
      ...DEFAULT_SETTINGS,
      ...(result[STORAGE_KEYS.settings] || {})
    },
    [STORAGE_KEYS.stats]: {
      ...DEFAULT_STATS,
      ...(result[STORAGE_KEYS.stats] || {})
    }
  };
}

export async function updateSettings(partialSettings) {
  const data = await getData();
  const settings = {
    ...data[STORAGE_KEYS.settings],
    ...partialSettings
  };
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: settings
  });
  return settings;
}

export async function addQuestionAnswer(question) {
  const data = await getData();
  const questions = normalizeQuestions([
    ...data[STORAGE_KEYS.questions].filter((entry) => entry.questionId !== question.questionId),
    question
  ]);
  await chrome.storage.local.set({
    [STORAGE_KEYS.questions]: questions
  });
  return questions;
}

export async function completeOnboarding() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.onboardingComplete]: true
  });
}

export async function resetOnboarding() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.onboardingComplete]: false,
    [STORAGE_KEYS.questions]: []
  });
}

export async function addPurchaseItem(item) {
  const data = await getData();
  const items = [item, ...data[STORAGE_KEYS.items]].slice(0, 100);
  await chrome.storage.local.set({
    [STORAGE_KEYS.items]: items
  });
  return items;
}

export async function updateStats(partialStats) {
  const data = await getData();
  const stats = {
    ...data[STORAGE_KEYS.stats],
    ...partialStats
  };
  await chrome.storage.local.set({
    [STORAGE_KEYS.stats]: stats
  });
  return stats;
}

export async function clearAllData() {
  await chrome.storage.local.clear();
  await chrome.storage.local.set(DEFAULT_STORE);
}
