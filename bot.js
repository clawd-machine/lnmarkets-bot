#!/usr/bin/env node

// LNMarkets Value Averaging Trading Bot

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import config from './config.js'
import { ValueAverager } from './lib/value-averaging.js'
import { LNMClient } from './lib/lnm-client.js'
import { NostrReporter } from './lib/nostr-reporter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

class LNMarketsTradingBot {
  constructor(configOverrides = {}) {
    this.config = { ...config, ...configOverrides }
    this.client = new LNMClient(this.config)
    this.averager = new ValueAverager(this.config)
    this.reporter = new NostrReporter(this.config)
    this.state = null
  }

  /**
   * Load state from disk
   */
  async loadState() {
    try {
      const data = await fs.readFile(this.config.stateFile, 'utf8')
      this.state = JSON.parse(data)
      
      // Restore dates as Date objects
      if (this.state.startDate) {
        this.state.startDate = new Date(this.state.startDate)
        this.averager.initialize(this.state.startDate)
      }
      
      console.log('✓ State loaded from disk')
      return this.state
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('ℹ No existing state found. Run "init" to initialize.')
        return null
      }
      throw error
    }
  }

  /**
   * Save state to disk
   */
  async saveState() {
    await fs.writeFile(
      this.config.stateFile,
      JSON.stringify(this.state, null, 2),
      'utf8'
    )
    console.log('✓ State saved to disk')
  }

  /**
   * Initialize bot with fresh state
   */
  async initialize() {
    console.log('🪝 Initializing LNMarkets Trading Bot...\n')

    // Check credentials
    try {
      await this.client.loadCredentials()
      console.log('✓ Credentials loaded')
    } catch (error) {
      console.error('✗ Failed to load credentials:', error.message)
      console.log('\nCreate credentials.json with:')
      console.log(JSON.stringify({
        key: 'YOUR_API_KEY',
        secret: 'YOUR_API_SECRET',
        passphrase: 'YOUR_PASSPHRASE'
      }, null, 2))
      return false
    }

    // Check account balance
    const health = await this.client.healthCheck()
    if (!health.ok) {
      console.error('✗ Failed to connect to LNMarkets:', health.error)
      return false
    }

    console.log(`✓ Connected to LNMarkets (UID: ${health.uid})`)
    console.log(`✓ Balance: ${health.balance.toLocaleString()} sats\n`)

    if (health.balance < this.config.initialCapital) {
      console.warn(`⚠️ Warning: Balance (${health.balance} sats) < Initial Capital (${this.config.initialCapital} sats)`)
      console.log('Proceeding with current balance as initial capital.\n')
    }

    // Initialize state
    const startDate = new Date()
    this.state = {
      initialized: true,
      startDate: startDate.toISOString(),
      initialCapital: Math.min(health.balance, this.config.initialCapital),
      targetBtcAllocation: this.config.targetBtcAllocation,
      targetGrowthRate: this.config.targetGrowthRate,
      trades: [],
      checks: [],
      totalFeesPaid: 0,
      totalRebalances: 0,
      lastCheck: null,
      version: '1.0.0',
    }

    this.averager.initialize(startDate)
    await this.saveState()

    console.log('✓ Bot initialized!')
    console.log('\nConfiguration:')
    console.log(`  Capital: ${this.state.initialCapital.toLocaleString()} sats`)
    console.log(`  Target BTC allocation: ${(this.config.targetBtcAllocation * 100).toFixed(0)}%`)
    console.log(`  Target growth rate: ${(this.config.targetGrowthRate * 100).toFixed(2)}%/month`)
    console.log(`  Rebalance threshold: ${(this.config.rebalanceThreshold * 100).toFixed(0)}%`)
    console.log(`  Max leverage: ${this.config.maxLeverage}x`)
    console.log(`  Check interval: ${this.config.checkInterval / (60 * 60 * 1000)} hours\n`)

    // Post to Nostr
    await this.reporter.postInit(this.state)

    return true
  }

  /**
   * Check current position and rebalance if needed
   */
  async rebalance(dryRun = false) {
    if (!this.state) {
      await this.loadState()
      if (!this.state) {
        console.error('✗ Bot not initialized. Run "init" first.')
        return false
      }
    }

    console.log(`\n🔄 Checking rebalance (${dryRun ? 'DRY RUN' : 'LIVE'})...`)
    
    // Get current state from LNMarkets
    const currentState = await this.client.getCurrentState()
    const { currentPrice, btcStackSats, usdBalanceSats, unrealizedPnL, positions, totalEquitySats, netPositionSats } = currentState

    console.log(`\nCurrent Price: $${currentPrice.toLocaleString()}`)
    console.log(`Total Equity: ${totalEquitySats.toLocaleString()} sats`)
    console.log(`BTC Exposure: ${(btcStackSats / 100_000_000).toFixed(8)} BTC (${btcStackSats.toLocaleString()} sats)`)
    console.log(`Net Position: ${netPositionSats.toLocaleString()} sats`)
    console.log(`Unrealized P&L: ${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toLocaleString()} sats`)
    console.log(`Open Positions: ${positions.length}`)

    // Calculate rebalance decision
    const decision = this.averager.calculateRebalance(
      { totalEquitySats, netPositionSats },
      currentPrice
    )

    console.log(`\n📊 Analysis:`)
    console.log(`  Current Value: ${decision.metrics.currentValue.toLocaleString()} sats`)
    console.log(`  Target Value: ${decision.metrics.targetValue.toLocaleString()} sats`)
    console.log(`  Current BTC: ${(btcStackSats / 100_000_000).toFixed(8)} BTC`)
    console.log(`  Target BTC: ${(decision.metrics.targetBtcSats / 100_000_000).toFixed(8)} BTC`)
    console.log(`  BTC Deviation: ${(decision.metrics.btcDeviation * 100).toFixed(2)}%`)
    console.log(`  Value Deviation: ${(decision.metrics.valueDeviation * 100).toFixed(2)}%`)

    // Record check
    this.state.checks.push({
      timestamp: new Date().toISOString(),
      currentPrice,
      btcStackSats,
      usdBalanceSats,
      unrealizedPnL,
      needsRebalance: decision.needsRebalance,
      action: decision.action,
      quantityUsd: decision.quantityUsd,
    })
    this.state.lastCheck = new Date().toISOString()

    if (!decision.needsRebalance) {
      console.log(`\n✓ ${decision.reasoning}`)
      console.log('No rebalance needed.')
      await this.saveState()
      await this.logActivity(`Check: ${decision.reasoning}`)
      return true
    }

    console.log(`\n⚠️ Rebalance needed!`)
    console.log(`  Action: ${decision.action.toUpperCase()}`)
    console.log(`  Quantity: $${decision.quantityUsd.toLocaleString()}`)
    console.log(`  Reasoning: ${decision.reasoning}`)

    // Calculate fees
    const fees = this.averager.estimateFees(decision.quantityUsd, this.config.fees.trading.tier1)
    console.log(`\n💰 Estimated Fees:`)
    console.log(`  Open: ${fees.openFee} sats`)
    console.log(`  Close: ${fees.closeFee} sats`)
    console.log(`  Total: ${fees.totalFee} sats (${(fees.roundTripFeeRate * 100).toFixed(2)}%)`)

    if (dryRun) {
      console.log(`\n🧪 DRY RUN - Would execute ${decision.action} trade for $${decision.quantityUsd}`)
      return true
    }

    // Check if quantity meets minimum
    if (decision.quantityUsd < this.config.minTradeSats / 1000) {
      console.log(`\n⚠️ Trade size ($${decision.quantityUsd}) below minimum ($${this.config.minTradeSats / 1000})`)
      console.log('Skipping trade.')
      await this.saveState()
      return true
    }

    // Execute trade
    console.log(`\n🚀 Executing ${decision.action} trade...`)
    
    try {
      const result = await this.client.openPosition({
        side: decision.action,
        quantity: decision.quantityUsd,
        leverage: this.config.maxLeverage,
      })

      console.log(`✓ Trade executed!`)
      console.log(`  Position ID: ${result.id}`)
      console.log(`  Entry Price: $${result.entryPrice.toLocaleString()}`)
      console.log(`  Margin: ${result.margin.toLocaleString()} sats`)

      // Record trade
      const trade = {
        timestamp: new Date().toISOString(),
        positionId: result.id,
        side: result.side,
        quantityUsd: result.quantity,
        entryPrice: result.entryPrice,
        margin: result.margin,
        leverage: result.leverage,
        fees: fees.totalFee,
        reasoning: decision.reasoning,
      }

      this.state.trades.push(trade)
      this.state.totalRebalances++
      this.state.totalFeesPaid += fees.totalFee

      await this.saveState()
      await this.logActivity(`Trade: ${decision.action} $${decision.quantityUsd} @ $${result.entryPrice}`)
      
      // Post to Nostr
      await this.reporter.postTradeAlert({
        action: decision.action,
        quantityUsd: decision.quantityUsd,
        currentPrice: result.entryPrice,
        reasoning: decision.reasoning,
      })

      return true
    } catch (error) {
      console.error(`✗ Trade failed:`, error.message)
      await this.reporter.postError(error, 'Failed to execute trade')
      await this.logActivity(`Error: ${error.message}`)
      return false
    }
  }

  /**
   * Get current status
   */
  async status() {
    if (!this.state) {
      await this.loadState()
      if (!this.state) {
        console.error('✗ Bot not initialized. Run "init" first.')
        return
      }
    }

    console.log('\n🪝 LNMarkets Trading Bot Status\n')

    const currentState = await this.client.getCurrentState()
    const { currentPrice, btcStackSats, usdBalanceSats, unrealizedPnL, positions, fundingRate, totalEquitySats, netPositionSats } = currentState

    const report = this.averager.generateReport(
      { totalEquitySats, netPositionSats },
      currentPrice
    )

    console.log('📊 Performance:')
    console.log(`  Days Running: ${report.daysRunning}`)
    console.log(`  Total Return: ${report.totalReturnPct >= 0 ? '+' : ''}${report.totalReturnPct.toFixed(2)}% (${report.totalReturn >= 0 ? '+' : ''}${report.totalReturn.toLocaleString()} sats)`)
    console.log(`  Annualized Return: ${report.annualizedReturn.toFixed(1)}%`)
    console.log(`  vs Target: ${report.vsTargetPct >= 0 ? '+' : ''}${report.vsTargetPct.toFixed(2)}%`)

    console.log(`\n₿ Bitcoin Exposure:`)
    console.log(`  Current: ${(report.btcStackSats / 100_000_000).toFixed(8)} BTC`)
    console.log(`  Growth: ${report.btcStackGrowthPct >= 0 ? '+' : ''}${report.btcStackGrowthPct.toFixed(2)}%`)
    console.log(`  Target: ${(report.targetValue * this.config.targetBtcAllocation / 100_000_000).toFixed(8)} BTC`)

    console.log(`\n💰 Portfolio:`)
    console.log(`  Total Value: ${report.currentValue.toLocaleString()} sats`)
    console.log(`  Target Value: ${report.targetValue.toLocaleString()} sats`)
    console.log(`  BTC Exposure: ${report.btcStackSats.toLocaleString()} sats`)
    console.log(`  Net Position: ${netPositionSats.toLocaleString()} sats`)
    console.log(`  Unrealized P&L: ${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toLocaleString()} sats`)

    console.log(`\n📈 Market:`)
    console.log(`  BTC/USD: $${currentPrice.toLocaleString()}`)
    console.log(`  Funding Rate: ${(fundingRate * 100).toFixed(4)}%`)

    console.log(`\n🔄 Trading:`)
    console.log(`  Total Rebalances: ${this.state.totalRebalances}`)
    console.log(`  Total Fees Paid: ${this.state.totalFeesPaid.toLocaleString()} sats`)
    console.log(`  Open Positions: ${positions.length}`)
    console.log(`  Last Check: ${this.state.lastCheck ? new Date(this.state.lastCheck).toLocaleString() : 'Never'}`)

    if (positions.length > 0) {
      console.log(`\n📊 Open Positions:`)
      for (const pos of positions) {
        console.log(`  [${pos.id}] ${pos.side.toUpperCase()} $${pos.quantity.toLocaleString()} @ $${pos.entryPrice.toLocaleString()}`)
        console.log(`    P&L: ${pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString()} sats | Margin: ${pos.margin.toLocaleString()} sats`)
      }
    }

    console.log('')
  }

  /**
   * Generate performance report
   */
  async report() {
    if (!this.state) {
      await this.loadState()
      if (!this.state) {
        console.error('✗ Bot not initialized. Run "init" first.')
        return
      }
    }

    const currentState = await this.client.getCurrentState()
    const { currentPrice, totalEquitySats, netPositionSats } = currentState

    const report = this.averager.generateReport(
      { totalEquitySats, netPositionSats },
      currentPrice
    )

    // Post to Nostr
    await this.reporter.postDailySummary(report)

    return report
  }

  /**
   * Log activity to memory file
   */
  async logActivity(activity) {
    const logPath = path.join(__dirname, '..', this.config.logFile)
    const timestamp = new Date().toISOString()
    const entry = `[${timestamp}] ${activity}\n`

    try {
      await fs.appendFile(logPath, entry, 'utf8')
    } catch (error) {
      console.error('Failed to write to log:', error.message)
    }
  }

  /**
   * Set up cron job for automated checks
   */
  async setupCron() {
    console.log('\n🕐 Setting up cron job...')
    console.log(`Interval: Every ${this.config.checkInterval / (60 * 60 * 1000)} hours`)
    
    const cronCommand = `cd ${__dirname} && node bot.js rebalance`
    
    console.log('\nAdd this to your OpenClaw cron:')
    console.log(`
{
  "name": "LNMarkets Value Averaging Bot",
  "schedule": {
    "kind": "every",
    "everyMs": ${this.config.checkInterval}
  },
  "payload": {
    "kind": "systemEvent",
    "text": "Run LNMarkets bot rebalance check"
  },
  "sessionTarget": "main",
  "enabled": true
}
    `)

    console.log('\nOr run manually:')
    console.log(`  cron add '${JSON.stringify({
      name: "LNMarkets Bot",
      schedule: { kind: "every", everyMs: this.config.checkInterval },
      payload: { kind: "systemEvent", text: "Run LNMarkets bot rebalance check" },
      sessionTarget: "main",
      enabled: true
    })}'`)
  }
}

// CLI
const command = process.argv[2]
const bot = new LNMarketsTradingBot()

;(async () => {
  try {
    switch (command) {
      case 'init':
        await bot.initialize()
        break

      case 'status':
        await bot.status()
        break

      case 'rebalance': {
        const dryRun = process.argv.includes('--dry-run')
        await bot.rebalance(dryRun)
        break
      }

      case 'report':
        await bot.report()
        break

      case 'setup-cron':
        await bot.setupCron()
        break

      default:
        console.log('🪝 LNMarkets Value Averaging Trading Bot\n')
        console.log('Commands:')
        console.log('  init          Initialize bot with fresh state')
        console.log('  status        Show current bot status')
        console.log('  rebalance     Check and rebalance if needed')
        console.log('  rebalance --dry-run   Test rebalance without trading')
        console.log('  report        Generate performance report')
        console.log('  setup-cron    Show cron job setup instructions')
        console.log('')
        console.log('Example:')
        console.log('  node bot.js init')
        console.log('  node bot.js status')
        console.log('  node bot.js rebalance --dry-run')
        console.log('')
    }
  } catch (error) {
    console.error('Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
})()

export { LNMarketsTradingBot }
export default LNMarketsTradingBot
