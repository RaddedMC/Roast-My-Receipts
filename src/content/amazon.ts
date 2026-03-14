let interceptInProgress = false;

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
  return /amazon\.ca\/.+(\/dp\/|\/gp\/product\/)/i.test(url);
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

function showRoastModal({ roastData, product, onAddAnyway, onSaveWallet, onClose }) {
  const root = document.createElement("div");
  root.className = "roastii-modal-root";
  root.innerHTML = `
    <div class="roastii-modal-panel" role="dialog" aria-modal="true" aria-label="Roastii purchase warning">
      <div class="roastii-stack">
        <div class="roastii-pill">Roastii incoming</div>
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
            <strong>${roastData.regretScore}/10</strong>
          </div>
          <div class="roastii-meter" aria-hidden="true"></div>
        </div>
        <div class="roastii-panel">
          <p class="roastii-label">Roast</p>
          <p class="roastii-copy">${roastData.roast}</p>
        </div>
        <div class="roastii-actions">
          <button class="roastii-button primary" data-action="add-anyway">Add Anyway</button>
          <button class="roastii-button secondary" data-action="save-wallet">Save My Wallet</button>
          <button class="roastii-button ghost" data-action="close">Let Me Think...</button>
        </div>
      </div>
    </div>
  `;

  const meter = root.querySelector(".roastii-meter");
  const marker = document.createElement("div");
  marker.className = "roastii-meter-fill";
  marker.style.left = `${Math.min(100, roastData.regretScore * 10)}%`;
  marker.style.width = `${Math.max(0, 100 - roastData.regretScore * 10)}%`;
  meter?.append(marker);

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
}

function attachInterception() {
  if (!isAmazonProductPage()) {
    return;
  }

  const button = document.querySelector("#add-to-cart-button");
  if (!button || button.dataset.roastiiBound === "true") {
    return;
  }

  button.dataset.roastiiBound = "true";
  button.addEventListener(
    "click",
    async (event) => {
      if (button.dataset.roastiiBypass === "true") {
        return;
      }

      if (interceptInProgress) {
        return;
      }

      interceptInProgress = true;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const product = parseAmazonProduct(document);
      if (!product.itemName || !product.itemPrice) {
        interceptInProgress = false;
        button.dataset.roastiiBypass = "true";
        button.click();
        button.dataset.roastiiBypass = "false";
        return;
      }

      const storageResponse = await chrome.runtime.sendMessage({ type: "storage/get" });
      if (!storageResponse.ok || !storageResponse.data.settings.enabled || !storageResponse.data.settings.autoRoastOnAddToCart) {
        interceptInProgress = false;
        button.dataset.roastiiBypass = "true";
        button.click();
        button.dataset.roastiiBypass = "false";
        return;
      }

      const roastResponse = await chrome.runtime.sendMessage({
        type: "roast/generate",
        payload: { product }
      });

      if (!roastResponse.ok) {
        interceptInProgress = false;
        return;
      }

      showRoastModal({
        roastData: roastResponse.roastData,
        product,
        onAddAnyway: async () => {
          await chrome.runtime.sendMessage({
            type: "purchase/record",
            payload: {
              item: {
                ...product,
                regretScore: roastResponse.roastData.regretScore,
                roast: roastResponse.roastData.roast,
                dateAdded: new Date().toISOString()
              }
            }
          });
          interceptInProgress = false;
          button.dataset.roastiiBypass = "true";
          button.click();
          button.dataset.roastiiBypass = "false";
        },
        onSaveWallet: async () => {
          await chrome.runtime.sendMessage({
            type: "wallet/save",
            payload: { amount: product.itemPrice }
          });
          interceptInProgress = false;
        },
        onClose: () => {
          interceptInProgress = false;
        }
      });
    },
    true
  );
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
 
      showRoastModal({
        roastData,
        product,
        onAddAnyway: async () => {
          await chrome.runtime.sendMessage({
            type: "purchase/record",
            payload: {
              item: {
                ...product,
                regretScore: roastData.regretScore,
                roast: roastData.roast,
                dateAdded: new Date().toISOString()
              }
            }
          });
        },
        onSaveWallet: async () => {
          await chrome.runtime.sendMessage({
            type: "wallet/save",
            payload: { amount: product.itemPrice }
          });
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
