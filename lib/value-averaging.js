// Value Averaging Calculation Engine

/**
 * Value Averaging (VA) Strategy Implementation
 * 
 * Unlike DCA (fixed amount), VA adjusts investment to maintain a target value path.
 * If portfolio is below target: BUY more
 * If portfolio is above target: SELL or reduce buying
 * 
 * Key Formula:
 * Target Value(t) = Initial Investment + (t × Growth Rate × Initial Investment)
 * Investment Amount = Target Value(t) - Current Value
 */

export class ValueAverager {
  constructor(config) {
    this.initialCapital = config.initialCapital
    this.targetGrowthRate = config.targetGrowthRate
    this.rebalanceThreshold = config.rebalanceThreshold
    this.startDate = null
    this.targetBtcAllocation = config.targetBtcAllocation
  }

  /**
   * Initialize with start date (usually first trade date)
   */
  initialize(startDate = new Date()) {
    this.startDate = startDate
    return this
  }

  /**
   * Calculate target value for current time
   * Target grows linearly based on growth rate
   */
  getTargetValue(currentDate = new Date()) {
    if (!this.startDate) {
      throw new Error('ValueAverager not initialized with start date')
    }

    // Time elapsed in months
    const msPerMonth = 30.44 * 24 * 60 * 60 * 1000
    const monthsElapsed = (currentDate - this.startDate) / msPerMonth

    // Linear growth path
    const targetValue = this.initialCapital * (1 + this.targetGrowthRate * monthsElapsed)
    
    return Math.floor(targetValue)
  }

  /**
   * Calculate target BTC stack size based on current price
   * Target is to maintain targetBtcAllocation % of portfolio in BTC
   */
  getTargetBtcStack(currentPrice, currentDate = new Date()) {
    const targetPortfolioValue = this.getTargetValue(currentDate)
    const targetBtcSats = targetPortfolioValue * this.targetBtcAllocation
    
    return Math.floor(targetBtcSats)
  }

  /**
   * Calculate current portfolio value in sats
   * 
   * @param {number} totalEquitySats - Total account equity in sats
   * @returns {number} Total portfolio value in sats
   */
  getCurrentValue(totalEquitySats) {
    return totalEquitySats
  }

  /**
   * Determine if rebalance is needed and calculate trade size
   * 
   * @returns {Object} { needsRebalance, action, quantityUsd, reasoning }
   */
  calculateRebalance(currentState, currentPrice, currentDate = new Date()) {
    const { totalEquitySats, netPositionSats } = currentState

    // Current portfolio metrics
    const currentValue = this.getCurrentValue(totalEquitySats)
    
    // Current BTC Exposure = Equity (held in BTC) + Net Position (Long adds, Short subtracts)
    const currentBtcValueSats = totalEquitySats + netPositionSats
    
    // Target metrics
    const targetValue = this.getTargetValue(currentDate)
    const targetBtcSats = this.getTargetBtcStack(currentPrice, currentDate)

    // Calculate deviations
    const valueDeviation = (currentValue - targetValue) / targetValue
    const btcDeviation = (currentBtcValueSats - targetBtcSats) / targetBtcSats

    // Determine action based on BTC allocation deviation
    const needsRebalance = Math.abs(btcDeviation) > this.rebalanceThreshold

    if (!needsRebalance) {
      return {
        needsRebalance: false,
        action: 'hold',
        quantityUsd: 0,
        reasoning: `On target. BTC deviation: ${(btcDeviation * 100).toFixed(2)}% (threshold: ${(this.rebalanceThreshold * 100).toFixed(0)}%)`,
        metrics: {
          currentValue,
          targetValue,
          currentBtcValueSats,
          targetBtcSats,
          valueDeviation,
          btcDeviation,
        }
      }
    }

    // Calculate trade quantity
    const btcDiffSats = targetBtcSats - currentBtcValueSats
    const btcDiffBtc = btcDiffSats / 100_000_000
    const quantityUsd = Math.abs(btcDiffBtc * currentPrice)

    const action = btcDiffSats > 0 ? 'b' : 's'
    const reasoning = btcDiffSats > 0 
      ? `Below target. Need ${btcDiffSats.toLocaleString()} more sats. BTC deviation: ${(btcDeviation * 100).toFixed(2)}%`
      : `Above target. Need to reduce by ${Math.abs(btcDiffSats).toLocaleString()} sats. BTC deviation: ${(btcDeviation * 100).toFixed(2)}%`

    return {
      needsRebalance: true,
      action,
      quantityUsd: Math.floor(quantityUsd),
      quantitySats: Math.abs(btcDiffSats),
      reasoning,
      metrics: {
        currentValue,
        targetValue,
        currentBtcValueSats,
        targetBtcSats,
        valueDeviation,
        btcDeviation,
        currentPrice,
      }
    }
  }

  /**
   * Calculate expected fees for a trade
   */
  estimateFees(quantityUsd, feeRate = 0.001) {
    // Round trip: open + close
    const roundTripFeeRate = feeRate * 2
    
    // Convert USD quantity to sats cost
    const openFeeSats = (quantityUsd * roundTripFeeRate * 100_000_000) / 100_000_000
    const closeFeeSats = openFeeSats
    
    return {
      openFee: Math.ceil(openFeeSats),
      closeFee: Math.ceil(closeFeeSats),
      totalFee: Math.ceil(openFeeSats + closeFeeSats),
      feeRate,
      roundTripFeeRate,
    }
  }

  /**
   * Generate performance report
   */
  generateReport(currentState, currentPrice, currentDate = new Date()) {
    const { totalEquitySats, netPositionSats } = currentState
    const currentValue = this.getCurrentValue(totalEquitySats)
    const targetValue = this.getTargetValue(currentDate)
    
    const totalReturn = currentValue - this.initialCapital
    const totalReturnPct = (totalReturn / this.initialCapital) * 100
    
    const vsTarget = currentValue - targetValue
    const vsTargetPct = (vsTarget / targetValue) * 100
    
    const daysRunning = (currentDate - this.startDate) / (1000 * 60 * 60 * 24)
    const annualizedReturn = (totalReturnPct / daysRunning) * 365
    
    // Current BTC Exposure
    const currentBtcValueSats = totalEquitySats + netPositionSats

    return {
      currentValue,
      targetValue,
      initialCapital: this.initialCapital,
      totalReturn,
      totalReturnPct,
      vsTarget,
      vsTargetPct,
      daysRunning: Math.floor(daysRunning),
      annualizedReturn,
      btcStackSats: currentBtcValueSats,
      btcStackGrowth: currentBtcValueSats - (this.initialCapital * this.targetBtcAllocation),
      btcStackGrowthPct: ((currentBtcValueSats / (this.initialCapital * this.targetBtcAllocation)) - 1) * 100,
    }
  }
}

export default ValueAverager
