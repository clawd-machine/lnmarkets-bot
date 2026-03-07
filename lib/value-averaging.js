
/**
 * Value Averaging (VA) Strategy for LNMarkets Inverse Futures
 *
 * === Key Concepts ===
 *
 * Investment Value (IV): The unhedged BTC exposure, measured in USD.
 *   Formula: IV = (TotalEquitySats / 1e8 * Price) + NetPositionUsd
 *   Where NetPositionUsd is negative for Short positions.
 *   This is the value we are growing via Value Averaging.
 *
 * Dry Powder (DP): The hedged portion, kept stable in USD via Short positions.
 *   Formula: DP = -NetPositionUsd (when NetPositionUsd is negative)
 *   This is the reserve capital used to buy dips.
 *
 * Total Value (TV): IV + DP = (TotalEquitySats / 1e8 * Price)
 *   Used for reporting only, NOT for rebalancing targets.
 *
 * === Strategy ===
 *
 * 1. Target IV grows over time at a configurable daily rate.
 * 2. Limit orders are placed at prices where IV deviates by +/- threshold.
 * 3. When triggered, we trade enough contracts to restore IV to target.
 *
 * === Critical Property (Inverse Futures + Static Hedge) ===
 *
 * Because the hedge is denominated in USD (fixed), and equity is in BTC,
 * the Investment Value scales LINEARLY with BTC price:
 *
 *   IV_new / IV_old = Price_new / Price_old
 *   Price_new = Price_old * (IV_new / IV_old)
 *
 * This means trigger prices are simply:
 *   TriggerPrice = CurrentPrice * (TargetIV * (1 ± Threshold)) / CurrentIV
 *
 * And rebalance quantities are simply:
 *   Quantity = TargetIV * Threshold (in USD contracts)
 */

