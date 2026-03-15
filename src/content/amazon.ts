const _ANGER_MOOD_CLASSES = ["roastii-mood-anger-1.png", "roastii-mood-anger-2.svg", "roastii-mood-anger-3.svg"];
function getRandomAngerMoodClass() {
  const index = Math.floor(Math.random() * _ANGER_MOOD_CLASSES.length);
  return _ANGER_MOOD_CLASSES[index];
}

let interceptInProgress = false;

function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({
    type,
    payload
  });
}

function textFromSelector(root, selector) {
  return root.querySelector(selector)?.textContent?.trim() || "";
}

function parsePrice(root) {
  const whole = textFromSelector(root, ".a-price .a-price-whole").replace(/[^\d]/g, "");
  const fraction = textFromSelector(root, ".a-price .a-price-fraction").replace(/[^\d]/g, "");
  const fallback = textFromSelector(root, "#corePriceDisplay_desktop_feature_div .a-offscreen")
    .replace(/[^0-9.]/g, "");

  if (whole) {
    const amount = Number.parseFloat(`${whole}.${fraction || "00"}`);
    return Number.isFinite(amount) ? amount : 0;
  }

  const parsedFallback = Number.parseFloat(fallback);
  return Number.isFinite(parsedFallback) ? parsedFallback : 0;
}

function parseAsin(url) {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
  return match?.[1] || "";
}

function isAmazonProductPage(url = window.location.href) {
  return /^https?:\/\/(www\.)?amazon\.ca\//i.test(url);
}

function parseAmazonProduct(documentRoot = document) {
  const itemName = textFromSelector(documentRoot, "#productTitle");
  const itemPrice = parsePrice(documentRoot);
  const imageUrl = documentRoot.querySelector("#landingImage, #imgBlkFront")?.getAttribute("src") || "";
  const category = Array.from(documentRoot.querySelectorAll("#wayfinding-breadcrumbs_feature_div li"))
    .map((node) => node.textContent?.trim())
    .filter(Boolean)
    .join(" > ");

  return {
    itemName,
    itemPrice,
    itemAsin: parseAsin(window.location.href),
    category,
    imageUrl,
    pageUrl: window.location.href
  };
}

function meterMarkup(score) {
  const offset = `${100 - Math.min(100, Math.max(0, score * 10))}%`;
  return `
    <div class="roastii-meter" aria-hidden="true">
      <div class="roastii-meter-fill" style="left: ${100 - score * 10}%; width: ${offset};"></div>
    </div>
  `;
}

function scoreColor(score) {
  const safeScore = Math.max(0, Math.min(10, Number(score) || 0));
  const hue = 120 - safeScore * 12;
  return `hsl(${hue} 65% 42%)`;
}

function showRoastModal({ roastData, product, onAddAnyway, onSaveWallet, onClose }) {
  const moodImageClass = getRandomAngerMoodClass();
  const root = document.createElement("div");
  root.className = "roastii-modal-root";
  root.innerHTML = `
    <div class="roastii-modal-panel" role="dialog" aria-modal="true" aria-label="Roastii purchase warning">
      <div class="roastii-stack">
        <div class="roastii-pill">Roastii here,</div>
        <div class="roastii-product">
          <img src="${product.imageUrl || ""}" alt="">
          <div class="roastii-stack">
            <strong>${product.itemName}</strong>
            <span class="roastii-inline-note">$${product.itemPrice.toFixed(2)} CAD</span>
          </div>
        </div>
        <div class="roastii-panel roastii-stack">
          <div>
            <p class="roastii-label">Regret Score</p>
            <strong style="color: ${scoreColor(roastData.regretScore)};">${roastData.regretScore}/10</strong>
          </div>
          ${meterMarkup(roastData.regretScore)}
        </div>
        <div class="roastii-panel">
          <p class="roastii-label">Roast</p>
          <p class="roastii-copy" style="font-weight:700;">${roastData.roast}</p>
        </div>
        <div class="roastii-actions">
          <button class="roastii-button primary" data-action="add-anyway">&#x1F911;
 Add anyway!</button>
          <button class="roastii-button secondary" data-action="save-wallet">&#x1F914;
 Changed my mind</button>
          <button class="roastii-button ghost" data-action="close">&#x1F628;
 Forget this ever happened...</button>
        </div>
      </div>
    </div>
  `;

  root.addEventListener("click", (event) => {
    if (event.target === root) {
      root.remove();
      onClose?.();
    }
  });

  root.querySelector('[data-action="add-anyway"]')?.addEventListener("click", () => {
    root.remove();
    onAddAnyway?.();
  });

  root.querySelector('[data-action="save-wallet"]')?.addEventListener("click", () => {
    root.remove();
    onSaveWallet?.();
  });

  root.querySelector('[data-action="close"]')?.addEventListener("click", () => {
    root.remove();
    onClose?.();
  });

  document.body.append(root);
  return root;
}

