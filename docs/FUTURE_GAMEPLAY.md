# DUEL — Future Gameplay & Depth Ideas

**Status:** Parked for future consideration  
**Last updated:** 2026-07-24

---

## 1. Duel History / Match Replay Page
`recentDuels.ts` stores the last 10 outcomes in localStorage, but there's no UI to view them. A `/history` page showing past duel summaries (cards played, HP deltas, win/loss, reward earned) would add replayability and help players learn from their choices.

## 2. Card Synergy / Combo System
The current 6 base cards are all independent — no card interacts with another. Adding **combos** would add strategic depth:
- **Rush Combo**: Playing `Strike` → `Surge` in consecutive turns deals +15% bonus damage on Surge.
- **Fortress Combo**: `Block` → `Parry` grants +10 shield carryover to the next turn.
- **Drain Synergy**: `Drain` after an attack card heals for 75% instead of 50%.

This would be a pure `gameEngine.ts` change since `resolveTurn` already has access to `state.turns` history.

## 3. Expandable Card Pool — New Card Types
Only 6 base cards exist. Adding 2–3 new cards would refresh the meta significantly:
- **Reflect** (defend/special hybrid): Deals 50% of blocked damage back. High shield, zero base damage.
- **Gambit** (attack): High risk — 60 damage, 0 shield, but if the opponent plays a defend card, Gambit backfires for 15 self-damage.
- **Siphon** (special): Steals 5 shield from the opponent's card and adds it to yours.

## 4. Boss Duels / Challenge Mode
After reaching 15+ wins, introduce a **Boss CIPHER** mode where CIPHER has 120 HP instead of 100 and plays from the Tier 3 pool. Win condition awards a "Boss Slayer" badge and a higher-tier reward.

## 5. Daily Challenge
A fixed-seed daily duel where every player faces the same CIPHER hand and RNG. Compare your HP delta on the leaderboard. This leverages the server-side deterministic draw (`drawHandWithRng`) already in place.
