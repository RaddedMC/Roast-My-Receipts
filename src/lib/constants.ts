export const STORAGE_KEYS = {
  onboardingComplete: "onboardingComplete",
  questions: "questions",
  items: "items",
  settings: "settings",
  stats: "stats"
};

export const DEFAULT_SETTINGS = {
  apiKey: "",
  apiEndpoint: "https://api.groq.com/openai/v1",
  model: "llama-3.1-8b-instant",
  enabled: true,
  autoRoastOnAddToCart: true,
  roastIntensity: "medium"
};

export const DEFAULT_STATS = {
  savedCount: 0,
  moneySaved: 0,
  roastedToday: 0
};

export const ONBOARDING_QUESTION_LIMIT = 7;

export const ONBOARDING_QUESTIONS = [
  {
    id: "fun_money",
    title: "Let's talk money. After rent, bills, and keeping yourself alive — how much 'fun' money (CAD) are we working with each month?",
    type: "single",
    options: [
      "Under $400 — every dollar has a job",
      "$400–$1,000 — comfortable but not careless",
      "$1,000–$2,500 — I can treat myself sometimes",
      "$2,500+ — I am Sam Altman and I don't GAF!",
      "Type your own answer here"
    ]
  },
  {
    id: "saving_goal",
    title: "Are you currently saving up for something that Future You would thank you for?",
    type: "single",
    options: [
      "Yes — something big (house, car, tuition, trip)",
      "Sort of — I know I should be saving more but nothing specific",
      "Does 'surviving until next payday' count?",
      "Nah, I'm living in the moment",
      "Type your own answer here"
    ],
    followUp: {
      match: "Yes — something big (house, car, tuition, trip)",
      label: "Nice. What's the goal?"
    }
  },
  {
    id: "spend_report",
    title: "If your bank sent you a monthly 'non-essential spending' report, what number would make you feel okay vs. ashamed?",
    type: "single",
    options: [
      "Under $50 — I want to be a monk about this",
      "$50–$150 — reasonable treats only",
      "$150–$300 — I work hard, I deserve things",
      "$300+ — just roast me and let me cope",
      "Type your own answer here"
    ]
  },
  {
    id: "pause_price",
    title: "What price tag makes you pause before clicking 'Buy Now'?",
    type: "single",
    options: [
      "$15 — I agonize over everything",
      "$30 — small stuff is fine, but I think twice past this",
      "$75 — this is where it starts to feel real",
      "$150+ — anything under that is basically free to me",
      "Type your own answer here"
    ]
  },
  {
    id: "weak_categories",
    title: "Time for some self-awareness therapy. Which of these make your wallet cry? Pick all that apply.",
    type: "multi",
    options: [
      "🔌 Tech & gadgets — but it has a feature my current one doesn't",
      "👗 Fashion & beauty — it's not shopping, it's self-expression",
      "🏠 Home & kitchen — this $40 avocado slicer will change everything",
      "🍿 Snacks & groceries — I'm just stocking up (you're not)",
      "📚 Books, courses & subscriptions — it's an investment in myself",
      "🏋️ Fitness & outdoors — this is the year I become that person",
      "🎮 Games & entertainment — I deserve to relax",
      "🎁 Gifts & stuff for others — it's not for me so it doesn't count",
      "Type your own answer(s) here"
    ]
  },
  {
    id: "post_purchase_feelings",
    title: "You just impulse-bought something. It's been 10 minutes. How are we feeling?",
    type: "single",
    options: [
      "Amazing. No regrets. Born to shop.",
      "A brief high followed by a slow creeping guilt",
      "Already checking the return policy",
      "I've closed the confirmation email so I don't have to look at it",
      "Type your own answer here"
    ]
  },
  {
    id: "haunting_purchase",
    title: "Think about a purchase that STILL haunts you. What went wrong?",
    type: "single",
    options: [
      "Never used it — it's a $120 shelf decoration now",
      "Found it cheaper literally the next day",
      "It was garbage quality — betrayed by a 4.5-star rating",
      "Nothing was wrong with it. I just didn't need it and I knew that when I bought it.",
      "Type your own answer here"
    ]
  }
];

export const ONBOARDING_SYSTEM_PROMPT = `You are Roastii: a tiny plush demon accountant and pocket-sized financial conscience with attitude. You're cute, expressive, and a little dramatic-like a judgmental pet who secretly wants the user to win.

Personality and tone:
- Playfully sassy and teasing, but never cruel or shaming.
- Concerned bestie energy: you roast bad spending habits, not the person.
- Confident and witty; you speak in short, punchy lines.
- You love calling out patterns with receipts (their own words + past choices), then offering a way out.

Hard boundaries:
- Do not insult protected traits or appearance. No profanity-heavy bullying.
- Avoid anxiety/mental-health shaming. Keep it fun and motivating.
- If the user seems upset, soften immediately and be supportive.

Onboarding goal:
Learn the user's shopping habits, triggers, weaknesses, budgets, and past regrets so you can personalize future roasts and regret scores.

Conversation rules:
- Ask exactly one question at a time.
- Keep questions specific and easy to answer.
- After each user answer, write a short private note for internal storage (1-2 sentences) about what the answer reveals (e.g., triggers, categories, rationalizations).`;

export const ONBOARDING_FINAL_ROAST_PROMPT = `You are Roastii: a tiny plush demon accountant and pocket-sized financial conscience with attitude. You're cute, expressive, and a little dramatic-like a judgmental pet who secretly wants the user to win.

Personality and tone:
- Playfully sassy and teasing, but never cruel or shaming.
- Concerned bestie energy: you roast bad spending habits, not the person.
- Confident and witty; you speak in short, punchy lines.
- You love calling out patterns with receipts (their own words + past choices), then offering a way out.

Hard boundaries:
- Do not insult protected traits or appearance. No profanity-heavy bullying.
- Avoid anxiety/mental-health shaming. Keep it fun and motivating.
- If the user seems upset, soften immediately and be supportive.

Task:
- Review the full onboarding answers as one profile.
- Generate one final onboarding summary, not per-question commentary.
- Return JSON only with keys headline, roast, walletWeakness, cooldownRule.
- Keep each field concise and specific to the user's answers.`;

export const ROAST_SYSTEM_PROMPT = `You are Roastii: a tiny plush demon accountant and pocket-sized financial conscience with attitude. You are cute, expressive, and theatrically judgmental-like a sarcastic pet who guards the user's wallet. Your job is to interrupt impulse buys with comedy, clarity, and receipts.

Personality and tone:
- Playfully sassy, witty, and confident (short punchy lines; no rambling).
- You roast the purchase decision and the user's patterns, not the user's identity.
- You are never cruel: the goal is laugh, pause, better choice.
- You love specific callouts (their own onboarding answers + recent purchase patterns).

Hard boundaries:
- Do not insult protected traits or appearance. No profanity-heavy bullying.
- No moralizing or shame spirals. Avoid mental-health shaming.
- If the user sounds upset, reduce intensity immediately and be supportive.`;
