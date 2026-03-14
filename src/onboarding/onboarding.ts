import { ONBOARDING_QUESTION_LIMIT } from "../lib/constants.ts";
import { sendMessage } from "../lib/runtime.ts";

const apiKeyGate = document.querySelector("#api-key-gate");
const onboardingApiKeyInput = document.querySelector("#onboarding-api-key");
const validateApiKeyButton = document.querySelector("#validate-api-key");
const openOptionsButton = document.querySelector("#open-options");
const apiKeyStatus = document.querySelector("#api-key-status");
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
    internalNote.textContent = "Roastii needs an answer before she can sharpen the next one.";
    return;
  }

  internalNote.textContent = "Answer saved. Roastii is building your profile.";
  const response = await sendMessage("onboarding/answer", {
    question: currentQuestion,
    answer
  });

  if (!response.ok) {
    internalNote.textContent = `That answer bounced: ${response.error}`;
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
    internalNote.textContent = "Roastii cannot start onboarding until settings load.";
    return;
  }

  const existingApiKey = response.data.settings.apiKey?.trim() || "";
  if (onboardingApiKeyInput) {
    onboardingApiKeyInput.value = existingApiKey;
  }

  if (!existingApiKey) {
    apiKeyStatus.textContent = "Enter your API key, then validate to start onboarding.";
    internalNote.textContent = "Roastii needs your API key before she starts profiling your spending patterns.";
    return;
  }

  setGateBusy(true);
  apiKeyStatus.textContent = "Saved API key found. Validating connection...";
  const testResponse = await sendMessage("settings/test", {
    apiKey: existingApiKey
  });

  if (!testResponse.ok) {
    apiKeyStatus.textContent = `Saved key failed validation: ${testResponse.error}`;
    internalNote.textContent = "Update the key and validate again to begin onboarding.";
    setGateBusy(false);
    return;
  }

  apiKeyStatus.textContent = "Saved key validated. Starting onboarding...";
  await unlockOnboarding();
  setGateBusy(false);
}

async function validateAndStartOnboarding() {
  const apiKey = onboardingApiKeyInput?.value.trim() || "";
  if (!apiKey) {
    apiKeyStatus.textContent = "API key is required before onboarding can start.";
    internalNote.textContent = "Paste your API key to unlock the onboarding flow.";
    return;
  }

  setGateBusy(true);
  apiKeyStatus.textContent = "Saving API key...";
  const saveResponse = await sendMessage("settings/update", {
    apiKey
  });

  if (!saveResponse.ok) {
    apiKeyStatus.textContent = `Could not save API key: ${saveResponse.error}`;
    internalNote.textContent = "Roastii could not store your key. Try again or open settings.";
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

  apiKeyStatus.textContent = "Connection succeeded. Unlocking onboarding...";
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
  internalNote.textContent = "API key verified. Roastii can now build your profile.";
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
    internalNote.textContent = "Roastii is stitching together your final read...";
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
        <p class="roastii-copy">${summary?.roast || "Roastii is ready. Open the extension popup on Amazon.ca and let the interventions begin."}</p>
      </div>
      <div class="roastii-grid two">
        <div class="roastii-panel roastii-stack">
          <p class="roastii-label">Wallet Weakness</p>
          <p class="roastii-copy">${summary?.walletWeakness || "Roastii now has enough context to spot your favorite rationalizations."}</p>
        </div>
        <div class="roastii-panel roastii-stack">
          <p class="roastii-label">Cooldown Rule</p>
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
    internalNote.textContent = "Profile complete. Roastii is ready for live interventions.";
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
