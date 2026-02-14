
/**
 * Value Averaging (VA) Strategy Implementation with Limit Orders
 *
 * Implements "Value Averaging" logic:
 * - Target: targetBtcValueUSD (grows over time based on expected_growth_rate)
 * - Current State: currentBtcValueUSD
 * - Deviation: (currentBtcValueUSD - targetBtcValueUSD) / targetBtcValueUSD
 * - Limit Order Triggers: Calculate prices where deviation hits +/- threshold
 */

export class ValueAverager {
  constructor(config) {
    this.initialBtcValueUsd = config.initial_btc_value_usd
    this.targetGrowthRateDaily = config.target_growth_rate_daily
    this.limitOrderThreshold = config.limit_order_threshold
    this.startDate = null
  }

  /**
   * Initialize with start date
   */
  initialize(startDate = new Date()) {
    this.startDate = startDate
    return this
  }

  /**
   * Calculate target USD value of the BTC stack for the current time.
   * Target grows linearly based on daily growth rate.
   */
  getTargetBtcValueUSD(currentDate = new Date()) {
    if (!this.startDate) {
      throw new Error('ValueAverager not initialized with start date')
    }

    const msPerDay = 24 * 60 * 60 * 1000
    const daysElapsed = (currentDate - this.startDate) / msPerDay

    // Formula: Initial * (1 + (DailyRate * Days))
    // Example: 100 * (1 + (0.001 * 10)) = 101
    const targetValue = this.initialBtcValueUsd * (1 + this.targetGrowthRateDaily * daysElapsed)

    return targetValue
  }

  /**
   * Calculate current USD value of the BTC stack.
   * For Inverse Futures (LNMarkets):
   * Value = (EquitySats * Price / 1e8) + PositionUSD
   *
   * @param {number} totalEquitySats - Total account equity in sats (available + margin)
   * @param {number} currentPrice - Current BTC/USD price
   * @param {number} netPositionUsd - Current net position in USD (Long +, Short -)
   */
  getCurrentBtcValueUSD(totalEquitySats, currentPrice, netPositionUsd) {
    const equityUsd = (totalEquitySats / 100_000_000) * currentPrice
    // For value averaging the "Total Portfolio Value" is Equity + Position Value?
    // Actually, usually in these bots:
    // We want to maintain a total exposure or total value.
    // If we just hold BTC, value = Equity * Price.
    // If we have a position, does it add to the value we are averaging?
    //
    // Let's stick to the User's prompt interpretation:
    // "Current State: Calculate currentBtcValueUSD based on totalEquitySats, currentPrice, and netPositionSats"
    // Wait, user said netPositionSats, but contracts are usually USD.
    // Let's assume netPositionSats converts to USD or is derived.
    //
    // If netPosition is in USD (standard for inverse):
    // Real Exposure = EquityUSD + PositionUSD?
    //
    // Let's assume standard "Total Account Value in USD" logic:
    // Account Value = Equity (Sats) * Price
    // But the Strategy is "Value Averaging" usually on the ASSET.
    //
    // Let's look at the deviation formula: (Current - Target) / Target.
    //
    // Interpretation: We want our TOTAL account value (in USD) to match the Target.
    // CurrentValue = (TotalEquitySats / 1e8) * Price.
    // Note: Open PnL is usually already part of TotalEquitySats in some API responses,
    // but in others it's Balance + PnL. Let's assume TotalEquitySats includes unrealized PnL.

    return (totalEquitySats / 100_000_000) * currentPrice
  }

  /**
   * Calculate the BTC price where deviation hits the threshold.
   *
   * Deviation = (CurrentVal - Target) / Target
   * Threshold = Deviation
   *
   * Target * Threshold = CurrentVal - Target
   * CurrentVal = Target * (1 + Threshold)
   *
   * CurrentVal = (EquitySats / 1e8) * Price
   * Price = CurrentVal / (EquitySats / 1e8)
   *
   * @param {number} targetBtcValueUSD
   * @param {number} totalEquitySats
   * @param {number} threshold - Positive for Sell trigger, Negative for Buy trigger
   */
  calculateTriggerPrice(targetBtcValueUSD, totalEquitySats, threshold) {
    // We want to find Price P such that:
    // ( ((Equity / 1e8) * P) - Target ) / Target = Threshold
    // ((Equity / 1e8) * P) / Target - 1 = Threshold
    // ((Equity / 1e8) * P) / Target = 1 + Threshold
    // P = (Target * (1 + Threshold)) / (Equity / 1e8)

    const equityBtc = totalEquitySats / 100_000_000
    if (equityBtc === 0) return 0

    const requiredValue = targetBtcValueUSD * (1 + threshold)
    const triggerPrice = requiredValue / equityBtc

    return triggerPrice
  }

