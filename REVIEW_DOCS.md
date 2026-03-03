# Developer Documentation (REVIEW_DOCS.md)

**Generated:** 2026-02-17
**Scope:** Technical guide for maintaining and extending `lnmarkets-bot`.

## 1. Mathematical Core: Inverse Value Averaging

The bot's entire strategy rests on a single mathematical property of inverse futures with a static hedge.

### The Property
For an inverse futures account (collateral in BTC, PnL in BTC), if you maintain a static short position (hedge) equal to $H$ USD, the **unhedged value** in USD ($V_{unhedged}$) scales perfectly linearly with the BTC price ($P$).

$$ V_{unhedged} = P \times (\text{InitialEquity}_{BTC} + \frac{H}{P_{entry}}) $$

This means:
1.  **Trigger Prices** for rebalancing are simple ratios: $P_{trigger} = P_{current} \times \frac{V_{target}}{V_{current}}$
2.  **Rebalance Quantities** are just the deviation in USD: $Q = V_{target} - V_{current}$

**Implication for Devs:**
- Do NOT try to implement complex PnL simulations.
- Do NOT change the `calculateTriggerPrice` logic unless the fundamental instrument changes (e.g., to linear futures or options).
- If adding leverage, this property holds as long as liquidation is avoided.

## 2. Code Structure

### `bot.js` (Controller)
- **Role:** Orchestrator. Initializes state, calls API, calls logic, executes trades.
- **Key Methods:**
  - `rebalance(dryRun)`: Main loop.
    1. Fetches state.
    2. Checks logic.
    3. **Action:** Either places Limit Orders (if minor deviation) or Market Order (if major deviation).
    4. Updates state & logs.

### `lib/lnm-client.js` (API Wrapper)
- **Role:** Abstraction over `@ln-markets/api`.
- **Key Method:** `getCurrentState()`
  - Aggregates `user.balance` (cash), `margin_total`, and `unrealized_pl`.
  - **CRITICAL:** Calculates `netPositionUsd` by summing position quantities (positive for Long, negative for Short).
  - **Returns:** `{ totalEquitySats, netPositionUsd, currentPrice, ... }`

### `lib/value-averaging.js` (Logic)
- **Role:** Pure function logic. No side effects.
- **Key Concept:** `Investment Value (IV)` = The unhedged BTC exposure in USD.
  - Formula: `IV = (TotalEquitySats / 1e8 * Price) + NetPositionUsd`
- **Configuration:**
  - `targetGrowthRateDaily`: Determines slope of target line.
  - `limitOrderThreshold`: +/- % deviation to place limit orders.

## 3. Configuration & State

### `config.js`
- **WARNING:** `initial_btc_value_usd` is currently hardcoded.
  - **Dev Task:** Refactor this to be dynamic or clearly document it must be set per deployment.
- **Safety:** `maxLeverage: 1` is hardcoded. Do not increase without adding liquidation risk management logic.

### `state.json`
- Stores `startDate` (for growth calculation) and `lastCheck`.
- **Migration:** If changing logic, handle backward compatibility in `bot.js:loadState()`.

## 4. Common Pitfalls

1.  **Price = 0:** API errors might return price 0.
    - **Mitigation:** Always check `if (price > 0)` before division.
2.  **Dust Limits:** LNMarkets has minimum trade sizes (~$1 or 1000 sats).
    - **Mitigation:** `bot.js` checks `minTradeSats` before executing.
3.  **Taker Fees:**
    - **Issue:** Clamped limit orders (executing immediately) pay taker fees (0.05-0.1%).
    - **Mitigation:** Accept this cost for reliability, or implement a "chase" logic for maker orders.

## 5. Testing

To verify logic changes without losing money:
1.  **Dry Run:** `node bot.js rebalance --dry-run`
    - Prints calculated orders/trades without executing.
2.  **Unit Tests (Recommended Addition):**
    - Create `test/value-averaging.test.js`.
    - Mock `currentState` with known values.
    - Assert `calculateRebalance` output matches expected math.

## 6. Deployment

- **Node Version:** 18+ (ES Modules).
- **Process Manager:** Cron is used (`setup-cron`), but `pm2` or `systemd` could be used for a daemon approach.
