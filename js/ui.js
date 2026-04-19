let inventoryState = JSON.parse(localStorage.getItem('alchemyInventory')) || {};
let uiSettings = JSON.parse(localStorage.getItem('alchemySettings')) || {
  minQi: 100,
  minDuration: 0,
  maxPills: '',
  sortMode: 'grouped'
};

let currentBestSet = [];
let currentTotalDerivations = 0;
let currentSortMode = uiSettings.sortMode;

function saveInventory() {
  localStorage.setItem('alchemyInventory', JSON.stringify(inventoryState));
}

// Saves all UI filter states and sort mode to localStorage
function saveUISettings() {
  uiSettings.minQi = document.getElementById('filter-qi').value;
  uiSettings.minDuration = document.getElementById('filter-duration').value;
  uiSettings.maxPills = document.getElementById('filter-max-pills').value;
  uiSettings.sortMode = currentSortMode;
  localStorage.setItem('alchemySettings', JSON.stringify(uiSettings));
}

// Saves the current generated recipes and their "done" state
function saveResultsState() {
  localStorage.setItem('alchemyResults', JSON.stringify({
    bestSet: currentBestSet,
    totalDerivations: currentTotalDerivations
  }));
}

// Loads the saved recipes on page load
function loadResultsState() {
  const saved = JSON.parse(localStorage.getItem('alchemyResults'));
  if (saved && saved.bestSet && saved.bestSet.length > 0) {
    currentBestSet = saved.bestSet;
    currentTotalDerivations = saved.totalDerivations || 0;
    renderResults();
  }
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

  // Restore UI filter values from localStorage
  document.getElementById('filter-qi').value = uiSettings.minQi !== undefined ? uiSettings.minQi : 100;
  document.getElementById('filter-duration').value = uiSettings.minDuration !== undefined ? uiSettings.minDuration : 0;
  document.getElementById('filter-max-pills').value = uiSettings.maxPills !== undefined ? uiSettings.maxPills : '';

  document.getElementById('btn-optimize').addEventListener('click', runOptimizer);
  document.getElementById('btn-clear').addEventListener('click', handleClearAllClick);
  // Use the new confirmation handler for Clear Recipes
  document.getElementById('btn-clear-results').addEventListener('click', handleClearResultsClick); 
  
  document.getElementById('search-plant').addEventListener('input', filterPlants);
  document.getElementById('search-plant').addEventListener('focus', () => dataLayer.push({'event': 'focus_search'}));

  // Bind input events for filters to save their state and update title
  const filters = ['filter-qi', 'filter-duration', 'filter-max-pills'];
  filters.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        updateResultsTitle();
        saveUISettings();
      });
      el.addEventListener('focus', () => dataLayer.push({'event': `focus_${id}`}));
    }
  });

  updateResultsTitle();
  loadResultsState();
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

let clearResultsConfirmTimeout = null;

function handleClearResultsClick() {
  const btn = document.getElementById('btn-clear-results');
  
  if (btn.classList.contains('btn-confirm-waiting')) {
    executeClearResults();
  } else {
    btn.classList.add('btn-confirm-waiting');
    btn.textContent = '⚠️ CONFIRM ?';
    
    clearResultsConfirmTimeout = setTimeout(() => {
      resetClearResultsButton();
    }, 3000);
  }
}

function resetClearResultsButton() {
  const btn = document.getElementById('btn-clear-results');
  btn.classList.remove('btn-confirm-waiting');
  btn.textContent = 'Clear Recipes';
  if (clearResultsConfirmTimeout) clearTimeout(clearResultsConfirmTimeout);
}

