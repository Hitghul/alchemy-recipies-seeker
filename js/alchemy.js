// ============================================================
//  ALCHEMY.JS — Derivation engine
// ============================================================

/**
 * Generates all valid and craftable derivations (QiMulti > 100%)
 */
async function generateAllDerivations(inventory, minDuration, maxSize, minQi) {
  const results = [];

  // Filter recipes (Ignore unknown effects and the Death Pill)
  const candidateRecipes = RECIPES.filter(r =>
    r.effects.length > 0 &&
    !r.effects.some(e => e.stat === "DEATH")
  );

  for (const baseRecipe of candidateRecipes) {
    const derived = await deriveFromRecipe(baseRecipe, inventory, candidateRecipes, maxSize);
    for (const d of derived) {
      results.push(d);
    }
  }

  // Deduplication: same name + exact same ingredients -> we only keep one
  const seen = new Set();
  const deduped = [];
  for (const pill of results) {
    const key = pill.name + "|" + ingredientKey(pill.ingredients);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(pill);
    }
  }

  // Final filter: We only keep those that give > 100% QiMulti
  return deduped.filter(pill =>
    pill.effects.some(e => e.stat === "QiMulti" && e.pct >= minQi) &&
    pill.effects.some(e => e.duration >= minDuration || e.duration === 0)
  );
}

/**
 * Generates all variations of a recipe by substituting 1 to 3 plants
 */
async function deriveFromRecipe(baseRecipe, inventory, allRecipes, maxSize) {
  const pills = [];

  // 1. Flatten the ingredients into a single list
  const baseList = [];
  for (const [plant, qty] of Object.entries(baseRecipe.ingredients)) {
    for (let i = 0; i < qty; i++) {
      baseList.push(plant);
    }
  }

  // 2. Obtain all possible index groups (1 to 3 from the length)
  const indices = Array.from({ length: baseList.length }, (_, i) => i);
  const subsets = [];
  for (let size = 1; size <= maxSize; size++) {
    subsets.push(...getCombinations(indices, size));
  }

  const seenMaps = new Set();

  // Add the basic regular recipe (0 swaps)
  const regKey = ingredientKey(baseRecipe.ingredients);
  seenMaps.add(regKey);
  if (canCraft(baseRecipe.ingredients, inventory)) {
    pills.push(computePill(baseRecipe, baseRecipe.ingredients, baseRecipe.ingredients, allRecipes));
  }

  // 3. Apply the permutations for each index subset
  let lastYieldTime = performance.now();

  for (const subset of subsets) {
    // For each chosen index, list the alternatives in the same family
    const candidatesPerSlot = subset.map(idx => {
      const plant = baseList[idx];
      const fam = PLANTS[plant].family;
      return FAMILY_PLANTS[fam].filter(p => p !== plant);
    });

    // Cartesian product to obtain all replacement permutations
    const combos = cartesian(candidatesPerSlot);

    for (const combo of combos) {      
      if (performance.now() - lastYieldTime > 40) { 
         await new Promise(resolve => setTimeout(resolve, 0));
         lastYieldTime = performance.now();
       }

       const newList = [...baseList];
       // Replace plants with specific indexes
       for (let i = 0; i < subset.length; i++) {
         newList[subset[i]] = combo[i];
       }

       // Reconstruct the object of quantities
       const newIngr = {};
       for (const p of newList) {
         newIngr[p] = (newIngr[p] || 0) + 1;
       }

       // Avoid calculating strict duplicates created by replacement symmetries
       const key = ingredientKey(newIngr);
       if (seenMaps.has(key)) continue;
       seenMaps.add(key);

       // Check feasibility with the inventory before performing the complex calculation
       if (canCraft(newIngr, inventory)) {
         pills.push(computePill(baseRecipe, baseRecipe.ingredients, newIngr, allRecipes));
       }
    }
  }

  return pills;
}

/**
 * Calculate the final statistics of the derivative pill.
 */
