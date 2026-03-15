import { ONBOARDING_QUESTION_LIMIT } from "../lib/constants.ts";
import { getExciteMoodUrl, getRandomAngerMoodUrl } from "../lib/mood-helpers.ts";
import { sendMessage } from "../lib/runtime.ts";

const apiKeyGate = document.querySelector("#api-key-gate");
const onboardingApiKeyInput = document.querySelector("#onboarding-api-key");
const validateApiKeyButton = document.querySelector("#validate-api-key");
const openOptionsButton = document.querySelector("#open-options");
const apiKeyStatus = document.querySelector("#api-key-status");
const onboardingMoodImage = document.querySelector("#onboarding-mood-image");
const progressCount = document.querySelector("#progress-count");
const questionTitle = document.querySelector("#question-title");
const questionOptions = document.querySelector("#question-options");
const questionForm = document.querySelector("#question-form");
const customAnswerWrap = document.querySelector("#custom-answer-wrap");
const customAnswerInput = document.querySelector("#custom-answer");
const followUpWrap = document.querySelector("#follow-up-wrap");
const followUpLabel = document.querySelector("#follow-up-label");
const followUpInput = document.querySelector("#follow-up-input");
const internalNote = document.querySelector("#internal-note");

let currentQuestion = null;
let onboardingUnlocked = false;

if (onboardingMoodImage instanceof HTMLImageElement) {
  onboardingMoodImage.src = getExciteMoodUrl();
}

void initializeOnboarding();

validateApiKeyButton?.addEventListener("click", () => {
  void validateAndStartOnboarding();
});

openOptionsButton?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

questionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!onboardingUnlocked || !currentQuestion) {
    return;
  }

  const answer = collectAnswer(currentQuestion);
  if (!answer) {
    internalNote.textContent = "I need an answer to continue!";
    return;
  }

  internalNote.textContent = "Answer saved. Building your profile...";
  const response = await sendMessage("onboarding/answer", {
    question: currentQuestion,
    answer
  });

  if (!response.ok) {
    internalNote.textContent = `oof. Error!: ${response.error}`;
    return;
  }

  const latestEntry = response.questions.at(-1);
  internalNote.textContent = latestEntry?.llmNotesOnAnswer || "Pattern stored for future judgement.";
  progressCount.textContent = `${response.questions.length}/${ONBOARDING_QUESTION_LIMIT}`;
  await loadNextQuestion();
});

async function initializeOnboarding() {
  if (!apiKeyStatus || !internalNote) {
    return;
  }

  const response = await sendMessage("storage/get");
  if (!response.ok) {
    apiKeyStatus.textContent = `Unable to load settings: ${response.error}`;
    internalNote.textContent = "I cannot start until settings load!";
    return;
  }

  const existingApiKey = response.data.settings.apiKey?.trim() || "";
  if (onboardingApiKeyInput) {
    onboardingApiKeyInput.value = existingApiKey;
  }

  if (!existingApiKey) {
    apiKeyStatus.textContent = "Enter your API key, then validate to start.";
    internalNote.textContent = "I need your API key before I can start profiling your spending patterns!";
    return;
  }

  setGateBusy(true);
  apiKeyStatus.textContent = "Saved API key found. Validating connection...";
  const testResponse = await sendMessage("settings/test", {
    apiKey: existingApiKey
  });

  if (!testResponse.ok) {
    apiKeyStatus.textContent = `Saved key failed validation: ${testResponse.error}`;
    internalNote.textContent = "Update the key and validate again to begin.";
    setGateBusy(false);
    return;
  }

  apiKeyStatus.textContent = "Saved key validated. Let me get ready...";
  await unlockOnboarding();
  setGateBusy(false);
}

async function validateAndStartOnboarding() {
  const apiKey = onboardingApiKeyInput?.value.trim() || "";
  if (!apiKey) {
    apiKeyStatus.textContent = "An API key is required before we can start.";
    internalNote.textContent = "Paste your API key to continue setup.";
    return;
  }

  setGateBusy(true);
  apiKeyStatus.textContent = "Saving API key...";
  const saveResponse = await sendMessage("settings/update", {
    apiKey
  });

  if (!saveResponse.ok) {
    apiKeyStatus.textContent = `Could not save API key: ${saveResponse.error}`;
    internalNote.textContent = "I couldn't store your key. Try again or open settings.";
    setGateBusy(false);
    return;
  }

  apiKeyStatus.textContent = "Testing API connection...";
  const testResponse = await sendMessage("settings/test", {
    apiKey
  });

  if (!testResponse.ok) {
    apiKeyStatus.textContent = `Connection failed: ${testResponse.error}`;
    internalNote.textContent = "Check your key and endpoint in settings, then retry.";
    setGateBusy(false);
    return;
  }

  apiKeyStatus.textContent = "Connection succeeded. Continuing setup...";
  await unlockOnboarding();
  setGateBusy(false);
}

function setGateBusy(isBusy) {
  if (validateApiKeyButton) {
    validateApiKeyButton.disabled = isBusy;
  }
  if (onboardingApiKeyInput) {
    onboardingApiKeyInput.disabled = isBusy;
  }
  if (openOptionsButton) {
    openOptionsButton.disabled = isBusy;
  }
}

