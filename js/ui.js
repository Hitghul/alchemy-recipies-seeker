const inventoryState = {};

function initUI() {
  renderInventoryGrid();
  document.getElementById('btn-optimize').addEventListener('click', runOptimizer);
  document.getElementById('btn-clear').addEventListener('click', clearAll);
  document.getElementById('search-plant').addEventListener('input', filterPlants);
}

function renderInventoryGrid() {
  const grid = document.getElementById('inventory-grid');
  grid.innerHTML = '';

  const families = ['VITALITY', 'ENDURANCE', 'AGILITY', 'SPIRIT'];
  const familyEmoji = { VITALITY: '❤️', ENDURANCE: '🛡️', AGILITY: '⚡', SPIRIT: '🔮' };

  for (const fam of families) {
    const section = document.createElement('div');
    section.className = 'family-section';
    section.dataset.family = fam;

    const header = document.createElement('div');
    header.className = `family-header fam-${fam.toLowerCase()}`;
    header.innerHTML = `<span class="fam-icon">${familyEmoji[fam]}</span><span>${fam}</span>`;
    section.appendChild(header);

    const plantsInFam = FAMILY_PLANTS[fam];
    for (const plantName of plantsInFam) {
      const plant = PLANTS[plantName];
      const card = document.createElement('div');
      card.className = `plant-card rarity-${plant.rarity}`;
      card.dataset.plant = plantName;
      card.dataset.family = fam;

      card.innerHTML = `
        <div class="plant-info">
          <span class="rarity-badge">${plant.rarity}</span>
          <span class="plant-name">${plantName}</span>
          <span class="plant-score">⭐${plant.score}</span>
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
}

function setQty(plantName, value) {
  const newVal = Math.max(0, parseInt(value) || 0);
  inventoryState[plantName] = newVal;
  const input = getQtyInput(plantName);
  if (input && parseInt(input.value) !== newVal) input.value = newVal;
  updateCardState(plantName, newVal);
}

function updateCardState(plantName, qty) {
  const card = document.querySelector(`.plant-card[data-plant="${plantName}"]`);
  if (card) {
    card.classList.toggle('has-stock', qty > 0);
  }
}

function clearAll() {
  for (const plantName of Object.keys(PLANTS)) {
    setQty(plantName, 0);
    const input = getQtyInput(plantName);
    if (input) input.value = 0;
  }
  document.getElementById('results').innerHTML = '';
  document.getElementById('results-summary').textContent = '';
}

function filterPlants(e) {
  const query = e.target.value.toLowerCase().trim();
  const cards = document.querySelectorAll('.plant-card');
  const sections = document.querySelectorAll('.family-section');

  cards.forEach(card => {
    const name = card.dataset.plant.toLowerCase();
    card.style.display = (!query || name.includes(query)) ? '' : 'none';
  });

  sections.forEach(section => {
    const visibleCards = section.querySelectorAll('.plant-card:not([style*="display: none"])');
    section.style.display = visibleCards.length > 0 ? '' : 'none';
  });
}

function runOptimizer() {
  const btn = document.getElementById('btn-optimize');
  btn.disabled = true;
  btn.textContent = '⚗️ Calculating...';

  setTimeout(() => {
    try {
      const inventory = { ...inventoryState };
      for (const k of Object.keys(inventory)) {
        if (!inventory[k]) delete inventory[k];
      }

      const allPills = generateAllDerivations(inventory);
      const bestSet = findBestSet(allPills, inventory);
      const summary = computeSetSummary(bestSet);

      renderResults(summary, allPills.length);
    } catch (err) {
      console.error(err);
      document.getElementById('results').innerHTML =
        `<div class="error-msg">❌ Error: ${err.message}</div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '⚗️ Optimize QiMulti';
    }
  }, 50);
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

    return `
      <div class="pill-card ${typeClass}" style="animation-delay:${i * 40}ms">
        <div class="pill-header">
          <span class="pill-rank">#${i + 1}</span>
          <span class="pill-name">${p.name}</span>
          <span class="pill-type-badge ${typeClass}">${p.type}</span>
          <span class="pill-qi">+${p.qiMulti}% QiMulti</span>
          <label class="craft-toggle">
            <input type="checkbox" onchange="this.closest('.pill-card').classList.toggle('crafted', this.checked)">
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
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m${s}s` : `${m}m`;
}

document.addEventListener('DOMContentLoaded', initUI);