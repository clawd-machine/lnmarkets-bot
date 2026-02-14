// LNMarkets API Client Wrapper

import { createRestClient } from '@ln-markets/api'
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

    this.client = createRestClient({
      key: this.credentials.key,
      secret: this.credentials.secret,
      passphrase: this.credentials.passphrase,
      network: this.config.lnmarkets.network,
      version: this.config.lnmarkets.apiVersion,
    })

    return this
  }

  /**
   * Get account balance and info
   */
  async getBalance() {
    if (!this.client) await this.initialize()
    
    const user = await this.client.userGet()
    console.log('DEBUG: userGet response:', JSON.stringify(user, null, 2))

    // In Isolated Margin mode, user.balance is the "Cash Balance" (excluding margin)
    // Total Wallet Balance = Cash Balance + Margin Used
    // Available Balance = Cash Balance (since margin is already deducted)
    
    const marginUsed = user.margin_total || 0
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
      ticker = await this.client.futuresGetTicker()
      console.log('DEBUG: Raw Ticker Response:', JSON.stringify(ticker, null, 2))
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
      bid: parseFloat(ticker.bidPrice || 0),
      ask: parseFloat(ticker.askPrice || 0),
      fundingRate: parseFloat(ticker.carryFeeRate || 0),
    }
  }

  /**
   * Get all open positions
   */
  async getPositions() {
    if (!this.client) await this.initialize()
    
    const positions = await this.client.futuresGetTrades({
      type: 'running'
    })
    
    return positions.map(pos => ({
      id: pos.id,
      side: pos.side,
      quantity: pos.quantity,
      leverage: pos.leverage,
      entryPrice: parseFloat(pos.entry_price),
      liquidationPrice: parseFloat(pos.liquidation),
      margin: pos.margin,
      pnl: pos.pl || 0,
      openingFee: pos.opening_fee,
      runningTime: pos.created_at,
    }))
  }

  /**
   * Get all open limit orders
   */
  async getOpenOrders() {
    if (!this.client) await this.initialize()
    
    // LNMarkets API: type='limit' fetches open limit orders
    const orders = await this.client.futuresGetTrades({
      type: 'limit'
    })
    
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
    return await this.client.futuresCancelTrade({ id: orderId })
  }

  /**
   * Place a new order (limit or market)
   */
  async newOrder(params) {
    if (!this.client) await this.initialize()
    
    // Ensure numeric types
    const orderParams = {
      type: params.type || 'l', // default to limit
      side: params.side,
      quantity: Math.floor(params.quantity),
      price: Math.floor(params.price),
      leverage: params.leverage || 1,
      margin_mode: 'isolated'
    }

    const result = await this.client.futuresNewTrade(orderParams)
    
    return {
      id: result.id,
      side: result.side,
      quantity: result.quantity,
      price: parseFloat(result.price),
      leverage: result.leverage
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
      margin_mode: 'isolated',  // Use isolated margin for safety
    }

    if (takeProfit) params.takeprofit = takeProfit
    if (stopLoss) params.stoploss = stopLoss

    const result = await this.client.futuresNewTrade(params)
    
    return {
      id: result.id,
      side: result.side,
      quantity: result.quantity,
      entryPrice: parseFloat(result.price),
      margin: result.margin,
      leverage: result.leverage,
    }
  }

  /**
   * Close a position
   */
  async closePosition(positionId) {
    if (!this.client) await this.initialize()
    
    const result = await this.client.futuresCloseTrade({ id: positionId })
    
    return {
      id: result.id,
      exitPrice: parseFloat(result.exit_price),
      pnl: result.pl,
      closingFee: result.closing_fee,
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
    
    const params = { type: 'closed', limit }
    if (from) params.from = from
    if (to) params.to = to

    const trades = await this.client.futuresGetTrades(params)
    
    return trades.map(trade => ({
      id: trade.id,
      side: trade.side,
      quantity: trade.quantity,
      entryPrice: parseFloat(trade.entry_price),
      exitPrice: parseFloat(trade.exit_price),
      pnl: trade.pl,
      openedAt: trade.created_at,
      closedAt: trade.closed_at,
      fees: (trade.opening_fee || 0) + (trade.closing_fee || 0),
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

    for (const pos of positions) {
      // Position value in BTC
      const positionBtc = pos.quantity / price.lastPrice
      const positionSats = Math.floor(positionBtc * 100_000_000)
      
      if (pos.side === 'long') {
        totalPositionSats += positionSats
      } else {
        // Short positions reduce BTC exposure
        totalPositionSats -= positionSats
      }
      
      totalUnrealizedPnL += pos.pnl
      totalMarginUsed += pos.margin
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
      netPositionSats,
      totalEquitySats,
      btcStackSats: netPositionSats + totalEquitySats, // Total BTC Exposure
      usdBalanceSats: balanceObj.balance,              // Free Margin (Available)
      totalBalance: realTotalWalletBalance,
      marginUsed: realMarginUsed,
      unrealizedPnL: totalUnrealizedPnL,
      currentPrice: price.lastPrice,
      positions,
      fundingRate: price.fundingRate,
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.client) await this.initialize()
      const [user, positions] = await Promise.all([
        this.client.userGet(),
        this.client.futuresGetTrades({ type: 'running' })
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
}

export default LNMClient
