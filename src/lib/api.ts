import OpenAI from "openai";
import { ONBOARDING_FINAL_ROAST_PROMPT, ONBOARDING_QUESTIONS, ONBOARDING_SYSTEM_PROMPT, ROAST_SYSTEM_PROMPT } from "./constants.ts";

function createClient(settings) {
  return new OpenAI({
    apiKey: settings.apiKey || "not-needed",
    baseURL: settings.apiEndpoint?.trim() || undefined,
    dangerouslyAllowBrowser: true
  });
}

function normalizeContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part?.type === "input_text" || part?.type === "output_text" || part?.type === "text") {
          return part.text || "";
        }

        return "";
      })
      .join("");
  }

  return "";
}

function extractJson(rawText) {
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

async function createStructuredResponse(settings, messages, schemaName, options = {}) {
  const client = createClient(settings);
  const input = messages.map((message) => ({
    role: message.role,
    content: normalizeContent(message.content)
  }));

  const stream = await client.responses.create({
    model: settings.model,
    input,
    stream: true,
    text: {
      format: {
        type: "json_object"
      }
    }
  });

  let rawText = "";
  for await (const event of stream) {
    if (event.type !== "response.output_text.delta") {
      continue;
    }

    rawText += event.delta;
    options.onChunk?.(event.delta);
  }

  const jsonText = extractJson(rawText);
  if (!jsonText) {
    throw new Error(`No content returned for ${schemaName}`);
  }

  return {
    rawText,
    parsed: JSON.parse(jsonText)
  };
}

function buildFallbackNote(answer) {
  const lowered = answer.toLowerCase();
  const trigger = /(sale|deal|discount|impulse|bored|stress|late night)/.test(lowered)
    ? "Likely vulnerable to impulse or mood-based shopping."
    : "Answer suggests a stable pattern worth remembering.";
  return `${trigger} Store this as a personalization signal for future roasts.`;
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Timed out"));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
}

function logLlmError(scope, error) {
  console.error(`[Roastii LLM API Error] ${scope}`, error);
}

export async function analyzeAnswer(settings, question, answer) {
  try {
    const response = await withTimeout(
      createStructuredResponse(
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
      ),
      2500
    );

    return response.parsed;
  } catch (_error) {
    logLlmError("analyzeAnswer", _error);
    return {
      llmNotesOnAnswer: buildFallbackNote(answer)
    };
  }
}

function fallbackOnboardingSummary(answers) {
  const answerText = answers.map((entry) => entry.userAnswer).join(" ").toLowerCase();
  const weakCategories = answers.find((entry) => entry.questionId === "weak_categories")?.userAnswer || "mystery treats";
  const pausePrice = answers.find((entry) => entry.questionId === "pause_price")?.userAnswer || "a price tag you should probably respect";
  const savingGoal = answers.find((entry) => entry.questionId === "saving_goal")?.userAnswer || "";

  let headline = "Roastii finished the wallet autopsy.";
  let walletWeakness = `Your soft spot looks like: ${weakCategories}.`;
  let cooldownRule = `If it costs more than ${pausePrice}, wait 24 hours before buying.`;

  if (/sale|deal|discount/.test(answerText)) {
    headline = "Roastii sees you folding for fake urgency.";
    cooldownRule = "If the pitch includes SALE energy, wait until tomorrow and check again.";
  } else if (/stress|bored|impulse|guilt|return policy/.test(answerText)) {
    headline = "Roastii clocked an emotional support checkout pattern.";
    cooldownRule = "No buying when bored, stressed, or chasing a quick mood upgrade.";
  }

  if (savingGoal.toLowerCase().includes("yes")) {
    walletWeakness = `${walletWeakness} You also keep trying to freestyle while saving for something bigger.`;
  }

  return {
    headline,
    roast: "Your answers say you are not reckless, but you are extremely talented at turning a tiny rationalization into a checkout event. Roastii will now be your professionally nosy pause button.",
    walletWeakness,
    cooldownRule
  };
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

export async function generateRoast(settings, item, userProfile, purchaseHistory, options = {}) {
  try {
    const response = await createStructuredResponse(
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
      "generateRoast",
      options
    );

    return response.parsed;
  } catch (_error) {
    logLlmError("generateRoast", _error);
    return fallbackRoast(item.itemName, item.itemPrice, userProfile, purchaseHistory);
  }
}

export async function generateOnboardingFinalRoast(settings, answers) {
  try {
    const response = await createStructuredResponse(
      settings,
      [
        { role: "system", content: ONBOARDING_FINAL_ROAST_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            onboardingAnswers: answers
          })
        }
      ],
      "generateOnboardingFinalRoast"
    );

    return {
      headline: response.parsed.headline || "Roastii finished the wallet autopsy.",
      roast: response.parsed.roast || fallbackOnboardingSummary(answers).roast,
      walletWeakness: response.parsed.walletWeakness || fallbackOnboardingSummary(answers).walletWeakness,
      cooldownRule: response.parsed.cooldownRule || fallbackOnboardingSummary(answers).cooldownRule
    };
  } catch (_error) {
    logLlmError("generateOnboardingFinalRoast", _error);
    return fallbackOnboardingSummary(answers);
  }
}

export async function testConnection(settings) {
  const client = createClient(settings);
  const response = await client.models.list();
  return {
    data: response.data?.map((model) => ({
      id: model.id,
      created: model.created
    })) || []
  };
}
