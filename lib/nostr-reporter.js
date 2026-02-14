// Nostr Reporter for LNMarkets Bot Updates

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'

const execAsync = promisify(exec)

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class NostrReporter {
  constructor(config) {
    this.config = config
    this.enabled = config.nostr?.enabled ?? true
    this.clawdzapPath = path.join(__dirname, '../../skills/clawdzap')
  }

  /**
   * Post a message to Nostr via ClawdZap
   */
  async post(message) {
    if (!this.enabled) {
      console.log('[Nostr] Disabled. Would have posted:', message)
      return { success: false, reason: 'disabled' }
    }

    try {
      const { stdout, stderr } = await execAsync(
        `cd "${this.clawdzapPath}" && node send.js "${message.replace(/"/g, '\\"')}"`,
        { shell: '/bin/bash' }
      )

      console.log('[Nostr] Posted:', message)
      
      return { 
        success: true, 
        output: stdout,
        message 
      }
    } catch (error) {
      console.error('[Nostr] Failed to post:', error.message)
      return { 
        success: false, 
        error: error.message,
        message 
      }
    }
  }

  /**
   * Post trade alert (when rebalancing occurs)
   */
  async postTradeAlert(tradeInfo) {
    if (!this.config.nostr?.tradeAlerts) return

    const { action, quantityUsd, currentPrice, reasoning } = tradeInfo
    
    const emoji = action === 'long' ? '📈' : '📉'
    const actionText = action === 'long' ? 'Buying' : 'Selling'
    
    const message = `🪝 LNM Bot ${emoji}\n${actionText} $${quantityUsd.toLocaleString()} @ $${currentPrice.toLocaleString()}\n${reasoning}`
    
    return this.post(message)
  }

  /**
   * Post daily summary
   */
  async postDailySummary(report) {
    if (!this.config.nostr?.dailyUpdate) return

    const {
      totalReturnPct,
      btcStackSats,
      btcStackGrowthPct,
      currentValue,
      daysRunning,
      vsTargetPct,
    } = report

    const returnEmoji = totalReturnPct > 0 ? '📈' : '📉'
    const vsTargetEmoji = vsTargetPct > 0 ? '🎯' : '⚠️'
    
    const message = `🪝 LNM Bot Daily Update\n` +
      `${returnEmoji} Total: ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}% (${daysRunning}d)\n` +
      `₿ Stack: ${(btcStackSats / 100_000_000).toFixed(8)} BTC (${btcStackGrowthPct >= 0 ? '+' : ''}${btcStackGrowthPct.toFixed(2)}%)\n` +
      `💰 Value: ${currentValue.toLocaleString()} sats\n` +
      `${vsTargetEmoji} vs Target: ${vsTargetPct >= 0 ? '+' : ''}${vsTargetPct.toFixed(2)}%`
    
    return this.post(message)
  }

  /**
   * Post weekly report
   */
  async postWeeklyReport(report, trades) {
    if (!this.config.nostr?.weeklyReport) return

    const {
      totalReturnPct,
      btcStackSats,
      btcStackGrowthPct,
      annualizedReturn,
      daysRunning,
    } = report

    const tradeCount = trades.length
    const avgTradeSize = trades.reduce((sum, t) => sum + t.quantityUsd, 0) / tradeCount
    const winRate = (trades.filter(t => t.pnl > 0).length / tradeCount) * 100

    const message = `🪝 LNM Bot Weekly Report\n` +
      `📊 Performance: ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}% (${daysRunning}d)\n` +
      `📈 Annualized: ${annualizedReturn.toFixed(1)}%\n` +
      `₿ Stack Growth: ${btcStackGrowthPct >= 0 ? '+' : ''}${btcStackGrowthPct.toFixed(2)}%\n` +
      `🔄 Trades: ${tradeCount} (avg $${avgTradeSize.toFixed(0)})\n` +
      `🎯 Win Rate: ${winRate.toFixed(0)}%`
    
    return this.post(message)
  }

  /**
   * Post error alert
   */
  async postError(error, context = '') {
    const message = `🚨 LNM Bot Error\n${context ? context + '\n' : ''}${error.message || error}`
    return this.post(message)
  }

  /**
   * Post initialization message
   */
  async postInit(state) {
    const message = `🪝 LNM Bot Initialized\n` +
      `💰 Capital: ${state.initialCapital.toLocaleString()} sats\n` +
      `🎯 Target: ${(state.targetBtcAllocation * 100).toFixed(0)}% BTC\n` +
      `📈 Growth: ${(state.targetGrowthRate * 100).toFixed(2)}%/month\n` +
      `⚡ Strategy: Value Averaging\n` +
      `Let's grow that stack! 🚀`
    
    return this.post(message)
  }

  /**
   * Format sats amount for display
   */
  formatSats(sats) {
    if (sats >= 100_000_000) {
      return `${(sats / 100_000_000).toFixed(8)} BTC`
    } else if (sats >= 1_000_000) {
      return `${(sats / 1_000_000).toFixed(2)}M sats`
    } else if (sats >= 1_000) {
      return `${(sats / 1_000).toFixed(1)}k sats`
    } else {
      return `${sats} sats`
    }
  }
}

export default NostrReporter
