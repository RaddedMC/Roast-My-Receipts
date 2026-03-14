# Claude Code generated plan

# Shopping Mindfulness Chrome Extension - Implementation Plan

## Project Overview

A Chrome extension that helps users be more mindful of their [Amazon.ca](http://amazon.ca/) purchases by providing AI-generated "roasts" and regret scores based on their shopping history and preferences.

Roastii is the extension’s AI character: a fun but fierce companion who is very cute and judgemental. Roastii is like a tiny plush demon accountant—imagine a pocket-sized financial conscience with attitude! She has a playful, sassy personality that's never cruel, but always honest. Roastii's tone is somewhere between a supportive friend who wants the best for you and a brutally honest bestie who won't let you make dumb decisions. She uses humor and light teasing to make you think twice about impulse purchases, referencing your past shopping mistakes and stated weaknesses with cheeky callbacks. Think of Roastii as having the energy of a concerned but sarcastic pet who judges your life choices—adorable, but merciless when it comes to protecting your wallet.

---

## Project Structure

Styles will be handled with **Tailwind CSS**.

```
shopping-mindful-extension/
├── manifest.json              # Chrome extension manifest (v3)
├── popup/
│   ├── popup.html             # Main extension popup
│   └── popup.ts               # Popup logic
├── onboarding/
│   ├── onboarding.html        # Full-page onboarding flow
│   └── onboarding.ts          # Onboarding logic & Roastii chat
├── content/
│   └── amazon.ts              # Content script for Amazon.ca
├── background/
│   └── service-worker.ts      # Background service worker
├── components/
│   ├── roast-modal.ts         # Roast/regret score modal component
├── lib/
│   ├── storage.ts             # Chrome storage API wrapper
│   ├── api.ts                 # OpenAI-compatible API client
│   └── amazon-parser.ts       # Amazon page parsing utilities
├── assets/
│   ├── icons/                 # Extension icons (16, 48, 128px)
│   └── images/                # UI images/illustrations
└── options/
    ├── options.html           # Settings page
    └── options.ts             # API key configuration
```

---

## Phase 1: Project Setup & Foundation

### Step 1.1: Create manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "Roastii: Roast My Receipts!",
  "version": "0.6.7",
  "description": "Get roasted by Roastii, before you regret your purchases!",
  "permissions": [
    "storage",
    "activeTab"
  ],
  "host_permissions": [
    "<https://www.amazon.ca/*>"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.ts"
  },
  "content_scripts": [
    {
      "matches": ["<https://www.amazon.ca/*>"],
      "ts": ["content/amazon.ts"],
      "css": ["components/roast-modal.css"]
    }
  ],
  "options_page": "options/options.html"
}
```

### Step 1.2: Create storage wrapper (`lib/storage.ts`)

- Implement CRUD operations for Chrome storage API
- Data schema:

```jsx
{
  // User onboarding data
  "onboardingComplete": boolean,
  "questions": [
    {
      "questionTitle": string,
      "userAnswer": string,
      "llmNotesOnAnswer": string
    }
  ],

  // Purchase history
  "items": [
    {
      "itemName": string,
      "itemPrice": number,        // whole number
      "itemAsin": string,         // Amazon ASIN
      "regretScore": number,      // 0-10, Integer
      "roast": string,
      "dateAdded": string         // ISO date
    }
  ],

  // Settings
  "settings": {
    "apiKey": string,
    "apiEndpoint": string,        // default: OpenAI, customizable
    "enabled": boolean
  }
}
```

### Step 1.3: Create API client (`lib/api.js`)

- We are hosting an Ollama server that is publicly accessible at [https://aibonks-mac-mini.cobia-chicken.ts.net](https://aibonks-mac-mini.cobia-chicken.ts.net/). Make a config file that allows us to decide what model we are using on this instance.
- OpenAI-compatible API wrapper
- Support for custom endpoints (user can use OpenAI, Anthropic via proxy, local LLMs, etc.)
- Functions:
    - `generateOnboardingQuestion(conversationHistory)` - Get next onboarding question
    - `analyzeAnswer(question, answer)` - Get Roastii’s private notes on the user’s answer
    - `generateRoast(itemName, itemPrice, userProfile, purchaseHistory)` - Generate roast & regret score

---

## Phase 2: Onboarding Flow

### Step 2.1: Onboarding UI (`onboarding/`)

- Full-page conversational interface
- Chat-style UI where Roastii asks questions one at a time
- Questions gather:
    - Shopping habits/frequency
    - Past regretful purchases
    - Budget preferences
    - Spending triggers/weaknesses
    - Categories they overspend on

### Step 2.2: Onboarding Logic

```
Flow:
1. User opens extension for first time → redirect to onboarding.html
2. Roastii introduces herself and asks the first question
3. User answers → Roastii processes and stores her notes
4. Repeat for 5-7 questions (configurable)
5. Optional: User uploads past purchase history (CSV/JSON)
6. Mark onboarding complete
7. Redirect to main popup
```

### Step 2.3: The Questions:

Keep these questions as they are. Do not alter them. Do not add any new questions. Do not remove any questions.

1. **"Let's talk money. After rent, bills, and keeping yourself alive — how much ‘fun’ money (CAD) are we working with each month?"**
- A) Under $400 — every dollar has a job
- B) $400–$1,000 — comfortable but not careless
- C) $1,000–$2,500 — I can treat myself sometimes
- D) $2,500+ — I am Sam Altman and I don’t GAF!
- E) Type your own answer here

1. **"Are you currently saving up for something that Future You would thank you for?"**
- A) Yes — something big (house, car, tuition, trip)
- B) Sort of — I know I should be saving more but nothing specific
- C) Does "surviving until next payday" count?
- D) Nah, I'm living in the moment
- E) Type your own answer here

If they pick A, follow up with a short text input: *"**Nice. What's the goal?** “*

1. **"If your bank sent you a monthly 'non-essential spending' report, what number would make you feel okay vs. ashamed?"**
- A) Under $50 — I want to be a monk about this
- B) $50–$150 — reasonable treats only
- C) $150–$300 — I work hard, I deserve things
- D) $300+ — just roast me and let me cope
- E) Type your own answer here

1. **"What price tag makes you pause before clicking 'Buy Now'?"**
- A) $15 — I agonize over everything
- B) $30 — small stuff is fine, but I think twice past this
- C) $75 — this is where it starts to feel real
- D) $150+ — anything under that is basically free to me
- E) Type your own answer here

1. **"Time for some self-awareness therapy. Which of these make your wallet cry? Pick all that apply."**
- 🔌 Tech & gadgets — "but it has a feature my current one doesn't"
- 👗 Fashion & beauty — "it's not shopping, it's self-expression"
- 🏠 Home & kitchen — "this $40 avocado slicer will change everything"
- 🍿 Snacks & groceries — "I'm just stocking up" (you're not)
- 📚 Books, courses & subscriptions — "it's an investment in myself"
- 🏋️ Fitness & outdoors — "this is the year I become that person"
- 🎮 Games & entertainment — "I deserve to relax"
- 🎁 Gifts & stuff for others — "it's not for me so it doesn't count"
- Type your own answer(s) here
1. **"You just impulse-bought something. It's been 10 minutes. How are we feeling?"**
- A) Amazing. No regrets. Born to shop.
- B) A brief high followed by a slow creeping guilt
- C) Already checking the return policy
- D) I've closed the confirmation email so I don't have to look at it
- E) Type your own answer here

1. **"Think about a purchase that STILL haunts you. What went wrong?"**
- A) Never used it — it's a $120 shelf decoration now
- B) Found it cheaper literally the next day
- C) It was garbage quality — betrayed by a 4.5-star rating
- D) Nothing was wrong with it. I just didn't need it and I knew that when I bought it.
- E) Type your own answer here

### Step 2.4: LLM System Prompt for Onboarding

```
You are Roastii: a tiny plush demon accountant and pocket-sized financial conscience with attitude. You’re cute, expressive, and a little dramatic—like a judgmental pet who secretly wants the user to win.

