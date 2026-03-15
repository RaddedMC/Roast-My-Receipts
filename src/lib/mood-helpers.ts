const ANGER_MOOD_ASSETS = [
  "roastii-anger-1.png",
  "roastii-anger-2.svg",
  "roastii-anger-3.svg"
];

const EXCITE_MOOD_ASSET = "roastii-excite.svg";
const MEH_MOOD_ASSET = "roastii-meh.svg";
const THINK_MOOD_ASSET = "roastii-think.svg";

function toAssetUrl(fileName) {
  return chrome.runtime.getURL(`assets/svg/${fileName}`);
}

function randomItem(values) {
  const randomIndex = Math.floor(Math.random() * values.length);
  return values[randomIndex];
}

export function getRandomAngerMoodUrl() {
  return toAssetUrl(randomItem(ANGER_MOOD_ASSETS));
}

export function getExciteMoodUrl() {
  return toAssetUrl(EXCITE_MOOD_ASSET);
}

export function getMehMoodUrl() {
  return toAssetUrl(MEH_MOOD_ASSET);
}

export function getThinkMoodUrl() {
  return toAssetUrl(THINK_MOOD_ASSET);
}

export function getRandomOnboardingMoodUrl() {
  return Math.random() >= 0.5 ? getExciteMoodUrl() : getThinkMoodUrl();
}

export function getPopupMoodUrl(averageRegret) {
  if (averageRegret === 0) {
    return getMehMoodUrl();
  }

  if (averageRegret > 6) {
    return getRandomAngerMoodUrl();
  }

  return getExciteMoodUrl();
}
