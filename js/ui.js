let inventoryState = JSON.parse(localStorage.getItem('alchemyInventory')) || {};

function saveInventory() {
  localStorage.setItem('alchemyInventory', JSON.stringify(inventoryState));
}

function initUI() {
  renderInventoryGrid();
  Object.entries(inventoryState).forEach(([name, qty]) => {
    const input = getQtyInput(name);
    if (input) {
      input.value = qty;
      updateCardState(name, qty);
    }
  });

  document.getElementById('btn-optimize').addEventListener('click', runOptimizer);
  document.getElementById('btn-clear').addEventListener('click', handleClearAllClick);
  document.getElementById('btn-clear-results').addEventListener('click', clearResultsOnly);
  document.getElementById('search-plant').addEventListener('input', filterPlants);
  document.getElementById('filter-qi').addEventListener('input', updateResultsTitle);
  document.getElementById('filter-duration').addEventListener('input', updateResultsTitle);

  document.getElementById('search-plant').addEventListener('focus', () => dataLayer.push({'event': 'focus_search'}));
  document.getElementById('filter-qi').addEventListener('focus', () => dataLayer.push({'event': 'focus_filter_qi'}));
  document.getElementById('filter-duration').addEventListener('focus', () => dataLayer.push({'event': 'focus_filter_duration'}));

  updateResultsTitle();
}

function renderInventoryGrid() {
  const grid = document.getElementById('inventory-grid');
  grid.innerHTML = '';

  const rarities = ['C', 'U', 'R', 'E', 'L'];
  const rarityLabels = { C: 'Common', U: 'Uncommon', R: 'Rare', E: 'Epic', L: 'Legendary' };
  const familyEmoji = { VITALITY: '❤️', ENDURANCE: '🛡️', AGILITY: '⚡', SPIRIT: '🔮' };

  for (const r of rarities) {
    const section = document.createElement('div');

    const header = document.createElement('div');
    header.className = `rarity-header header-${r}`;

    header.innerHTML = `
      <span class="rarity-symbol">${r}</span>
      <span class="rarity-text">${rarityLabels[r]}</span>
    `;
    section.appendChild(header);

    const plantsInRarity = Object.entries(PLANTS)
      .filter(([_, data]) => data.rarity === r)
      .sort((a, b) => a[1].score - b[1].score);

    for (const [plantName, data] of plantsInRarity) {
      const card = document.createElement('div');
      card.className = `plant-card rarity-${r}`;
      card.dataset.plant = plantName;
      card.dataset.family = data.family;

      card.innerHTML = `
        <div class="plant-info">
          <span class="plant-score">⭐ ${data.score} ~</span>
          <span class="plant-name">${plantName}</span>
          <span class="plant-family-tag">${familyEmoji[data.family]} ${data.family.toLowerCase()}</span>
        </div>
        <div class="qty-controls">
          <button class="qty-btn" onclick="adjustQty('${plantName}', -1)">−</button>
          <input class="qty-input" type="number" min="0" value="0"
            id="qty-${CSS_escape(plantName)}"
            onchange="setQty('${plantName}', this.value)"
            oninput="setQty('${plantName}', this.value)">
          <button class="qty-btn" onclick="adjustQty('${plantName}', 1)">+</button>
        </div>
      `;
      section.appendChild(card);
    }
    grid.appendChild(section);
  }
}

function CSS_escape(str) {
  return str.replace(/[^a-zA-Z0-9-_]/g, s => '\\' + s);
}

function getQtyInput(plantName) {
  return document.getElementById('qty-' + CSS_escape(plantName));
}

function adjustQty(plantName, delta) {
  const current = inventoryState[plantName] || 0;
  const newVal = Math.max(0, current + delta);
  inventoryState[plantName] = newVal;
  const input = getQtyInput(plantName);
  if (input) input.value = newVal;
  updateCardState(plantName, newVal);
  saveInventory();
}

function setQty(plantName, value) {
  const newVal = Math.max(0, parseInt(value) || 0);
  inventoryState[plantName] = newVal;
  const input = getQtyInput(plantName);
  if (input && parseInt(input.value) !== newVal) input.value = newVal;
  updateCardState(plantName, newVal);
  saveInventory();
}

function updateCardState(plantName, qty) {
  const card = document.querySelector(`.plant-card[data-plant="${plantName}"]`);
  if (card) {
    card.classList.toggle('has-stock', qty > 0);
  }
}

function clearResultsOnly() {
  document.getElementById('results').innerHTML = '';
  document.getElementById('results-summary').innerHTML = '';
}

let clearConfirmTimeout = null;

function handleClearAllClick() {
  const btn = document.getElementById('btn-clear');
  
  if (btn.classList.contains('btn-confirm-waiting')) {
    executeClearAll();
  } else {
    btn.classList.add('btn-confirm-waiting');
    btn.textContent = '⚠️ CONFIRM ?';
    
    clearConfirmTimeout = setTimeout(() => {
      resetClearButton();
    }, 3000);
  }
}

function resetClearButton() {
  const btn = document.getElementById('btn-clear');
  btn.classList.remove('btn-confirm-waiting');
  btn.textContent = 'Clear All';
  if (clearConfirmTimeout) clearTimeout(clearConfirmTimeout);
}

function executeClearAll() {
  for (const plantName of Object.keys(PLANTS)) {
    inventoryState[plantName] = 0;
    const input = getQtyInput(plantName);
    if (input) input.value = 0;
    updateCardState(plantName, 0);
  }
  saveInventory();
  clearResultsOnly();
  resetClearButton();
}

