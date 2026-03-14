import { ONBOARDING_QUESTIONS, ONBOARDING_SYSTEM_PROMPT, ROAST_SYSTEM_PROMPT } from "./constants.js";

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
  const input = messages.map((message) => ({
    role: message.role,
    content: normalizeContent(message.content)
  }));

  const response = await fetch(`${settings.apiEndpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': settings.apiKey ? `Bearer ${settings.apiKey}` : undefined
    },
    body: JSON.stringify({
      model: settings.model,
      messages: input,
      stream: false,
      temperature: 0.7,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content || "";
  
  if (!rawText) {
    throw new Error(`No content returned for ${schemaName}`);
  }

  const jsonText = extractJson(rawText);
  if (!jsonText) {
    throw new Error(`No JSON content found in response for ${schemaName}`);
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

export async function analyzeAnswer(settings, question, answer) {
  try {
    const response = await createStructuredResponse(
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

    return response.parsed;
  } catch (error) {
    console.error('analyzeAnswer error:', error);
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
      "generateRoast"
    );

    return response.parsed;
  } catch (error) {
    console.error('generateRoast error:', error);
    return fallbackRoast(item.itemName, item.itemPrice, userProfile, purchaseHistory);
  }
}

export async function testConnection(settings) {
  try {
    const response = await fetch(`${settings.apiEndpoint}/models`, {
      method: 'GET',
      headers: {
        'Authorization': settings.apiKey ? `Bearer ${settings.apiKey}` : undefined
      }
    });

    if (!response.ok) {
      throw new Error(`Connection test failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return {
      data: data.data?.map((model) => ({
        id: model.id,
        created: model.created
      })) || []
    };
  } catch (error) {
    console.error('testConnection error:', error);
    throw error;
  }
}