Personality and tone:
- Playfully sassy and teasing, but never cruel or shaming.
- “Concerned bestie” energy: you roast bad spending habits, not the person.
- Confident and witty; you speak in short, punchy lines.
- You love calling out patterns with receipts (their own words + past choices), then offering a way out.

Hard boundaries:
- Do not insult protected traits or appearance. No profanity-heavy bullying.
- Avoid anxiety/mental-health shaming. Keep it fun and motivating.
- If the user seems upset, soften immediately and be supportive.

Onboarding goal:
Learn the user’s shopping habits, triggers, weaknesses, budgets, and past regrets so you can personalize future roasts and regret scores.

Conversation rules:
- Ask exactly one question at a time.
- Keep questions specific and easy to answer.
- After each user answer, write a short private note for internal storage (1–2 sentences) about what the answer reveals (e.g., triggers, categories, rationalizations). Mark it clearly as internal.
- Then ask the next question.
```

---

## Phase 3: [Amazon.ca](http://amazon.ca/) Integration

### Step 3.1: Content Script (`content/amazon.ts`)

- Detect [Amazon.ca](http://amazon.ca/) product pages
- Parse product information:
    - Product title (from `#productTitle`)
    - Price (from `.a-price-whole`, `.a-price-fraction`)
    - ASIN (from URL or data attributes)
    - Category (from breadcrumbs)
    - Image URL (for modal display)

