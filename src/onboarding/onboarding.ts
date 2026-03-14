import { ONBOARDING_QUESTION_LIMIT } from "../lib/constants.ts";
import { sendMessage } from "../lib/runtime.ts";

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

void loadNextQuestion();

questionForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentQuestion) {
    return;
  }

  const answer = collectAnswer(currentQuestion);
  if (!answer) {
    internalNote.textContent = "Roastii needs an answer before she can sharpen the next one.";
    return;
  }

  internalNote.textContent = "Roastii is storing your answer...";
  const response = await sendMessage("onboarding/answer", {
    question: currentQuestion,
    answer
  });

  if (!response.ok) {
    internalNote.textContent = `That answer bounced: ${response.error}`;
    return;
  }

  // Don't show LLM notes yet, just confirm the answer was stored
  internalNote.textContent = "Answer stored. Moving to next question...";
  await loadNextQuestion();
});

async function loadNextQuestion() {
  const response = await sendMessage("onboarding/next");
  if (!response.ok) {
    internalNote.textContent = `Roastii lost the script: ${response.error}`;
    return;
  }

  const result = response.result;
  if (result.done) {
    const completeResponse = await sendMessage("onboarding/complete");
    questionTitle.textContent = "That's enough data for tasteful judgement.";
    questionOptions.innerHTML = "";
    customAnswerWrap.classList.add("roastii-hidden");
    followUpWrap.classList.add("roastii-hidden");
    
    // Show all LLM notes
    let notesHtml = '<div class="roastii-panel">';
    if (completeResponse.questions && completeResponse.questions.length > 0) {
      notesHtml += '<h3>Roastii\'s Notes:</h3>';
      completeResponse.questions.forEach((q, index) => {
        if (q.llmNotesOnAnswer) {
          notesHtml += `<p><strong>Q${index + 1}:</strong> ${q.llmNotesOnAnswer}</p>`;
        }
      });
    }
    notesHtml += '</div>';
    
    questionForm.innerHTML = `
      ${notesHtml}
      <div class="roastii-panel">
        <p class="roastii-copy">Roastii is ready. Open the extension popup on Amazon.ca and let the interventions begin.</p>
      </div>
      <div class="roastii-actions">
        <button class="roastii-button primary" type="button" id="finish-button">Open Settings</button>
      </div>
    `;
    document.querySelector("#finish-button")?.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });
    progressCount.textContent = `${ONBOARDING_QUESTION_LIMIT}/${ONBOARDING_QUESTION_LIMIT}`;
    return;
  }

  currentQuestion = result.question;
  renderQuestion(result.question);
}

function renderQuestion(question) {
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

  progressCount.textContent = `${Math.min(document.querySelectorAll(".roastii-choice input").length ? document.querySelectorAll(".roastii-choice input:checked").length : 0, ONBOARDING_QUESTION_LIMIT)}/${ONBOARDING_QUESTION_LIMIT}`;
  updateProgressLabel();
}

function updateProgressLabel() {
  sendMessage("storage/get").then((response) => {
    if (response.ok) {
      progressCount.textContent = `${response.data.questions.length}/${ONBOARDING_QUESTION_LIMIT}`;
    }
  });
}

function collectAnswer(question) {
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