function bypassAddToCart(button) {
  interceptInProgress = false;
  button.dataset.roastiiBypass = "true";
  button.click();
  button.dataset.roastiiBypass = "false";
}

function getAddToCartButton() {
  const button = document.querySelector("#add-to-cart-button");
  return button instanceof HTMLInputElement || button instanceof HTMLButtonElement
    ? button
    : null;
}


function buildPurchaseRecord(product, roastData) {
  return {
    ...product,
    regretScore: roastData.regretScore,
    roast: roastData.roast,
    dateAdded: new Date().toISOString()
  };
}

async function loadSettings() {
  const response = await sendMessage("storage/get");
  return response.ok ? response.data.settings : null;
}

async function requestRoast(product) {
  const response = await sendMessage("roast/generate", {
    product
  });
  return response.ok ? response.roastData : null;
}

async function recordPurchase(product, roastData) {
  await sendMessage("purchase/record", {
    item: buildPurchaseRecord(product, roastData)
  });
}

async function recordSavedWallet(amount) {
  await sendMessage("wallet/save", {
    amount
  });
}

function openRoastModal(product, roastData, handlers = {}) {
  return showRoastModal({
    product,
    roastData,
    onAddAnyway: handlers.onAddAnyway,
    onSaveWallet: handlers.onSaveWallet,
    onClose: handlers.onClose
  });
}

async function handleIntercept(event, button) {
  console.log("[Roastii] Intercepting add to cart click", { bypass: button.dataset.roastiiBypass, interceptInProgress });
  if (button.dataset.roastiiBypass === "true" || interceptInProgress) {
    console.log("[Roastii] Skipping — bypass flag or intercept already in progress");
    return;
  }

  interceptInProgress = true;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  try {
    const product = parseAmazonProduct(document);
    if (!product.itemName || !product.itemPrice) {
      console.log("[Roastii] Could not parse product details, bypassing interception", { product });
      bypassAddToCart(button);
      return;
    }

    const settings = await loadSettings();
    console.log("[Roastii] Settings loaded:", settings);
    if (!settings?.enabled || !settings.autoRoastOnAddToCart) {
      console.log("[Roastii] Auto roast on add to cart is disabled, bypassing interception", { enabled: settings?.enabled, autoRoastOnAddToCart: settings?.autoRoastOnAddToCart });
      bypassAddToCart(button);
      return;
    }

    const roastData = await requestRoast(product);
    console.log("[Roastii] Roast data received:", roastData);
    if (!roastData) {
      console.log("[Roastii] Failed to get roast data, bypassing interception");
      bypassAddToCart(button);
      return;
    }

    console.log("[Roastii] Opening roast modal");
    openRoastModal(product, roastData, {
      onAddAnyway: async () => {
        try {
          await recordPurchase(product, roastData);
        } finally {
          bypassAddToCart(button);
        }
      },
      onSaveWallet: async () => {
        try {
          await recordSavedWallet(product.itemPrice);
        } finally {
          interceptInProgress = false;
        }
      },
      onClose: () => {
        interceptInProgress = false;
      }
    });
  } catch (_error) {
    console.error("[Roastii] Error during interception, bypassing add to cart", _error);
    bypassAddToCart(button);
  }
}

function attachInterception() {
  if (!isAmazonProductPage()) {
    console.log("[Roastii] Not an Amazon product page, skipping interception");
    return;
  }

  const button = getAddToCartButton();
  if (!button) {
    console.log("[Roastii] Add to Cart button not found");
    return;
  }
  if (button.dataset.roastiiBound === "true") {
    return;
  }

  console.log("[Roastii] Attaching interception to Add to Cart button", { button });

  button.dataset.roastiiBound = "true";

  button.addEventListener("click", (event) => {
    void handleIntercept(event, button);
  }, true);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "page/get-product") {
    sendResponse({
      ok: true,
      product: parseAmazonProduct(document)
    });
    return true;
  }

  if (message.type === "page/show-roast") {
    const product = message.product || parseAmazonProduct(document);
    const roastData = message.roastData;
    if (!roastData) {
      sendResponse({ ok: false });
      return true;
    }

    openRoastModal(product, roastData, {
      onAddAnyway: async () => {
        await recordPurchase(product, roastData);
      },
      onSaveWallet: async () => {
        await recordSavedWallet(product.itemPrice);
      }
    });

    sendResponse({ ok: true, roastData });
    return true;
  }

  return false;
});

attachInterception();
new MutationObserver(() => attachInterception()).observe(document.documentElement, {
  childList: true,
  subtree: true
});