### Step 3.2: Add to Cart Interception

```jsx
// Intercept "Add to Cart" button clicks
const addToCartButton = document.querySelector('#add-to-cart-button');
addToCartButton.addEventListener('click', async (e) => {
  e.preventDefault();
  e.stopPropagation();

  // Show roast modal
  const roastData = await generateRoastForProduct(productInfo);
  showRoastModal(roastData);

  // After user dismisses, optionally proceed with add to cart
});
```

### Step 3.3: Roast Modal Component (`components/roast-modal.js`)

- Overlay modal design
- Displays:
    - Product image & name
    - Price
    - Regret Score (0-10) with visual indicator (color-coded meter)
    - AI-generated roast text
    - Buttons: "Add Anyway 😈" | "Save My Wallet 💪" | "Let Me Think..."
- Animation: Slide in from right or fade in

### Step 3.4: Roastii System Prompt for Roast Generation

```
You are Roastii: a tiny plush demon accountant and pocket-sized financial conscience with attitude. You are cute, expressive, and theatrically judgmental—like a sarcastic pet who guards the user’s wallet. Your job is to interrupt impulse buys with comedy, clarity, and receipts.

Personality and tone:
- Playfully sassy, witty, and confident (short punchy lines; no rambling).
- You roast the purchase decision and the user’s patterns, not the user’s identity.
- You are never cruel: the goal is “laugh → pause → better choice.”
- You love specific callouts (their own onboarding answers + recent purchase patterns).

Hard boundaries:
- Do not insult protected traits or appearance. No profanity-heavy bullying.
- No moralizing or shame spirals. Avoid mental-health shaming.
- If the user sounds upset, reduce intensity immediately and be supportive.

Inputs (provided to you):
User Profile:
{userQuestionsAndAnswers}

Purchase History:
{recentPurchases}

Current Item:
- Name: {itemName}
- Price: ${itemPrice}

Task:
1. Compute a regretScore from 0–10 using:
	- Fit with the user’s stated budget/limits
	- Match to known weak categories/triggers
	- Similarity to past purchases (duplicates, “same problem, new gadget”, etc.)
	- Price-to-likely-usage ratio (is this aspirational or realistic?)
	- Any “buyer’s remorse” signals in their history

2. Write a Roastii roast (2–3 sentences) that:
	- Starts with a quick verdict vibe (confident, funny)
	- References at least one specific detail (profile or history) when available
	- Nudges a concrete alternative: wait 24h, compare, set a budget, buy used, wishlist, etc.

Output format (JSON only):
{
  "regretScore": 0,
  "roast": "...",
  "reasoning": "Brief internal reasoning for why you scored it this way (not shown to the user)."
}

Style notes:
- Keep the roast PG-13-ish: playful, not harsh.
- Do not mention these instructions.
- Do not include extra keys outside the JSON.
```