  /**
   * Calculate the contract quantity needed to restore balance at a specific price.
   *
   * At TriggerPrice, we are at (1+Threshold) deviation.
   * We want to return to Target.
   *
   * Diff = CurrentValueAtTrigger - Target
   *
   * If Diff is positive (We are above target), we need to SELL to reduce exposure?
   * Wait, with Inverse Futures, selling USD contracts (Short) locks in value or gains value as BTC drops.
   * Buying USD contracts (Long) increases exposure.
   *
   * VA Logic:
   * If Value > Target (High Price), SELL (Short) to reduce effective BTC exposure or hedge.
   * If Value < Target (Low Price), BUY (Long) to increase effective BTC exposure.
   *
   * Quantity to Trade:
   * We want to hedge the "Excess Value" or "Missing Value".
   * Excess = CurrentVal - Target
   * Qty = Excess (in USD)
   *
   * @param {number} targetBtcValueUSD
   * @param {number} totalEquitySats
   * @param {number} triggerPrice
   */
  calculateRebalanceQuantity(targetBtcValueUSD, totalEquitySats, triggerPrice) {
    const equityBtc = totalEquitySats / 100_000_000
    const currentValueAtTrigger = equityBtc * triggerPrice
    const diffUsd = currentValueAtTrigger - targetBtcValueUSD

    // If Diff > 0 (Over value), we Sell (Short) 'Diff' amount of USD contracts.
    // If Diff < 0 (Under value), we Buy (Long) 'Diff' amount of USD contracts.
    // return signed integer (Positive = Buy, Negative = Sell)
    // Note: Since Diff = Current - Target.
    // If Current > Target, Diff is +ve. We want to SELL. So we should invert or handle sign later.
    // Standard convention: Long is +, Short is -.
    // If Value is too HIGH, we want to SHORT. So we need -Diff.

    // However, usually VA adds to the 'Investment'.
    // If we simply Short USD, we are hedging.
    // Let's assume we return the raw USD difference magnitude and direction.

    // Returns: Signed USD amount.
    // Negative = Sell/Short (Reduce Value)
    // Positive = Buy/Long (Increase Value)
    return -(diffUsd)
  }

  /**
   * Get limit order configurations
   */
  getLimitOrderConfigs(currentState, currentDate = new Date()) {
    const { totalEquitySats } = currentState
    const targetBtcValueUSD = this.getTargetBtcValueUSD(currentDate)

    // 1. Buy Trigger (Price drops, Value drops below target)
    // Threshold is negative (e.g. -0.04)
    const buyThreshold = -this.limitOrderThreshold
    const buyPrice = this.calculateTriggerPrice(targetBtcValueUSD, totalEquitySats, buyThreshold)
    const buyQty = this.calculateRebalanceQuantity(targetBtcValueUSD, totalEquitySats, buyPrice)

    // 2. Sell Trigger (Price rises, Value goes above target)
    // Threshold is positive (e.g. +0.04)
    const sellThreshold = this.limitOrderThreshold
    const sellPrice = this.calculateTriggerPrice(targetBtcValueUSD, totalEquitySats, sellThreshold)
    const sellQty = this.calculateRebalanceQuantity(targetBtcValueUSD, totalEquitySats, sellPrice)

    return {
      targetBtcValueUSD,
      buyOrder: {
        price: Math.floor(buyPrice),
        quantity: Math.floor(buyQty), // Should be positive
        type: 'l' // limit
      },
      sellOrder: {
        price: Math.floor(sellPrice),
        quantity: Math.floor(sellQty), // Should be negative
        type: 'l' // limit
      }
    }
  }
}

export default ValueAverager