function computePill(baseRecipe, baseIngredients, newIngredients, allRecipes) {
  const swapped = getSwaps(baseIngredients, newIngredients);
  const numSwapped = swapped.length;

  if (numSwapped === 0) {
    return {
      name: baseRecipe.name,
      type: "Regular",
      basePill: baseRecipe.name,
      ingredients: { ...newIngredients },
      effects: baseRecipe.effects.map(e => ({ ...e })),
    };
  }

  // Calculation of the transformation score (New - Old)
  let sumTransform = 0;
  for (const { oldPlant, newPlant } of swapped) {
    sumTransform += PLANTS[newPlant].score - PLANTS[oldPlant].score;
  }

  // Anomaly Check (does the recipe fall back on another Regular?)
  const anomaly = findAnomalyRecipe(baseRecipe, newIngredients, allRecipes);
  if (anomaly) {
    return {
      name: anomaly.name,
      type: "Regular",
      basePill: baseRecipe.name,
      ingredients: { ...newIngredients },
      effects: anomaly.effects.map(e => ({ ...e })),
    };
  }

  // Application of statistical modifiers (Strict mathematical rounding)
  const type = sumTransform > 0 ? "Heavenly" : "Imperfect";
  const cappedSum = Math.max(-50, Math.min(50, sumTransform));
  const mult = 1 + cappedSum / 100;

  const newEffects = baseRecipe.effects.map(e => ({
    stat: e.stat,
    pct: Math.ceil(e.pct * mult),
    duration: e.duration === 0 ? 0 : Math.round(e.duration * mult),
  }));

  return {
    name: `${type} ${baseRecipe.name}`,
    type,
    basePill: baseRecipe.name,
    ingredients: { ...newIngredients },
    effects: newEffects,
  };
}

/**
 * Check if the exact composition already exists as a regular recipe
 */
function findAnomalyRecipe(baseRecipe, newIngredients, allRecipes) {
  for (const r of allRecipes) {
    if (r.name === baseRecipe.name) continue;
    if (ingredientKey(r.ingredients) === ingredientKey(newIngredients)) {
      return r;
    }
  }
  return null;
}

/**
 * Extracts the strict differences between the base recipe and the new recipe by family
*/
function getSwaps(baseIngr, newIngr) {
  const swaps = [];
  const baseFam = {};
  const newFam = {};
  
  // Sorting by family for the database
  for (const [p, q] of Object.entries(baseIngr)) {
    const f = PLANTS[p].family;
    if (!baseFam[f]) baseFam[f] = [];
    for (let i = 0; i < q; i++) baseFam[f].push(p);
  }
  // Sorting by family for the new recipe
  for (const [p, q] of Object.entries(newIngr)) {
    const f = PLANTS[p].family;
    if (!newFam[f]) newFam[f] = [];
    for (let i = 0; i < q; i++) newFam[f].push(p);
  }
  
  // Comparison
  for (const fam of Object.keys({ ...baseFam, ...newFam })) {
    const bList = (baseFam[fam] || []).slice().sort();
    const nList = (newFam[fam] || []).slice().sort();
    
    for (let i = 0; i < bList.length; i++) {
      if (bList[i] !== nList[i]) {
        swaps.push({ oldPlant: bList[i], newPlant: nList[i] });
      }
    }
  }
  return swaps;
}

function canCraft(ingredients, inventory) {
  for (const [plant, qty] of Object.entries(ingredients)) {
    if ((inventory[plant] || 0) < qty) return false;
  }
  return true;
}

function ingredientKey(ingr) {
  return Object.entries(ingr).sort(([a], [b]) => a.localeCompare(b))
    .map(([p, q]) => `${p}:${q}`).join("|");
}

// ============================================================
// Combinatorial Mathematical Tools
// ============================================================

function getCombinations(array, size) {
  const result = [];
  function recurse(start, current) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      recurse(i + 1, current);
      current.pop();
    }
  }
  recurse(0, []);
  return result;
}

function cartesian(arrays) {
  if (arrays.length === 0) return [[]];
  const [first, ...rest] = arrays;
  const restProduct = cartesian(rest);
  const result = [];
  for (const item of first) {
    for (const combo of restProduct) {
      result.push([item, ...combo]);
    }
  }
  return result;
}