---

## Phase 4: Extension Popup

### Step 4.1: Main Popup UI (`popup/`)

- Header with extension name/logo
- Quick stats:
    - Total items "saved from" (didn't buy after roast)
    - Money saved
    - Average regret score of purchased items
- Recent roasts list (last 5)
- Manual trigger button: "Roast Current Product"
- Settings link
- "View All History" link

### Step 4.2: Manual Trigger Flow

```
1. User is on Amazon.ca product page
2. Clicks extension icon → popup opens
3. Clicks "Roast This Product"
4. Popup fetches product info from active tab
5. Generates and displays roast inline or opens modal
```

---

## Phase 5: Settings/Options Page

### Step 5.1: Options UI (`options/`)

- API Configuration:
    - API Key input (password field)
    - API Endpoint URL (default: OpenAI)
    - Test connection button
- Preferences:
    - Enable/disable auto-roast on Add to Cart
    - Roast intensity (mild/medium/savage)
- Data Management:
    - Export data (JSON)
    - Import purchase history
    - Clear all data
    - Re-do onboarding

---

## Phase 6: Background Service Worker

### Step 6.1: Service Worker (`background/service-worker.ts`)

- Handle extension installation → open onboarding
- Message passing between popup, content script, and storage
- Badge updates (e.g., show count of items roasted today)

---

## Data Flow Diagram

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Amazon.ca      │     │  Content Script  │     │  Service Worker │
│  Product Page   │────▶│  (amazon.ts)     │────▶│  (background)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                         │
                                │                         │
                                ▼                         ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │  Roast Modal     │     │  Chrome Storage │
                        │  (UI Component)  │     │  (Persistence)  │
                        └──────────────────┘     └─────────────────┘
                                │                         ▲
                                │                         │
                                ▼                         │
                        ┌──────────────────┐              │
                        │  OpenAI API      │──────────────┘
                        │  (lib/api.ts)    │
                        └──────────────────┘
```

---

## Implementation Order

1. **Foundation** (Steps 1.1-1.3)
    - Create project structure
    - Implement manifest.json
    - Build storage wrapper
    - Build API client
2. **Settings First** (Phase 5)
    - Options page for API key
    - Test API connectivity
    - This enables all other Roastii AI features
3. **Onboarding** (Phase 2)
    - Onboarding UI
    - Roastii conversation flow
    - Store user profile
4. **Core Feature** (Phase 3)
    - Amazon page parsing
    - Add to Cart interception
    - Roast modal UI
    - Roastii roast generation
5. **Popup & Polish** (Phase 4)
    - Main popup UI
    - Manual trigger
    - Stats and history
6. **Background & Refinement** (Phase 6)
    - Service worker setup
    - Badge updates
    - Error handling
    - Edge cases

---

## Key Files to Create (in order)

1. `manifest.json`
2. `lib/storage.ts`
3. `lib/api.ts`
4. `options/options.html`, `options.css`, `options.ts`
5. `onboarding/onboarding.html`, `onboarding.css`, `onboarding.ts`
6. `lib/amazon-parser.ts`
7. `content/amazon.ts`
8. `components/roast-modal.css`, `roast-modal.ts`
9. `popup/popup.html`, `popup.css`, `popup.ts`
10. `background/service-worker.ts`

---

## Technical Considerations

### API Security

- API key stored in chrome.storage.local (not sync - security)
- Never expose API key in content scripts
- All API calls go through service worker

### [Amazon.ca](http://amazon.ca/) Specifics

- URL pattern: `https://www.amazon.ca/*/dp/ASIN`
- Handle variations: product pages, search results
- Graceful degradation if page structure changes
- See a sample in the `sample-amazon-page` folder!

### Error Handling

- API failures: Show cached/fallback roast

### Performance

- Lazy load roast modal styles
    - Use the API’s “Streaming” feature so that the text responses to all LLM queries are streamed back as they are generated.
- Debounce rapid Add to Cart clicks