function executeClearResults() {
  clearResultsOnly();
  resetClearResultsButton();
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
  
  const maxPillsInput = document.getElementById('filter-max-pills').value;
  const maxPills = maxPillsInput === "" ? Infinity : parseInt(maxPillsInput);
  
  const maxSize = 3;
  
  btn.disabled = true;
  btn.textContent = '⚗️ Calculating...';

  await new Promise(resolve => setTimeout(resolve, 50));

try {
    const inventory = { ...inventoryState };
    for (const k of Object.keys(inventory)) {
      if (!inventory[k]) delete inventory[k];
    }

    const allPills = await generateAllDerivations(inventory, minDuration, maxSize, minQi);
    currentBestSet = findBestSet(allPills, inventory, maxPills);
    
    // Assign a unique ID and default "isDone" state to each generated pill
    currentBestSet.forEach((pill, idx) => {
      pill.id = 'pill_' + Date.now() + '_' + idx;
      pill.isDone = false;
    });
    
    currentTotalDerivations = allPills.length;
    
    // Save the new generation to localStorage
    saveResultsState();
    renderResults();
  } catch (err) {
    console.error(err);
    document.getElementById('results').innerHTML = `<div class="error-msg">❌ Error: ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = '⚗️ Optimize QiMulti';
  }
}

function renderResults() {
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('results-summary');

  if (!currentBestSet || currentBestSet.length === 0) {
    summaryEl.innerHTML = '';
    resultsEl.innerHTML = '<div class="no-results">No pills found with QiMulti > 100%. Add more plants to your inventory.</div>';
    return;
  }

  const sortedSet = applySorting(currentBestSet, currentSortMode);
  const summary = computeSetSummary(sortedSet);

  const sortBtnText = currentSortMode === 'grouped' ? 'Sort by QiMulti' : 'Sort by proximity';

  let summaryHtml = `
    <div class="summary-box">
      <span class="summary-total">+${summary.totalQi}% Total QiMulti</span>
      <span class="summary-pills">${summary.pills.length} unique pill(s)</span>
      <span class="summary-derived">${currentTotalDerivations} derivations analyzed</span>
      <button id="btn-toggle-sort" class="btn" style="margin-left: auto;">${sortBtnText}</button>
    </div>
  `;

  if (currentSortMode === 'grouped') {
    summaryHtml += `
      <div class="summary-box" style="margin-top: 0.5rem; background: rgba(94, 207, 122, 0.1); border-color: rgba(94, 207, 122, 0.3); justify-content: center; padding: 0.4rem;">
        <span style="color: var(--green); font-size: 0.8rem;">
          <span style="border: 1px solid var(--green); padding: 0.1rem 0.3rem; border-radius: 3px; box-shadow: 0 0 6px rgba(94, 207, 122, 0.4); margin-right: 0.4rem;">Plant Name</span> 
          Green borders indicate plants that were swapped compared to the pill directly above it
        </span>
      </div>
    `;
  }

  summaryEl.innerHTML = summaryHtml;

  document.getElementById('btn-toggle-sort').addEventListener('click', () => {
    currentSortMode = currentSortMode === 'grouped' ? 'qimulti' : 'grouped';
    saveUISettings();
    renderResults();
  });

  resultsEl.innerHTML = sortedSet.map((p, i) => {
    // Calculate QiMulti directly to ensure we have the value
    const pillQiMulti = getTotalQiMulti(p);
    const typeClass = p.type.toLowerCase();
    
    // Restore visual "Done" state
    const craftedClass = p.isDone ? 'crafted' : '';
    const isCheckedAttr = p.isDone ? 'checked' : '';

    const effectsHtml = p.effects.map(e => {
      const durStr = e.duration === 0
        ? '<span class="perm-badge">♾ Permanent</span>'
        : `<span class="dur-badge">⏱ ${formatDuration(e.duration)}</span>`;
      return `<span class="effect-tag ${e.stat.toLowerCase()}">${e.stat === 'QiMulti' ? '✨' : ''}+${e.pct}% ${e.stat} ${durStr}</span>`;
    }).join('');

    let diffPlants = new Set();
    if (currentSortMode === 'grouped' && i > 0) {
      const prevPill = sortedSet[i - 1]; // Use sortedSet directly here
      if (prevPill.basePill === p.basePill) {
        const allPlants = new Set([...Object.keys(p.ingredients), ...Object.keys(prevPill.ingredients)]);
        for (const plant of allPlants) {
          if ((p.ingredients[plant] || 0) !== (prevPill.ingredients[plant] || 0)) {
            diffPlants.add(plant);
          }
        }
      }
    }
    
    const ingrHtml = Object.entries(p.ingredients)
      .sort((a, b) => PLANTS[b[0]].score - PLANTS[a[0]].score)
      .map(([plant, qty]) => {
        const rarity = PLANTS[plant]?.rarity || '?';
        const swappedClass = diffPlants.has(plant) ? ' swapped' : '';
        return `<span class="ingr-tag rarity-${rarity}${swappedClass}">${qty}× ${plant}</span>`;
      }).join('');

    const animDelay = Math.min(i * 30, 800);

    return `
      <div class="pill-card ${typeClass} ${craftedClass}" style="animation-delay:${animDelay}ms">
        <div class="pill-header">
          <span class="pill-rank">#${i + 1}</span>
          <span class="pill-name">${p.name}</span>
          <span class="pill-type-badge ${typeClass}">${p.type}</span>
          <span class="pill-qi">+${pillQiMulti}% QiMulti</span>
          <label class="craft-toggle">
            <input type="checkbox" ${isCheckedAttr} onchange="togglePillDone(this, '${p.id}')">
            Done
          </label>
        </div>
        <div class="pill-effects">${effectsHtml}</div>
        <div class="pill-ingredients">${ingrHtml}</div>
      </div>
    `;
  }).join('');
}

function formatDuration(seconds) {
  return `${seconds}s`;
}

document.addEventListener('DOMContentLoaded', initUI);

function togglePillDone(checkbox, pillId) {
  const pillCard = checkbox.closest('.pill-card');
  const isChecked = checkbox.checked;
  
  pillCard.classList.toggle('crafted', isChecked);

  // Find the exact pill in the global state and update its status
  const pill = currentBestSet.find(p => p.id === pillId);
  if (!pill) return;
  
  pill.isDone = isChecked;
  saveResultsState(); // Save the new "done" state to localStorage

  // Update inventory quantities
  for (const [plantName, qty] of Object.entries(pill.ingredients)) {
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

function clearResultsOnly() {
  document.getElementById('results').innerHTML = '';
  document.getElementById('results-summary').innerHTML = '';
  currentBestSet = [];
  localStorage.removeItem('alchemyResults'); // Clear saved results
}

// ============================================================
// Logic for UI Sorting & Grouping
// ============================================================

function applySorting(bestSet, mode) {
  if (mode === 'qimulti') {
    return [...bestSet].sort((a, b) => getTotalQiMulti(b) - getTotalQiMulti(a));
  }

  const groups = {};
  for (const pill of bestSet) {
    if (!groups[pill.basePill]) groups[pill.basePill] = [];
    groups[pill.basePill].push(pill);
  }

  const baseQiMap = {};
  for (const basePill of Object.keys(groups)) {
    const recipe = RECIPES.find(r => r.name === basePill);
    let qi = 0;
    if (recipe) {
      for (const e of recipe.effects) {
        if (e.stat === "QiMulti") qi += e.pct;
      }
    }
    baseQiMap[basePill] = qi;
  }

  const sortedGroupKeys = Object.keys(groups).sort((a, b) => baseQiMap[b] - baseQiMap[a]);

  const finalSorted = [];

  for (const key of sortedGroupKeys) {
    const groupPills = groups[key];
    
    groupPills.sort((a, b) => getTotalQiMulti(b) - getTotalQiMulti(a));
    
    const chained = [];
    const unplaced = [...groupPills];
    
    let current = unplaced.shift();
    chained.push(current);

    while (unplaced.length > 0) {
      let bestIndex = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unplaced.length; i++) {
        const dist = ingredientDistance(current.ingredients, unplaced[i].ingredients);
        if (dist < minDistance) {
          minDistance = dist;
          bestIndex = i;
        }
      }

      current = unplaced.splice(bestIndex, 1)[0];
      chained.push(current);
    }

    finalSorted.push(...chained);
  }

  return finalSorted;
}

function ingredientDistance(ingr1, ingr2) {
  const allPlants = new Set([...Object.keys(ingr1), ...Object.keys(ingr2)]);
  let diff = 0;
  for (const p of allPlants) {
    const q1 = ingr1[p] || 0;
    const q2 = ingr2[p] || 0;
    diff += Math.abs(q1 - q2);
  }
  return diff / 2; 
}