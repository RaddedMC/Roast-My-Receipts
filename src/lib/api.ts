import { ONBOARDING_QUESTIONS, ONBOARDING_SYSTEM_PROMPT, ROAST_SYSTEM_PROMPT } from "./constants.ts";

function normalizeEndpoint(apiEndpoint = "") {
  return apiEndpoint.trim().replace(/\/+$/, "");
}

function buildHeaders(settings, authMode = "bearer") {
  const headers = {
    "Content-Type": "application/json"
  };

  if (settings.apiKey) {
    if (authMode === "x-api-key") {
      headers["x-api-key"] = settings.apiKey;
    } else {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }
  }

  return headers;
}

async function readResponseErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    if (!payload) {
      return "";
    }

    return payload.error?.message || payload.message || JSON.stringify(payload);
  }

  return (await response.text().catch(() => "")).trim();
}

async function fetchWithAuthFallback(settings, url, init = {}) {
  const baseInit = {
    ...init,
    headers: {
      ...buildHeaders(settings, "bearer"),
      ...(init.headers || {})
    }
  };

  let response = await fetch(url, baseInit);

  if (response.status === 403 && settings.apiKey) {
    const retryInit = {
      ...init,
      headers: {
        ...buildHeaders(settings, "x-api-key"),
        ...(init.headers || {})
      }
    };
    response = await fetch(url, retryInit);
  }

  return response;
}

function parseJsonFromText(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    const startIndex = text.indexOf("{");
    const endIndex = text.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return null;
    }

    const candidate = text.slice(startIndex, endIndex + 1);
    try {
      return JSON.parse(candidate);
    } catch (_nestedError) {
      return null;
    }
  }
}

async function createChatCompletion(settings, messages, schemaName) {
  const endpoint = normalizeEndpoint(settings.apiEndpoint);
  const requestBodies = [
    {
      model: settings.model,
      stream: false,
      response_format: { type: "json_object" },
      messages
    },
    {
      model: settings.model,
      stream: false,
      messages
    }
  ];

  let lastError = "";

  for (const requestBody of requestBodies) {
    const response = await fetchWithAuthFallback(settings, `${endpoint}/api/generate`, {
      method: "POST",
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorDetails = await readResponseErrorMessage(response);
      lastError = `status ${response.status}${errorDetails ? `: ${errorDetails}` : ""}`;
      continue;
    }

    const payload = await response.json().catch(() => null);
    const content = payload?.choices?.[0]?.message?.content;

    if (!content) {
      lastError = `No content returned for ${schemaName}`;
      continue;
    }

    if (typeof content === "object" && content !== null) {
      return content;
    }

    const parsed = parseJsonFromText(content);
    if (parsed) {
      return parsed;
    }

    lastError = `Could not parse JSON content for ${schemaName}`;
  }

  throw new Error(`API request failed${lastError ? ` (${lastError})` : ""}`);
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
  const endpoint = normalizeEndpoint(settings.apiEndpoint);
  const response = await fetchWithAuthFallback(settings, `${endpoint}/models`);

  if (!response.ok) {
    const errorDetails = await readResponseErrorMessage(response);
    throw new Error(`Connection test failed with status ${response.status}${errorDetails ? `: ${errorDetails}` : ""}`);
  }

  await createChatCompletion(
    settings,
    [
      { role: "system", content: "Return JSON only with a single key named ok set to true." },
      { role: "user", content: "Ping" }
    ],
    "testConnection"
  );

  return response.json();
}
