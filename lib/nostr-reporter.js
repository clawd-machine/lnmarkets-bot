// Nostr Reporter for LNMarkets Bot Updates

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

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
      // Escape shell characters carefully
      const escapedMessage = message.replace(/"/g, '\\"').replace(/\$/g, '\\$');
      
      const { stdout, stderr } = await execAsync(
        `cd "${this.clawdzapPath}" && node send.js "${escapedMessage}"`,
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
    if (this.config.nostr && this.config.nostr.tradeAlerts === false) return;

    const { action, quantityUsd, currentPrice, reasoning } = tradeInfo
    
    // Improved wording based on feedback
    // action: 'buy' (long) or 'sell' (short)
    // quantityUsd: signed quantity (positive for buy, negative for sell)
    
    const isBuy = quantityUsd > 0;
    const absQty = Math.abs(quantityUsd);
    
    let emoji, actionText;
    
    if (isBuy) {
        emoji = '📈';
        // Buying Longs = Increasing BTC Exposure
        actionText = `Stacking ${absQty} USD of Bitcoin Exposure`; 
    } else {
        emoji = '📉';
        // Selling Shorts = Decreasing BTC Exposure (Hedging)
        actionText = `Hedging ${absQty} USD to Lock Value`;
    }
    
    const message = `🪝 LNM Bot Rebalance ${emoji}\n` +
      `${actionText} @ $${currentPrice.toLocaleString()}\n` +
      `Reason: ${reasoning}`;
    
    return this.post(message)
  }

  /**
   * Post close position alert
   */
  async postCloseAlert(closeInfo) {
    if (this.config.nostr && this.config.nostr.tradeAlerts === false) return;

    const { quantity, side, exitPrice, pnl } = closeInfo;
    
    // side: 'b' (Long) or 's' (Short)
    const isLong = side === 'b';
    const pnlSign = pnl >= 0 ? '+' : '';
    const emoji = pnl >= 0 ? '✅' : '🔻';
    
    let actionText;
    if (isLong) {
        // Closing Long = Reducing Exposure
        actionText = `Reduced Exposure (Closed Long $${quantity})`;
    } else {
        // Closing Short = Increasing Exposure (Unhedging)
        actionText = `Unhedged (Closed Short $${quantity})`;
    }

    const message = `🪝 LNM Bot Position Closed ${emoji}\n` +
      `${actionText} @ $${exitPrice.toLocaleString()}\n` +
      `PnL: ${pnlSign}${pnl} sats`;

    return this.post(message);
  }

  /**
   * Post daily summary
   */
  async postDailySummary(report) {
    if (this.config.nostr && this.config.nostr.dailyUpdate === false) return;

    const {
      totalReturnPct,
      btcStackSats,
      btcStackGrowthPct,
      currentValue,
      daysRunning,
      vsTargetPct,
      portfolioValueUsd,
      annualizedReturn
    } = report

    const returnEmoji = totalReturnPct > 0 ? '🚀' : '📉';
    const vsTargetEmoji = Math.abs(vsTargetPct) < 5 ? '🎯' : (vsTargetPct > 0 ? '📈' : '📉');
    
    // Clearer presentation
    const message = `🪝 LNM Bot Daily Report (Day ${daysRunning})\n\n` +
      `💰 Total Value: $${portfolioValueUsd.toLocaleString()} USD\n` +
      `₿ Effective Stack: ${(btcStackSats / 100_000_000).toFixed(8)} BTC\n` +
      `📊 Growth vs Start: ${btcStackGrowthPct >= 0 ? '+' : ''}${btcStackGrowthPct.toFixed(2)}%\n` +
      `💵 USD Value of Stack: $${currentValue.toLocaleString()}\n` +
      `------------------\n` +
      `${returnEmoji} Return: ${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}% (Annualized: ${annualizedReturn}%)\n` +
      `${vsTargetEmoji} Target Deviation: ${vsTargetPct >= 0 ? '+' : ''}${vsTargetPct.toFixed(2)}%`;
    
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
      `🎯 Strategy: Value Averaging\n` +
      `📈 Growth Target: ${(state.targetGrowthRate * 100).toFixed(2)}%/month\n` +
      `🤖 Automating the stack growth! 🚀`
    
    return this.post(message)
  }
}

export default NostrReporter
