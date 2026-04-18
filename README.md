![Views](https://api.visitorbadge.io/api/visitors?path=hitghul.github.io/alchemy-recipies-seeker&label=VIEWS&labelColor=%230a0c14&countColor=%23111520&style=for-the-badge)

# ⚗️ QiMulti Optimizer for "Chasing Immortality"

![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/css3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)

A lightweight, lightning-fast web application designed for the Roblox game **Chasing Immortality**. 

This tool acts as an advanced alchemy solver. It calculates the absolute best combination of pills to craft in order to maximize your **QiMulti (Qi Multiplier) bonus**, based strictly on the specific plants you currently hold in your inventory.

**[Launch the Optimizer here!](https://hitghul.github.io/alchemy-recipies-seeker/)**

---

## Features

* **Smart Derivation Engine:** Automatically calculates all possible derivation paths (Heavenly, Imperfect) based on the game's strict family-swapping rules.
* **Inventory Constraints:** The algorithm respects your exact inventory. It will never suggest a set of pills that you cannot afford to craft simultaneously.
* **Unique Effects Validation:** Prevents crafting overlapping pills. It ensures no two pills in the final set share the exact same name and effects, maximizing efficiency.
* **Instant Calculation:** Uses an advanced GRASP (Greedy Randomized Adaptive Search Procedure) algorithm to find the near-perfect optimal set in milliseconds, avoiding the combinatorial explosion of millions of possibilities.
* **Crafting Tracker:** A built-in "Done" checklist strikes through recipes as you craft them in-game, making it easy to keep track of large sets.

## How to Use

1. Open the web app.
2. Enter the exact quantities of the plants you have in your in-game inventory using the `+` / `-` buttons or by typing directly.
3. Click the **"Optimize QiMulti"** button.
4. The app will generate the best possible pill set. Follow the recipes from top to bottom, checking the "Done" box as you craft each one in the game.

## Under the Hood (For Developers)

Alchemy optimization is a variation of the **Multi-Dimensional Multiple-Choice Knapsack Problem (MMKP)**, which is NP-Hard. With thousands of possible recipe derivations, a standard brute-force or DFS (Branch & Bound) approach would freeze the browser on large inventories. 

To solve this, the application uses a custom **Local Search Heuristic (GRASP)**:
1. **Greedy Phase:** It groups variants by unique outcome, scores them by `Efficiency (QiMulti / Rarity Cost)`, and fills the inventory to establish a high baseline score.
2. **Local Search (1-opt Swap):** It continuously attempts to "repair" the set by removing one pill and replacing it with one or more better alternatives from the remaining inventory until a local optimum is reached.

## Local Installation

If you want to run or modify this project locally:

1. Clone the repository:
   ```bash
   git clone [https://github.com/Hitghul/alchemy-recipies-seeker.git](https://github.com/Hitghul/alchemy-recipies-seeker.git)

2. Navigate to the directory:
   ```bash
   cd alchemy-recipies-seeker
   ```
3. Open `index.html` in your favorite web browser. No server, database, or dependencies required!

## License

This project is released under the WTFPL (Do What The Fuck You Want To Public License).