function clearAll() {
  for (const plantName of Object.keys(PLANTS)) {
    inventoryState[plantName] = 0;
    const input = getQtyInput(plantName);
    if (input) input.value = 0;
    updateCardState(plantName, 0);
  }
  saveInventory();
  clearResultsOnly();
}

function filterPlants(e) {
  const query = e.target.value.toLowerCase().trim();
  const cards = document.querySelectorAll('.plant-card');
  const sections = document.querySelectorAll('.rarity-section');

  cards.forEach(card => {
    const name = card.dataset.plant.toLowerCase();
    const family = card.dataset.family.toLowerCase();
    card.style.display = (!query || name.includes(query) || family.includes(query)) ? '' : 'none';
  });

  sections.forEach(section => {
    const visibleCards = section.querySelectorAll('.plant-card:not([style*="display: none"])');
    section.style.display = visibleCards.length > 0 ? '' : 'none';
  });
}

async function runOptimizer() {

  const btn = document.getElementById('btn-optimize');
  const minDuration = parseInt(document.getElementById('filter-duration').value) || 0;
  const qiInput = document.getElementById('filter-qi').value;
  const minQi = qiInput === "" ? 100 : parseInt(qiInput);
  const isDeepScan = document.getElementById('deep-scan-toggle').checked;
  const maxSize = isDeepScan ? 4 : 3;
  
  btn.disabled = true;
  btn.textContent = isDeepScan ? '⚗️ Deep Calculating (Please wait)...' : '⚗️ Calculating...';

  await new Promise(resolve => setTimeout(resolve, 50));

  try {
    const inventory = { ...inventoryState };
    for (const k of Object.keys(inventory)) {
      if (!inventory[k]) delete inventory[k];
    }

    const allPills = await generateAllDerivations(inventory, minDuration, maxSize, minQi);
    const bestSet = findBestSet(allPills, inventory);
    const summary = computeSetSummary(bestSet);

    renderResults(summary, allPills.length);
  } catch (err) {
    console.error(err);
    document.getElementById('results').innerHTML = `<div class="error-msg">❌ Error: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '⚗️ Optimize QiMulti';
  }
}

function renderResults(summary, totalDerivations) {
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('results-summary');

  summaryEl.innerHTML = `
    <div class="summary-box">
      <span class="summary-total">+${summary.totalQi}% Total QiMulti</span>
      <span class="summary-pills">${summary.pills.length} unique pill(s)</span>
      <span class="summary-derived">${totalDerivations} derivations analyzed</span>
    </div>
  `;

  if (summary.pills.length === 0) {
    resultsEl.innerHTML = '<div class="no-results">No pills found with QiMulti > 100%. Add more plants to your inventory.</div>';
    return;
  }

  resultsEl.innerHTML = summary.pills.map((p, i) => {
    const typeClass = p.type.toLowerCase();
    const effectsHtml = p.effects.map(e => {
      const durStr = e.duration === 0
        ? '<span class="perm-badge">♾ Permanent</span>'
        : `<span class="dur-badge">⏱ ${formatDuration(e.duration)}</span>`;
      return `<span class="effect-tag ${e.stat.toLowerCase()}">${e.stat === 'QiMulti' ? '✨' : ''}+${e.pct}% ${e.stat} ${durStr}</span>`;
    }).join('');

    const ingrHtml = Object.entries(p.ingredients)
      .map(([plant, qty]) => {
        const rarity = PLANTS[plant]?.rarity || '?';
        return `<span class="ingr-tag rarity-${rarity}">${qty}× ${plant}</span>`;
      }).join('');

    const animDelay = Math.min(i * 30, 800);

    return `
      <div class="pill-card ${typeClass}" style="animation-delay:${animDelay}ms">
        <div class="pill-header">
          <span class="pill-rank">#${i + 1}</span>
          <span class="pill-name">${p.name}</span>
          <span class="pill-type-badge ${typeClass}">${p.type}</span>
          <span class="pill-qi">+${p.qiMulti}% QiMulti</span>
          <label class="craft-toggle">
            <input type="checkbox" onchange="togglePillDone(this, ${JSON.stringify(p.ingredients).replace(/"/g, '&quot;')})">
            Done
          </label>
        </div>
        <div class="pill-effects">${effectsHtml}</div>
        <div class="pill-ingredients">${ingrHtml}</div>
      </div>
    `;
  }).join('');

  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatDuration(seconds) {
  return `${seconds}s`;
}

document.addEventListener('DOMContentLoaded', initUI);

function togglePillDone(checkbox, ingredients) {
  const pillCard = checkbox.closest('.pill-card');
  const isChecked = checkbox.checked;
  
  pillCard.classList.toggle('crafted', isChecked);

  for (const [plantName, qty] of Object.entries(ingredients)) {
    const currentQty = inventoryState[plantName] || 0;
    
    const newQty = isChecked 
      ? Math.max(0, currentQty - qty) 
      : currentQty + qty;
      
    setQty(plantName, newQty);
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    'event': 'click_recipe_done',
    'recipe_action': isChecked ? 'checked' : 'unchecked'
  });
}

function updateResultsTitle() {
  const titleText = document.getElementById('results-title-text');
  if (titleText) {
    const minDuration = parseInt(document.getElementById('filter-duration').value) || 0;
    const qiInput = document.getElementById('filter-qi').value;
    const minQi = qiInput === "" ? 100 : parseInt(qiInput);
    
    titleText.textContent = `✨ Best Set — QiMulti ≥ ${minQi}% | Min Duration ≥ ${minDuration}s`;
  }
}