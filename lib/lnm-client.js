// LNMarkets API Client Wrapper

import { createHttpClient } from '@ln-markets/sdk/v3'
import fs from 'fs/promises'

export class LNMClient {
  constructor(config) {
    this.config = config
    this.client = null
    this.credentials = null
  }

  /**
   * Load credentials from file
   */
  async loadCredentials() {
    try {
      const data = await fs.readFile(this.config.credentialsFile, 'utf8')
      this.credentials = JSON.parse(data)

      if (!this.credentials.key || !this.credentials.secret || !this.credentials.passphrase) {
        throw new Error('Missing credentials: key, secret, or passphrase')
      }

      return this.credentials
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Credentials file not found: ${this.config.credentialsFile}. Create it with your LNMarkets API key, secret, and passphrase.`)
      }
      throw error
    }
  }

  /**
   * Initialize the API client
   */
  async initialize() {
    if (!this.credentials) {
      await this.loadCredentials()
    }

    this.client = createHttpClient({
      key: this.credentials.key,
      secret: this.credentials.secret,
      passphrase: this.credentials.passphrase,
      network: this.config.lnmarkets.network,
    })

    return this
  }

  /**
   * Get account balance and info
   */
  async getBalance() {
    if (!this.client) await this.initialize()

    const user = await this.client.account.get()    
    if (this.config.debug) console.log('DEBUG: account.get() response:', JSON.stringify(user, null, 2))

    // In Isolated Margin mode, user.balance is the "Cash Balance" (excluding margin)
    // Total Wallet Balance = Cash Balance + Margin Used
    // Available Balance = Cash Balance (since margin is already deducted)

    const marginUsed = user.margin_total || user.marginTotal || 0
    const cashBalance = user.balance
    const totalWalletBalance = cashBalance + marginUsed

    return {
      balance: cashBalance,
      totalWalletBalance: totalWalletBalance,
      syntheticUsdBalance: user.synthetic_usd_balance || 0,
      availableBalance: cashBalance,
      marginUsed: marginUsed,
      unrealizedPnL: user.unrealized_pl || 0,
    }
  }

  /**
   * Get current BTC/USD price
   */
  async getCurrentPrice() {
    if (!this.client) await this.initialize()

    // Get ticker data
    let ticker
    try {
      ticker = await this.client.futures.getTicket()
      if (this.config.debug) console.log('DEBUG: Raw Ticker Response:', JSON.stringify(ticker, null, 2))
    } catch (error) {
      console.error('ERROR: Failed to fetch ticker data:', error.message)
      // Return a default structure with 0 prices to prevent NaN errors downstream
      return {
        lastPrice: 0,
        index: 0,
        bid: 0,
        ask: 0,
        fundingRate: 0,
      }
    }

    // Check if last_price is available and a valid number
    // Check if lastPrice is available and a valid number
    const parsedLastPrice = parseFloat(ticker.lastPrice);
    const lastPrice = (ticker && !isNaN(parsedLastPrice))
      ? parsedLastPrice
      : 0; // Default to 0 if invalid, or throw an error based on desired behavior

    if (lastPrice === 0) {
      console.warn('WARNING: ticker.lastPrice is invalid or not available. Using 0 as currentPrice.');
    }

    return {
      lastPrice: lastPrice,
      index: parseFloat(ticker.index || 0),
      bid: parseFloat(ticker.prices?.[0]?.bidPrice || ticker.bidPrice || 0),
      ask: parseFloat(ticker.prices?.[0]?.askPrice || ticker.askPrice || 0),
      fundingRate: parseFloat(ticker.fundingRate || ticker.carryFeeRate || 0),
    }
  }

  /**
   * Get all open positions
   */
  async getPositions() {
    if (!this.client) await this.initialize()

    const positions = await this.client.futures.isolated.getRunningTrades()

    return positions.map(pos => ({
      id: pos.id,
      side: pos.side,
      quantity: pos.quantity,
      leverage: pos.leverage,
      entryPrice: parseFloat(pos.entry_price || pos.entryPrice),
      liquidationPrice: parseFloat(pos.liquidation || pos.liquidationPrice),
      margin: pos.margin,
      pnl: pos.pl || pos.pnl || 0,
      openingFee: pos.opening_fee || pos.openingFee,
      runningTime: pos.created_at || pos.createdAt || (pos.creation_ts ? new Date(pos.creation_ts).toISOString() : null),
      sumCarryFees: pos.sumFundingFees || pos.sum_funding_fees || pos.sumCarryFees || pos.sum_carry_fees || 0,
    }))
  }

  /**
   * Get all open limit orders
   */
  async getOpenOrders() {
    if (!this.client) await this.initialize()

    // LNMarkets SDK: getOpenTrades fetches open limit orders
    const orders = await this.client.futures.isolated.getOpenTrades()

    return orders.map(order => ({
      id: order.id,
      side: order.side,
      quantity: order.quantity,
      price: parseFloat(order.price),
      leverage: order.leverage,
      margin: order.margin,
      created_at: order.created_at,
    }))
  }

  /**
   * Cancel a specific order
   */
  async cancelOrder(orderId) {
    if (!this.client) await this.initialize()
    return await this.client.futures.isolated.cancel({ id: orderId })
  }

  /**
   * Place a new order (limit or market)
   */
  async newOrder(params) {
    if (!this.client) await this.initialize()

    // V3 API uses different parameter names:
    // - type: 'market' or 'limit' (not 'm' or 'l')
    // - side: 'buy' or 'sell' (not 'b' or 's')
    // - Market orders: 'quantity' field (in sats)
    // - Limit orders: 'margin' field (in sats) + 'price'
    
    const orderType = params.type === 'l' ? 'limit' : (params.type === 'm' ? 'market' : params.type)
    const orderSide = params.side === 'b' ? 'buy' : (params.side === 's' ? 'sell' : params.side)
    
    const orderParams = {
      type: orderType,
      side: orderSide,
      leverage: params.leverage || 1,
    }

    if (orderType === 'limit') {
        // Limit orders use 'margin' + 'price'
        orderParams.margin = Math.floor(params.quantity)
        if (params.price) {
            orderParams.price = Math.floor(params.price)
        }
    } else {
        // Market orders use 'quantity'
        orderParams.quantity = Math.floor(params.quantity)
    }

    if (this.config.debug) console.log('DEBUG: Sending newTrade request:', JSON.stringify(orderParams, null, 2))

    const result = await this.client.futures.isolated.newTrade(orderParams)

    if (this.config.debug) console.log('DEBUG: newTrade request:', JSON.stringify(orderParams, null, 2))
    if (this.config.debug) console.log('DEBUG: newTrade response:', JSON.stringify(result, null, 2))

    return {
      id: result.id,
      side: result.side,
      quantity: result.quantity || result.margin,
      entryPrice: parseFloat(result.price || result.entryPrice || 0),
      price: parseFloat(result.price || result.entryPrice || 0),
      leverage: result.leverage,
      margin: result.margin || 0,
      openingFee: result.openingFee || result.opening_fee || 0
    }
  }

  /**
   * Open a new position
   *
   * @param {Object} params
   * @param {string} params.side - 'b' (buy) or 's' (sell)
   * @param {number} params.quantity - Position size in USD
   * @param {number} params.leverage - Leverage multiplier (1-100)
   * @param {number} params.takeProfit - Optional take profit price
   * @param {number} params.stopLoss - Optional stop loss price
   */
  async openPosition({ side, quantity, leverage = 1, takeProfit = null, stopLoss = null }) {
    if (!this.client) await this.initialize()

    const params = {
      type: 'm',
      side,
      quantity: Math.floor(quantity),
      leverage,
    }

    if (takeProfit) params.takeprofit = takeProfit
    if (stopLoss) params.stoploss = stopLoss

    const result = await this.client.futures.isolated.newTrade(params)

    return {
      id: result.id,
      side: result.side,
      quantity: result.quantity,
      entryPrice: parseFloat(result.price),
      margin: result.margin,
      leverage: result.leverage,
      openingFee: result.opening_fee,
    }
  }

  /**
   * Close a position
   */
  async closePosition(positionId) {
    if (!this.client) await this.initialize()

    const result = await this.client.futures.isolated.close({ id: positionId })

    // Debug raw close response
    if (this.config.debug) console.log('DEBUG: closePosition response:', JSON.stringify(result, null, 2))

    // Handle potential key variations for exit price
    const exitPrice = parseFloat(result.exit_price || result.exitPrice || result.price || 0)

    return {
      id: result.id,
      exitPrice: exitPrice,
      pnl: result.pl || result.pnl || 0,
      closingFee: result.closing_fee || result.closingFee || 0,
    }
  }

  /**
   * Close all positions
   */
  async closeAllPositions() {
    if (!this.client) await this.initialize()

    const positions = await this.getPositions()
    const results = []

    for (const pos of positions) {
      const result = await this.closePosition(pos.id)
      results.push(result)
    }

    return results
  }

  /**
   * Get historical trades
   */
  async getHistory({ limit = 100, from = null, to = null } = {}) {
    if (!this.client) await this.initialize()

    const params = { limit }
    if (from) params.from = from
    if (to) params.to = to

    const response = await this.client.futures.isolated.getClosedTrades(params)
    const trades = response.data || []

    return trades.map(trade => ({
      id: trade.id,
      side: trade.side,
      quantity: trade.quantity,
      entryPrice: parseFloat(trade.entryPrice),
      exitPrice: parseFloat(trade.exitPrice),
      pnl: trade.pl,
      openedAt: trade.createdAt,
      closedAt: trade.closedAt,
      fees: (trade.openingFee || 0) + (trade.closingFee || 0),
    }))
  }

  /**
   * Get current state for value averaging calculations
   */
  async getCurrentState() {
    // Fetch data in parallel
    // Note: getBalance() returns a processed object, but we'll use raw user.balance from it
    // effectively by handling the logic here to be safe.
    const [balanceObj, price, positions] = await Promise.all([
      this.getBalance(),
      this.getCurrentPrice(),
      this.getPositions(),
    ])

    // Calculate totals from active positions
    let totalPositionSats = 0
    let totalUnrealizedPnL = 0
    let totalMarginUsed = 0
    let netPositionUsd = 0
    let totalAccumulatedFundingSats = 0; // Initialize for accumulating funding in sats

    for (const pos of positions) {
      // Normalizing side to 'b' (long) or 's' (short)
      // LNMarkets API v2 usually returns 'b' or 's' for side.
      const side = (pos.side === 'b' || pos.side === 'buy' || pos.side === 'long') ? 'b' : 's';

      // Calculate sats value of position (approximate at current price)
      const positionBtc = pos.quantity / price.lastPrice
      const positionSats = Math.floor(positionBtc * 100_000_000)

      if (side === 'b') {
        // Long position: POSITIVE exposure to BTC price
        netPositionUsd += pos.quantity
        totalPositionSats += positionSats
      } else {
        // Short position: NEGATIVE exposure (Hedge)
        netPositionUsd -= pos.quantity
        totalPositionSats -= positionSats
      }

      totalUnrealizedPnL += (pos.pnl || 0)
      totalMarginUsed += pos.margin
      totalAccumulatedFundingSats += -(pos.sumCarryFees || 0);
    }

    // Accounting Fix:
    // API v2 user.balance is "Available Balance" (Cash).
    // It does not include Margin Used.
    // It does not include Unrealized PnL.

    // Fallback: If balanceObj.marginUsed is 0 (missing from API response), use calculated totalMarginUsed
    const realMarginUsed = balanceObj.marginUsed || totalMarginUsed

    // Total Wallet Balance = Available Cash + Margin Locked
    const realTotalWalletBalance = balanceObj.balance + realMarginUsed

    // Total Equity = Wallet Balance + Unrealized PnL
    const totalEquitySats = realTotalWalletBalance + totalUnrealizedPnL

    // BTC stack = positions + portion of available balance we consider as BTC
    const netPositionSats = totalPositionSats

    return {
      currentPrice: price.lastPrice,
      totalEquitySats,
      btcStackSats: totalEquitySats + netPositionSats, // Effective BTC Exposure in Sats
      usdBalanceSats: 0, // Not really applicable for LNMarkets inverse
      unrealizedPnL: totalUnrealizedPnL,
      positions,
      netPositionSats,
      netPositionUsd, // Added for USD-based calculations
      marginUsed: realMarginUsed,
      fundingRate: price.fundingRate,
      totalAccumulatedFundingSats, // Add accumulated funding in sats to the state
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.client) await this.initialize()
      const [user, positions] = await Promise.all([
        this.client.account.get(),
        this.client.futures.isolated.getRunningTrades()
      ])

      const marginUsed = positions.reduce((sum, p) => sum + p.margin, 0)
      const totalBalance = (user.balance || 0) + marginUsed

      return {
        ok: true,
        uid: user.uid,
        balance: totalBalance,
      }
    } catch (error) {
      return {
        ok: false,
        error: error.message,
      }
    }
  }

  /**
   * Format detailed check log entry
   * 
   * @param {Object} checkData
   * @param {number} checkData.currentPrice - Current BTC price in USD
   * @param {number} checkData.deviation - Deviation percentage (as decimal, e.g., 0.05 for 5%)
   * @param {number} checkData.actualPortfolioSats - Actual portfolio value in sats
   * @param {number} checkData.targetPortfolioSats - Target portfolio value in sats
   * @param {number} checkData.actualBtcExposureUsd - Actual BTC exposure in USD
   * @param {number} checkData.targetBtcExposureUsd - Target BTC exposure in USD
   * @param {string} checkData.action - Action taken ('No Action', 'Market Rebalance', 'Limit Order Placed')
   * @returns {string} Formatted log entry
   */
  formatDetailedCheck(checkData) {
    const timestamp = new Date().toISOString()
    const {
      currentPrice,
      deviation,
      actualPortfolioSats,
      targetPortfolioSats,
      actualBtcExposureUsd,
      targetBtcExposureUsd,
      action
    } = checkData

    // Convert sats to USD for display
    const actualPortfolioUsd = (actualPortfolioSats / 100_000_000) * currentPrice
    const targetPortfolioUsd = (targetPortfolioSats / 100_000_000) * currentPrice

    return `
## Check: ${timestamp}

**Market Data:**
- BTC Price: $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**Portfolio Values:**
- Actual: ${actualPortfolioSats.toLocaleString()} sats ($${actualPortfolioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
- Target: ${targetPortfolioSats.toLocaleString()} sats ($${targetPortfolioUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})

**BTC Exposure:**
- Actual: $${actualBtcExposureUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Target: $${targetBtcExposureUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**Deviation:** ${(deviation * 100).toFixed(2)}%

**Action:** ${action}

---
`
  }

  /**
   * Format detailed trade log entry
   * 
   * @param {Object} tradeData
   * @param {string} tradeData.side - Trade side ('b' for buy, 's' for sell)
   * @param {number} tradeData.quantity - Position size in contracts/USD
   * @param {number} tradeData.price - Entry price
   * @param {number} tradeData.feesSats - Fees paid in sats
   * @param {number} tradeData.positionBeforeUsd - BTC exposure before trade (USD)
   * @param {number} tradeData.positionAfterUsd - BTC exposure after trade (USD)
   * @param {string} tradeData.reason - Reason for trade
   * @returns {string} Formatted log entry
   */
  formatDetailedTrade(tradeData) {
    const timestamp = new Date().toISOString()
    const {
      side,
      quantity,
      price,
      feesSats,
      positionBeforeUsd,
      positionAfterUsd,
      reason
    } = tradeData

    const sideLabel = side === 'b' ? 'BUY (Long)' : 'SELL (Short)'
    const quantityUsd = quantity // Already in USD for LNMarkets
    const quantityBtc = (quantityUsd / price).toFixed(8)

    return `
## Trade: ${timestamp}

**Action:** ${sideLabel}

**Size:**
- Contracts: ${quantity.toLocaleString()}
- USD Value: $${quantityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- BTC Equivalent: ${quantityBtc} BTC

**Price:** $${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**Fees:** ${feesSats.toLocaleString()} sats

**Position Change:**
- Before: $${positionBeforeUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- After: $${positionAfterUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Change: $${(positionAfterUsd - positionBeforeUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

**Reason:** ${reason}

---
`
  }
}

export default LNMClient
