// ============================================================
//  OPTIMIZER.JS — GRASP Algorithm (Greedy + Local Search)
// ============================================================

/**
 * Finds the best set in real time
 * Uses a Greedy Phase followed by optimization through successive trades
 */
// ============================================================
//  OPTIMIZER.JS — GRASP Algorithm (Greedy + Local Search)
// ============================================================

/**
 * Finds the best set in real time
 * Uses a Greedy Phase followed by optimization through successive trades
 */
function findBestSet(pills, initialInventory) {
  // 1. Grouping of Slots (using the new Similarity Rule)
  const allSlots = [];
  
  for (const pill of pills) {
    pill.cost = getCost(pill.ingredients);
    let foundSlot = null;
    
    // We check if the pill belongs to an existing slot based on the similarity rule
    for (const slot of allSlots) {
      if (arePillsSimilar(slot.variants[0], pill)) {
        foundSlot = slot;
        break;
      }
    }
    
    if (foundSlot) {
      foundSlot.variants.push(pill);
      const currentQi = getTotalQiMulti(pill);
      if (currentQi > foundSlot.qiMulti) {
        foundSlot.qiMulti = currentQi; // Update max Qi for the slot
      }
    } else {
      allSlots.push({
        name: pill.name,
        qiMulti: getTotalQiMulti(pill),
        variants: [pill]
      });
    }
  }

  // 2. Sorting variants and calculating profitability
  for (const slot of allSlots) {
    slot.variants.sort((a, b) => a.cost - b.cost);
    slot.minCost = slot.variants[0].cost;
    slot.efficiency = slot.qiMulti / slot.minCost;
  }

  // Sort all slots from most profitable to least profitable
  allSlots.sort((a, b) => {
    if (Math.abs(b.efficiency - a.efficiency) > 0.001) return b.efficiency - a.efficiency;
    return b.qiMulti - a.qiMulti;
  });

  const currentInv = { ...initialInventory };
  const selectedSlots = [];
  const unselectedSlots = [];

  // ==========================================
  // PHASE 1: Greedy Heuristic
  // ==========================================
  for (const slot of allSlots) {
    let crafted = false;
    for (const variant of slot.variants) {
      if (canCraft(variant.ingredients, currentInv)) {
        selectedSlots.push({ slot: slot, variant: variant });
        deductInv(currentInv, variant.ingredients);
        crafted = true;
        break; // Only one variant per slot
      }
    }
    if (!crafted) {
      unselectedSlots.push(slot);
    }
  }

  // ==========================================
  // PHASE 2: Local Search (1-opt Swap)
  // ==========================================
  // We try to improve the set by exchanging pills
  let improved = true;
  while (improved) {
    improved = false;

    // Attempt 1: Direct fill (In case a previous swap has freed up space)
    for (let i = unselectedSlots.length - 1; i >= 0; i--) {
      const uSlot = unselectedSlots[i];
      for (const variant of uSlot.variants) {
        if (canCraft(variant.ingredients, currentInv)) {
          selectedSlots.push({ slot: uSlot, variant: variant });
          deductInv(currentInv, variant.ingredients);
          unselectedSlots.splice(i, 1); // Removed from non-selected candidates
          improved = true;
          break;
        }
      }
    }

    if (improved) continue;

    // Attempt 2: The 1-for-1 Exchange (Multi-Qi Upgrade)

    // We sacrifice a pill from the current set to try and place a better one
    swapLoop:
    for (let i = 0; i < selectedSlots.length; i++) {
      const currentSelection = selectedSlots[i];
      
      for (let j = 0; j < unselectedSlots.length; j++) {
        const candidateSlot = unselectedSlots[j];
        
        // We will only attempt the exchange if the new pill yields strictly more QiMulti
        if (candidateSlot.qiMulti <= currentSelection.slot.qiMulti) continue;

        // Simulation: We restore the ingredients of the old pill
        const tempInv = { ...currentInv };
        restoreInv(tempInv, currentSelection.variant.ingredients);

        // Checks if the new pill fits in this simulated inventory
        for (const candidateVariant of candidateSlot.variants) {
          if (canCraft(candidateVariant.ingredients, tempInv)) {
            // SUCCESS! The exchange is valid and yields more
            // We approve the new inventory
            Object.assign(currentInv, tempInv);
            deductInv(currentInv, candidateVariant.ingredients);
            
            // Updating the lists
            unselectedSlots.push(currentSelection.slot);
            selectedSlots.splice(i, 1);
            selectedSlots.push({ slot: candidateSlot, variant: candidateVariant });
            unselectedSlots.splice(j, 1);
            
            improved = true;
            break swapLoop; // We restart the complete improvement loop
          }
        }
      }
    }
  }

  // 3. Finalizing the result
  const bestSet = selectedSlots.map(selection => selection.variant);
  bestSet.sort((a, b) => getTotalQiMulti(b) - getTotalQiMulti(a));

  return bestSet;
}

// ------------------------------------------------------------
// Utility functions for inventory management
// ------------------------------------------------------------

function deductInv(inventory, ingredients) {
  for (const [plant, qty] of Object.entries(ingredients)) {
    inventory[plant] -= qty;
  }
}

function restoreInv(inventory, ingredients) {
  for (const [plant, qty] of Object.entries(ingredients)) {
    inventory[plant] = (inventory[plant] || 0) + qty;
  }
}

function getCost(ingredients) {
  let cost = 0;
  for (const [plant, qty] of Object.entries(ingredients)) {
    const plantScore = (typeof PLANTS !== 'undefined' && PLANTS[plant]) ? PLANTS[plant].score : 50;
    cost += qty * plantScore;
  }
  return cost;
}

function canCraft(ingredients, inventory) {
  for (const [plant, qty] of Object.entries(ingredients)) {
    if ((inventory[plant] || 0) < qty) return false;
  }
  return true;
}

function effectKey(effects) {
  return effects
    .map(e => `${e.stat}:${e.pct}:${e.duration}`)
    .sort()
    .join("|");
}

function getTotalQiMulti(pill) {
  let total = 0;
  for (const e of pill.effects) {
    if (e.stat === "QiMulti") total += e.pct;
  }
  return total;
}

function computeSetSummary(bestSet) {
  const qiStats = bestSet.map(p => ({
    name: p.name,
    type: p.type,
    qiMulti: getTotalQiMulti(p),
    effects: p.effects,
    ingredients: p.ingredients,
  }));

  const totalQi = qiStats.reduce((s, p) => s + p.qiMulti, 0);
  return { pills: qiStats, totalQi };
}

function arePillsSimilar(p1, p2) {
  if (p1.name !== p2.name) return false;
  
  const getDur = (p) => {
    const qi = p.effects.find(e => e.stat === "QiMulti");
    return qi ? qi.duration : 0;
  };
  
  const d1 = getDur(p1);
  const d2 = getDur(p2);
  
  if (d1 === 0 && d2 === 0) return true;
  if (d1 === 0 || d2 === 0) return false;
  
  return (Math.abs(d1 - d2) / Math.max(d1, d2)) <= 0.011;
}