export class ValueAverager {
  constructor(config) {
    this.initialBtcValueUsd = config.initial_btc_value_usd
    this.targetGrowthRateDaily = config.target_growth_rate_daily
    this.limitOrderThreshold = config.limit_order_threshold
    // Default to 5% if not specified in config
    this.marketRebalanceThreshold = config.market_rebalance_threshold || 0.05
    this.initialCapital = config.initialCapital // Add initialCapital to constructor
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
   * Value = (EquitySats * Price / 1e8) + NetPositionUsd
   *
   * @param {number} totalEquitySats - Total account equity in sats (available + margin)
   * @param {number} currentPrice - Current BTC/USD price
   * @param {number} netPositionUsd - Current net position in USD (Long +, Short -)
   */
  getCurrentBtcValueUSD(totalEquitySats, currentPrice, netPositionUsd) {
    // Ensure inputs are valid numbers; default to 0 if not
    const safeTotalEquitySats = typeof totalEquitySats === 'number' && isFinite(totalEquitySats) ? totalEquitySats : 0;
    const safeCurrentPrice = typeof currentPrice === 'number' && isFinite(currentPrice) ? currentPrice : 0;
    const safeNetPositionUsd = typeof netPositionUsd === 'number' && isFinite(netPositionUsd) ? netPositionUsd : 0;


    const equityUsd = (safeTotalEquitySats / 100_000_000) * safeCurrentPrice
    // NetPositionUsd is signed (Buy +, Sell -).
    // For a Hedge (Short): Value = TotalEquityUsd + (-HedgeAmount)
    return equityUsd + safeNetPositionUsd
  }

  /**
   * Calculate rebalance decision for Value Averaging.
   * 
   * This method is primarily for reporting and status checks, as the core
   * rebalancing logic is handled by limit orders.
   */
  calculateRebalance(currentState, currentPrice) {
    const { totalEquitySats, netPositionUsd } = currentState
    const currentDate = new Date()

    const targetBtcValueUSD = this.getTargetBtcValueUSD(currentDate)
    const currentBtcValueUSD = this.getCurrentBtcValueUSD(totalEquitySats, currentPrice, netPositionUsd || 0)
    const deviation = (currentBtcValueUSD - targetBtcValueUSD) / targetBtcValueUSD

    // Metrics object for logging
    const metrics = {
      currentValue: currentBtcValueUSD,
      targetValue: targetBtcValueUSD,
      btcDeviation: deviation,
      valueDeviation: deviation,
      // Legacy fields to prevent crash
      currentBtcSats: totalEquitySats,
      targetBtcSats: (targetBtcValueUSD / currentPrice) * 100_000_000
    }

    // New Logic: Limit Orders handle the rebalancing.
    // The "rebalance" check here is just for status reporting.
    // We return 'needsRebalance: false' because the bot.js loop handles limit orders separately.
    // OR we can perform an immediate market rebalance if deviation is extreme?
    // For now, let's just report status.

    // We can add a check for extreme deviations that might warrant immediate market action.
    // Updated to match user expectation: Market rebalance threshold from config
    const needsMarketRebalance = Math.abs(deviation) > this.marketRebalanceThreshold;

    let action = 'hold';
    let reasoning = `Deviation ${(deviation * 100).toFixed(2)}% within limit order range`;
    let quantityUsd = 0;

    if (needsMarketRebalance) {
      action = 'market_rebalance';
      reasoning = `Deviation ${(deviation * 100).toFixed(2)}% exceeds extreme threshold (${(this.marketRebalanceThreshold * 100).toFixed(1)}%). Triggering market rebalance.`;
      // For market rebalance, we want to close the gap significantly but maybe not 100% to avoid overshooting if price moves.
      // Standard VA trades the full deviation to get back to target.
      // Truncate towards zero for safety.
      quantityUsd = -Math.trunc(targetBtcValueUSD * deviation); 
    }

    return {
      needsRebalance: needsMarketRebalance,
      action: action,
      reasoning: reasoning,
      metrics: metrics,
      quantityUsd: quantityUsd
    }
  }

  /**
   * Generate a comprehensive performance report for Value Averaging.
   */
  generateReport(currentState, currentPrice, currentDate = new Date()) {
    if (!this.startDate) {
      // If startDate is not set, return default values to avoid errors
      console.warn('ValueAverager startDate not set, returning default report values.');
      return {
        daysRunning: 0,
        totalReturnPct: 0,
        totalReturn: 0,
        annualizedReturn: 0,
        vsTargetPct: 0,
        btcStackSats: 0,
        btcStackGrowthPct: 0,
        targetValue: 0,
        currentValue: 0,
      };
    }

    const { totalEquitySats, netPositionUsd, btcStackSats } = currentState;

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysElapsed = (currentDate - this.startDate) / msPerDay;
    
    // Ensure daysElapsed is a finite number, default to 0 if not
    const safeDaysRunning = isNaN(daysElapsed) || !isFinite(daysElapsed) ? 0 : daysElapsed;

    const targetValue = this.getTargetBtcValueUSD(currentDate);
    const currentBtcValueUSD = this.getCurrentBtcValueUSD(totalEquitySats, currentPrice, netPositionUsd || 0);

    // Use initialBtcValueUsd as the baseline for returns, as that's the unhedged component.
    // Ensure initialBtcValueUsd is not zero or undefined before calculating percentages.
    const initialIVUsd = (typeof this.initialBtcValueUsd === 'number' && isFinite(this.initialBtcValueUsd) && this.initialBtcValueUsd !== 0) ? this.initialBtcValueUsd : 1; // Use 1 as a safe default if initial IV is zero or invalid to prevent division by zero.
    
    const totalReturn = currentBtcValueUSD - initialIVUsd;

    // Calculate totalReturnPct safely, handling cases where initialIVUsd might be zero.
    const totalReturnPct = (initialIVUsd === 0 || !isFinite(initialIVUsd)) ? 0 : (totalReturn / initialIVUsd) * 100;

    // Annualized return calculation, ensuring safeDaysRunning is used.
    const annualizedReturn = safeDaysRunning > 0 && totalReturnPct !== 0 && isFinite(totalReturnPct) ? (totalReturnPct / safeDaysRunning * 365.25) : 0;

    // Calculate vsTargetPct safely, handling cases where targetValue might be zero.
    const vsTargetPct = (targetValue === 0 || !isFinite(targetValue)) ? 0 : ((currentBtcValueUSD - targetValue) / targetValue) * 100;

    // BTC stack growth percentage relative to the initial unhedged BTC value.
    // This calculation requires the initial BTC price at the start date, which isn't stored.
    // For now, we'll calculate growth based on the USD value of the Investment Value (IV).
    // A more precise BTC growth would need initial BTC price.
    // We use initialIVUsd (which is potentially floored at 1 if original was 0) as a baseline.
    const initialIVInCurrentBtcSats = (initialIVUsd / currentPrice) * 100_000_000; // Use initialIVUsd here
    const currentIVInCurrentBtcSats = (currentBtcValueUSD / currentPrice) * 100_000_000;
    const btcStackGrowthPct = (initialIVInCurrentBtcSats === 0 || !isFinite(initialIVInCurrentBtcSats)) ? 0 : ((currentIVInCurrentBtcSats - initialIVInCurrentBtcSats) / initialIVInCurrentBtcSats) * 100;

    // Ensure all returned numbers are finite and formatted
    const portfolioValueUsd = (totalEquitySats / 100_000_000) * currentPrice; // Total Net Wealth (IV + Dry Powder)

    // Ensure all returned numbers are finite and formatted
    return {
      daysRunning: parseFloat(safeDaysRunning.toFixed(2)),
      totalReturnPct: parseFloat(isNaN(totalReturnPct) || !isFinite(totalReturnPct) ? 0 : totalReturnPct.toFixed(2)),
      totalReturn: parseFloat(isNaN(totalReturn) || !isFinite(totalReturn) ? 0 : totalReturn.toFixed(2)), // in USD
      annualizedReturn: parseFloat(isNaN(annualizedReturn) || !isFinite(annualizedReturn) ? 0 : annualizedReturn.toFixed(1)),
      vsTargetPct: parseFloat(isNaN(vsTargetPct) || !isFinite(vsTargetPct) ? 0 : vsTargetPct.toFixed(2)),
      btcStackSats: typeof btcStackSats === 'number' && isFinite(btcStackSats) ? btcStackSats : 0, // Total effective BTC exposure in sats
      btcStackGrowthPct: parseFloat(isNaN(btcStackGrowthPct) || !isFinite(btcStackGrowthPct) ? 0 : btcStackGrowthPct.toFixed(2)),
      targetValue: parseFloat(isNaN(targetValue) || !isFinite(targetValue) ? 0 : targetValue.toFixed(2)), // in USD
      currentValue: parseFloat(isNaN(currentBtcValueUSD) || !isFinite(currentBtcValueUSD) ? 0 : currentBtcValueUSD.toFixed(2)), // in USD
      portfolioValueUsd: parseFloat(isNaN(portfolioValueUsd) || !isFinite(portfolioValueUsd) ? 0 : portfolioValueUsd.toFixed(2)), // in USD
    };
  }

  /**
   * Estimate fees for a trade
   * @param {number} quantityUsd - Size of trade in USD
   * @param {number} feeRate - Fee rate (e.g. 0.001 for 0.1%)
   * @param {number} currentPrice - Current BTC price (optional, for sat conversion)
   */
  estimateFees(quantityUsd, feeRate, currentPrice = 60000) {
     // LNMarkets Inverse Futures:
     // Notional = Quantity / Price (in BTC)
     // Fee = Notional * FeeRate
     
     const qty = Math.abs(quantityUsd)
     const notionalBtc = qty / currentPrice
     const feeBtc = notionalBtc * feeRate
     const feeSats = Math.floor(feeBtc * 100_000_000)
     
     return {
         openFee: feeSats,
         closeFee: feeSats, // Estimate close fee same as open
         totalFee: feeSats * 2,
         roundTripFeeRate: feeRate * 2
     }
  }

  /**
   * Calculate the BTC price where deviation hits the threshold.
   *
   * Logic for Inverse Futures with Static Hedge:
   * The "Investment Value" (IV) represents the unhedged BTC exposure.
   * This exposure scales linearly with BTC Price.
   *
   * IV_new / IV_old = Price_new / Price_old
   * Price_new = Price_old * (IV_new / IV_old)
   *
   * @param {number} targetBtcValueUSD - The baseline target value
   * @param {number} currentBtcValueUSD - The current unhedged value
   * @param {number} currentPrice - Current BTC price
   * @param {number} threshold - Deviation threshold (+/-)
   */
  calculateTriggerPrice(targetBtcValueUSD, currentBtcValueUSD, currentPrice, threshold) {
    // Ensure all inputs are valid numbers, default to 0 if not
    const safeTargetBtcValueUSD = typeof targetBtcValueUSD === 'number' && isFinite(targetBtcValueUSD) ? targetBtcValueUSD : 0;
    const safeCurrentBtcValueUSD = typeof currentBtcValueUSD === 'number' && isFinite(currentBtcValueUSD) ? currentBtcValueUSD : 0;
    const safeCurrentPrice = typeof currentPrice === 'number' && isFinite(currentPrice) ? currentPrice : 0;
    const safeThreshold = typeof threshold === 'number' && isFinite(threshold) ? threshold : 0;


    // Special case: If Current Value is 0 (Fully Hedged), any target > 0 means infinite deviation.
    // In this case, price action won't restore value (since IV stays 0).
    // We return currentPrice so a limit order is placed effectively at market (or near it).
    if (safeCurrentBtcValueUSD === 0) return safeCurrentPrice;

    // Target Value Limit = Target * (1 + Threshold)
    const targetLimit = safeTargetBtcValueUSD * (1 + safeThreshold)
    
    // Calculate price where IV hits this limit
    return safeCurrentPrice * (targetLimit / safeCurrentBtcValueUSD)
  }

  /**
   * Calculate the contract quantity needed to restore IV to target.
   *
   * At the trigger point, IV has deviated by exactly (Target * Threshold).
   * To restore IV back to the target, we trade that deviation amount.
   *
   * Returns: Signed USD amount (contract quantity).
   *   Negative = Sell/Short (hedge more, reduce IV)
   *   Positive = Buy/Long (close hedge, increase IV)
   *
   * Examples (Target $100, Threshold 4%):
   *   Sell trigger (+0.04): IV is $104, sell $4 -> returns -4
   *   Buy trigger  (-0.04): IV is $96,  buy $4 -> returns +4
   *
   * Enforces minimum of $2 to meet API requirements.
   *
   * @param {number} targetBtcValueUSD - The target IV we want to restore to
   * @param {number} threshold - Signed threshold (+0.04 for sell, -0.04 for buy)
   */
  calculateRebalanceQuantity(targetBtcValueUSD, threshold) {
    // Ensure inputs are valid numbers
    const safeTargetBtcValueUSD = typeof targetBtcValueUSD === 'number' && isFinite(targetBtcValueUSD) ? targetBtcValueUSD : 0;
    const safeThreshold = typeof threshold === 'number' && isFinite(threshold) ? threshold : 0;

    // Deviation = Target * Threshold (positive when over, negative when under)
    // To correct: trade the negative of the deviation
    const rawQuantity = -(safeTargetBtcValueUSD * safeThreshold)
    
    // Enforce $2 minimum (API requirement)
    const minQuantity = 2
    if (Math.abs(rawQuantity) < minQuantity) {
        return rawQuantity >= 0 ? minQuantity : -minQuantity
    }
    
    return rawQuantity
  }

  /**
   * Get limit order configurations
   */
  getLimitOrderConfigs(currentState, currentDate = new Date()) {
    const { totalEquitySats, netPositionUsd, currentPrice } = currentState
    const targetBtcValueUSD = this.getTargetBtcValueUSD(currentDate)
    const currentBtcValueUSD = this.getCurrentBtcValueUSD(totalEquitySats, currentPrice, netPositionUsd || 0)

    // 1. Buy Trigger (Price drops, Value drops below target)
    // Threshold is negative (e.g. -0.04)
    const buyThreshold = -this.limitOrderThreshold
    let buyPrice = this.calculateTriggerPrice(targetBtcValueUSD, currentBtcValueUSD, currentPrice, buyThreshold)
    const buyQty = this.calculateRebalanceQuantity(targetBtcValueUSD, buyThreshold)

    // Clamp buy price if already below threshold
    if (buyPrice >= currentPrice) {
        buyPrice = currentPrice * 0.999;
    }
    buyPrice = Math.max(1, buyPrice);

    // 2. Sell Trigger (Price rises, Value goes above target)
    // Threshold is positive (e.g. +0.04)
    const sellThreshold = this.limitOrderThreshold
    let sellPrice = this.calculateTriggerPrice(targetBtcValueUSD, currentBtcValueUSD, currentPrice, sellThreshold)
    const sellQty = this.calculateRebalanceQuantity(targetBtcValueUSD, sellThreshold)

    // Clamp sell price if already above threshold
    if (sellPrice <= currentPrice) {
        sellPrice = currentPrice * 1.001;
    }
    sellPrice = Math.max(1, sellPrice);

    return {
      targetBtcValueUSD,
      buyOrder: {
        price: Math.floor(buyPrice),
        quantity: Math.floor(buyQty),
        type: 'l'
      },
      sellOrder: {
        price: Math.floor(sellPrice),
        quantity: Math.floor(sellQty),
        type: 'l'
      }
    }
  }
}