async function unlockOnboarding() {
  if (onboardingUnlocked) {
    return;
  }

  onboardingUnlocked = true;
  apiKeyGate?.classList.add("roastii-hidden");
  questionForm?.classList.remove("roastii-hidden");
  internalNote.textContent = "API key verified. I can now build your profile!";
  await loadNextQuestion();
}

async function loadNextQuestion() {
  if (!onboardingUnlocked) {
    return;
  }

  await updateProgressLabel();
  const response = await sendMessage("onboarding/next");
  if (!response.ok) {
    internalNote.textContent = `Roastii lost the script: ${response.error}`;
    return;
  }

  const result = response.result;
  if (result.done) {
    currentQuestion = null;
    internalNote.textContent = "I'm just checking everything over...";
    const summaryResponse = await sendMessage("onboarding/final-roast");
    const summary = summaryResponse.ok ? summaryResponse.result : null;
    await sendMessage("onboarding/complete");
    questionTitle.textContent = summary?.headline || "That's enough data for tasteful judgement.";
    questionOptions.innerHTML = "";
    customAnswerWrap.classList.add("roastii-hidden");
    followUpWrap.classList.add("roastii-hidden");
    questionForm.innerHTML = `
      <div class="roastii-panel roastii-stack">
        <p class="roastii-label">Final Roast</p>
        <p class="roastii-copy">${summary?.roast || "Okay great! Everything's ready. I'll pop up to intervene if you start making bad purchasing decisions on Amazon.ca"}</p>
      </div>
      <div class="roastii-grid two">
        <div class="roastii-panel roastii-stack">
          <p class="roastii-label">Your impulsive weaknesses:</p>
          <p class="roastii-copy">${summary?.walletWeakness || "I now has enough context to spot your favorite rationalizations."}</p>
        </div>
        <div class="roastii-panel roastii-stack">
          <p class="roastii-label">Your recommended cool-down rule:</p>
          <p class="roastii-copy">${summary?.cooldownRule || "When a purchase starts sounding suspiciously justified, pause for 24 hours."}</p>
        </div>
      </div>
      <div class="roastii-actions">
        <button class="roastii-button primary" type="button" id="finish-button">Open Settings</button>
      </div>
    `;
    document.querySelector("#finish-button")?.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
    progressCount.textContent = `${ONBOARDING_QUESTION_LIMIT}/${ONBOARDING_QUESTION_LIMIT}`;
    internalNote.textContent = "Profile complete. I'm ready for interventions.";
    return;
  }

  currentQuestion = result.question;
  renderQuestion(result.question);
}

function renderQuestion(question) {
  if (!questionTitle || !questionOptions || !customAnswerWrap || !followUpWrap || !customAnswerInput || !followUpInput || !followUpLabel) {
    return;
  }

  questionTitle.textContent = question.title;
  const answerType = question.type === "multi" ? "checkbox" : "radio";

  questionOptions.innerHTML = question.options.map((option, index) => `
    <label class="roastii-choice">
      <input type="${answerType}" name="answer" value="${option}" data-index="${index}">
      <span>${option}</span>
    </label>
  `).join("");

  customAnswerWrap.classList.add("roastii-hidden");
  followUpWrap.classList.add("roastii-hidden");
  customAnswerInput.value = "";
  followUpInput.value = "";

  questionOptions.querySelectorAll('input[name="answer"]').forEach((input) => {
    input.addEventListener("change", () => {
      const usesCustomAnswer = input.value === "Type your own answer here" || input.value === "Type your own answer(s) here";
      customAnswerWrap.classList.toggle("roastii-hidden", !usesCustomAnswer);

      const needsFollowUp = question.followUp && input.value === question.followUp.match;
      followUpWrap.classList.toggle("roastii-hidden", !needsFollowUp);
      followUpLabel.textContent = question.followUp?.label || "Follow-up";
    });
  });

}

async function updateProgressLabel() {
  const response = await sendMessage("storage/get");
  if (response.ok) {
    progressCount.textContent = `${response.data.questions.length}/${ONBOARDING_QUESTION_LIMIT}`;
  }
}

function collectAnswer(question) {
  if (!customAnswerInput || !followUpInput) {
    return "";
  }

  const checked = Array.from(document.querySelectorAll('input[name="answer"]:checked'));
  if (!checked.length) {
    return "";
  }

  const selectedValues = checked.map((input) => input.value);
  const usesCustom = selectedValues.includes("Type your own answer here") || selectedValues.includes("Type your own answer(s) here");
  const customValue = customAnswerInput.value.trim();
  const followUpValue = followUpInput.value.trim();

  const answers = selectedValues
    .filter((value) => !value.startsWith("Type your own answer"))
    .concat(usesCustom && customValue ? [customValue] : []);

  if (question.followUp && selectedValues.includes(question.followUp.match) && followUpValue) {
    answers.push(`Goal: ${followUpValue}`);
  }

  return question.type === "multi" ? answers.join("; ") : answers[0] || customValue;
}
