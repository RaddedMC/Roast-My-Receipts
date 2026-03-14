import { ONBOARDING_QUESTIONS, ONBOARDING_SYSTEM_PROMPT, ROAST_SYSTEM_PROMPT } from "./constants.ts";

function buildHeaders(settings) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }

  return headers;
}

async function createChatCompletion(settings, messages, schemaName) {
  const response = await fetch(`${settings.apiEndpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: buildHeaders(settings),
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      response_format: { type: "json_object" },
      messages
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`No content returned for ${schemaName}`);
  }

  return JSON.parse(content);
}

function buildFallbackNote(answer) {
  const lowered = answer.toLowerCase();
  const trigger = /(sale|deal|discount|impulse|bored|stress|late night)/.test(lowered)
    ? "Likely vulnerable to impulse or mood-based shopping."
    : "Answer suggests a stable pattern worth remembering.";
  return `${trigger} Store this as a personalization signal for future roasts.`;
}

export async function analyzeAnswer(settings, question, answer) {
  try {
    return await createChatCompletion(
      settings,
      [
        { role: "system", content: `${ONBOARDING_SYSTEM_PROMPT}\nReturn JSON only with a single key named llmNotesOnAnswer.` },
        {
          role: "user",
          content: JSON.stringify({
            questionTitle: question.title,
            answer
          })
        }
      ],
      "analyzeAnswer"
    );
  } catch (_error) {
    console.log(_error);
    return {
      llmNotesOnAnswer: buildFallbackNote(answer)
    };
  }
}

export async function generateOnboardingQuestion(_settings, conversationHistory) {
  const nextQuestion = ONBOARDING_QUESTIONS[conversationHistory.length];
  if (!nextQuestion) {
    return {
      done: true
    };
  }
  return {
    done: false,
    question: nextQuestion
  };
}

function fallbackRoast(itemName, itemPrice, questions, items) {
  const weakCategories = questions.find((question) => question.questionId === "weak_categories");
  const repeatPurchase = items.find((item) => item.itemName.toLowerCase() === itemName.toLowerCase());
  let regretScore = itemPrice >= 150 ? 8 : itemPrice >= 75 ? 6 : 4;

  if (weakCategories?.userAnswer?.toLowerCase().includes("tech") && itemName.toLowerCase().match(/monitor|keyboard|headset|ssd|gaming/)) {
    regretScore += 1;
  }

  if (repeatPurchase) {
    regretScore += 1;
  }

  regretScore = Math.max(0, Math.min(10, regretScore));

  const roast = repeatPurchase
    ? `Roastii spotted a sequel purchase. "${itemName}" is giving same-problem-new-box energy, and ${itemPrice.toFixed(2)} CAD is a spicy price for a rerun.`
    : `${itemName} just strutted in asking for ${itemPrice.toFixed(2)} CAD like your budget won't notice. Roastii recommends a 24-hour cooldown before this becomes tomorrow's character development.`;

  return {
    regretScore,
    roast,
    reasoning: "Fallback heuristic based on price bands, weak categories, and duplicate history."
  };
}

export async function generateRoast(settings, item, userProfile, purchaseHistory) {
  try {
    return await createChatCompletion(
      settings,
      [
        { role: "system", content: `${ROAST_SYSTEM_PROMPT}\nReturn JSON only with keys regretScore, roast, reasoning.` },
        {
          role: "user",
          content: JSON.stringify({
            userQuestionsAndAnswers: userProfile,
            recentPurchases: purchaseHistory.slice(0, 8),
            currentItem: {
              itemName: item.itemName,
              itemPrice: item.itemPrice,
              category: item.category
            }
          })
        }
      ],
      "generateRoast"
    );
  } catch (_error) {
    console.log(_error);
    return fallbackRoast(item.itemName, item.itemPrice, userProfile, purchaseHistory);
  }
}

export async function testConnection(settings) {
  const response = await fetch(`${settings.apiEndpoint.replace(/\/$/, "")}/models`, {
    headers: buildHeaders(settings)
  });

  if (!response.ok) {
    throw new Error(`Connection test failed with status ${response.status}`);
  }

  return response.json();
}
