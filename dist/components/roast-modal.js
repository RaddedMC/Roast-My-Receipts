function meterMarkup(score) {
  const offset = `${100 - Math.min(100, Math.max(0, score * 10))}%`;
  return `
    <div class="roastii-meter" aria-hidden="true">
      <div class="roastii-meter-fill" style="left: ${100 - score * 10}%; width: ${offset};"></div>
    </div>
  `;
}

export function showRoastModal({ roastData, product, onAddAnyway, onSaveWallet, onClose }) {
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
          ${meterMarkup(roastData.regretScore)}
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
