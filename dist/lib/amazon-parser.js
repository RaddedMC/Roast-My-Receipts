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

export function isAmazonProductPage(url = window.location.href) {
  return /amazon\.ca\/.+(\/dp\/|\/gp\/product\/)/i.test(url);
}

export function parseAmazonProduct(documentRoot = document) {
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
