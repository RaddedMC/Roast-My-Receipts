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
  model: "openai/gpt-oss-20b",
  enabled: true,
  autoRoastOnAddToCart: true,
  roastIntensity: "high"
};

export const DEFAULT_STATS = {
  savedCount: 0,
  moneySaved: 0,
  roastedToday: 0
};

export const ONBOARDING_QUESTION_LIMIT = 8;

export const ONBOARDING_QUESTIONS = [
  {
    id: "fun_money",
    title: "After rent, bills, and keeping yourself alive — how much 'fun' money (CAD) are you working with each month?",
    type: "single",
    options: [
      "Under $300 — every dollar has a job",
      "$300–$800 — comfortable but not careless",
      "$800–$1,500 — I can treat myself sometimes",
      "$1,500+ — I am Sam Altman and I don't GAF!",
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
      label: "What's the goal?"
    }
  },
  {
    id: "spend_report",
    title: "If your bank sent you a monthly 'non-essential spending' report, what number would make you feel okay vs. ashamed?",
    type: "single",
    options: [
      "Under $100 — I want to be very strict about this",
      "$100–$300 — reasonable treats only",
      "$300–$800 — I work hard, I deserve things",
      "$800+ — just roast me and let me cope",
      "Type your own answer here"
    ]
  },
  {
    id: "pause_price",
    title: "What price tag makes you nervous, or stop and think, before clicking 'Buy Now'?",
    type: "single",
    options: [
      "$30 — I agonize over everything",
      "$60 — small stuff is fine, but I think twice past this",
      "$100 — this is where it starts to feel real",
      "$200+ — anything under that is basically free to me",
      "Type your own answer here"
    ]
  },
  {
    id: "weak_categories",
    title: "Which of these categories are you most likely to impulse-buy? Select all that apply.",
    type: "multi",
    options: [
      "🔌 Tech & gadgets — 'But it has a feature my current one doesn't!!'",
      "👗 Fashion & beauty — 'It's not shopping, it's self-expression.'",
      "🏠 Home & kitchen — 'This $40 avocado slicer will change everything!'",
      "🍿 Snacks & groceries — 'I'm just stocking up' (you're not)",
      "📚 Books, courses & subscriptions — 'it's an investment in myself'",
      "🏋️ Fitness & outdoors — 'I'm finally going to become that person!'",
      "🎮 Games & entertainment — 'I deserve to relax.'",
      "🎁 Gifts & stuff for others — 'If it's not for me it doesn't count!'",
      "Type your own answer(s) here"
    ]
  },
  {
    id: "post_purchase_feelings",
    title: "You just impulse-bought something. It's been 10 minutes. How are we feeling?",
    type: "single",
    options: [
      "Amazing. No regrets. Born to shop!",
      "A brief high followed by a slow creeping guilt",
      "A little nervous -- Already checking the return policy",
      "I'm too scared so I've closed the confirmation email so I don't have to look at it",
      "Type your own answer here"
    ]
  },
  {
    id: "haunting_purchase",
    title: "Think about a purchase that STILL haunts you. What went wrong?",
    type: "single",
    options: [
      "Never used it — it's a $120 shelf decoration now",
      "Found a cheaper or better value one literally the next day",
      "It was garbage quality — betrayed by the 4.5-star rating",
      "Nothing was wrong with it. I just didn't need it and I knew that when I bought it.",
      "Type your own answer here"
    ]
  },
  {
    id: "self_description",
    title: "Last one. Describe yourself in 1-2 sentences I Roastii knows who I'm dealing with. Be honest — I will find out!",
    type: "single",
    options: [
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
- If the user sounds upset, reduce intensity immediately and be supportive.

Task:
- Compute a regretScore from 0 to 10, where 0 means very low regret risk and 10 means very high regret risk.
- Base the score on the user's profile, price sensitivity, weak categories, past regret patterns, and the current item.
- Write a short roast in Roastii's voice.
- Return JSON only with keys regretScore, roast, reasoning.

Below is Definition of each regretScore:
- **0**: This is the best purchase you've ever made in your life! You can’t live without it and you would die instantly if anyone tries to take it from you.
- **1**: An excellent buy that you use constantly and brings genuine value.
- **2**: A solid purchase that serves its purpose well!
- **3**: A decent buy, mostly satisfied with it, but it has a few problems.
- **4**: It's okay, but you could have done without it.
- **5**: Neutral - not terrible, not great. It just exists in your life.
- **6**: Starting to question why you bought this?!
- **7**: Rarely use it, rarely look at it. Probably should get rid of it.
- **8**: Sitting in a drawer/closet somewhere collecting dust.
- **9**: You would’ve returned it, but you procrastinated until just before the return deadline and now you’re stuck with it.
- **10**: It's going to the thrift store in the next five seconds you hate it so much! Get it out of here!!!!`;


