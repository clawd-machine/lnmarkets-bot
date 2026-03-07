#! /usr/bin/env node

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
    this.debug = this.config.debug || false
    this.client = new LNMClient(this.config)
    this.averager = new ValueAverager(this.config)
    this.reporter = new NostrReporter(this.config)
    this.state = null
  }

  logDebug(...args) {
    if (this.debug) {
      console.log('[DEBUG]', ...args)
    }
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

      // Migrate legacy keys
      if (this.state.totalRebalances !== undefined && this.state.marketRebalances === undefined) {
          this.state.marketRebalances = this.state.totalRebalances;
          delete this.state.totalRebalances;
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
      marketRebalances: 0,
      lastCheck: null,
      version: '1.0.0',
    }
    
    // Logic for initialization is fresh, so no migration needed here.
    // Migration logic should be in loadState if anywhere.
    
    this.averager.initialize(startDate)
    await this.saveState()

    console.log('✓ Bot initialized!')
    console.log('\nConfiguration:')
    console.log(`  Capital: ${this.state.initialCapital.toLocaleString()} sats`)
    console.log(`  Target BTC allocation: ${(this.config.targetBtcAllocation * 100).toFixed(1)}%`)
    console.log(`  Target growth rate: ${(this.config.targetGrowthRate * 100).toFixed(2)}%/month`)
    // Update config log to match new config keys
    console.log(`  Limit Order Threshold: ${(this.config.limit_order_threshold * 100).toFixed(1)}%`)
    console.log(`  Market Rebalance Threshold: ${(this.config.market_rebalance_threshold * 100).toFixed(1)}%`)
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
    let { currentPrice, btcStackSats, usdBalanceSats, unrealizedPnL, positions, totalEquitySats, netPositionSats, netPositionUsd } = currentState

    console.log(`\nCurrent Price: $${currentPrice.toLocaleString()}`)
    console.log(`Total Equity: ${totalEquitySats.toLocaleString()} sats`)
    console.log(`BTC Exposure: ${(btcStackSats / 100_000_000).toFixed(8)} BTC (${btcStackSats.toLocaleString()} sats)`)
    console.log(`Net Position (Sats): ${netPositionSats.toLocaleString()} sats`)
    // NetPositionUsd is negative for short (hedged) positions. Display as positive "USD Dry Powder".
    console.log(`USD Dry Powder: $${Math.abs(netPositionUsd || 0).toLocaleString()} USD`)
    console.log(`Unrealized P&L: ${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toLocaleString()} sats`)
    console.log(`Open Positions: ${positions.length}`)

    // Calculate rebalance decision
    const decision = this.averager.calculateRebalance(
      currentState, // Pass full state including netPositionUsd
      currentPrice
    )

    console.log(`\n📊 Analysis:`)
    console.log(`  Current Value: $${decision.metrics.currentValue.toLocaleString()}`)
    console.log(`  Target Value: $${decision.metrics.targetValue.toLocaleString()}`)
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

    // Log detailed check data
    await this.logDetailedCheck({
      currentPrice,
      deviation: decision.metrics.btcDeviation,
      actualPortfolioSats: totalEquitySats,
      targetPortfolioSats: (decision.metrics.targetValue / currentPrice) * 100_000_000,
      actualBtcExposureUsd: decision.metrics.currentValue,
      targetBtcExposureUsd: decision.metrics.targetValue,
      action: decision.needsRebalance ? `${decision.action.toUpperCase()} $${decision.quantityUsd}` : 'No Action'
    })

    if (!decision.needsRebalance) {
      console.log(`\n✓ ${decision.reasoning}`)
      console.log('No immediate market rebalance needed.')

      // --- Limit Order Logic ---
      console.log(`\n🛡️  Checking Guard Rail Limit Orders...`)
      
      const limitConfigs = this.averager.getLimitOrderConfigs(
        { totalEquitySats, netPositionSats, currentPrice, netPositionUsd },
        new Date()
      )

      console.log(`  Buy Trigger: $${limitConfigs.buyOrder.price.toLocaleString()} (Qty: ${limitConfigs.buyOrder.quantity})`)
      console.log(`  Sell Trigger: $${limitConfigs.sellOrder.price.toLocaleString()} (Qty: ${limitConfigs.sellOrder.quantity})`)

      if (dryRun) {
        console.log(`  [DRY RUN] Would cancel existing orders and place:`)
        console.log(`    - LIMIT BUY ${limitConfigs.buyOrder.quantity} @ ${limitConfigs.buyOrder.price}`)
        console.log(`    - LIMIT SELL ${Math.abs(limitConfigs.sellOrder.quantity)} @ ${limitConfigs.sellOrder.price}`)
      } else {
        // 1. Cancel existing orders
        try {
          const openOrders = await this.client.getOpenOrders()
          if (openOrders.length > 0) {
            console.log(`  Cancelling ${openOrders.length} open orders...`)
            for (const order of openOrders) {
               await this.client.cancelOrder(order.id)
            }
            console.log('  ✓ Orders cancelled.')
          }
        } catch (err) {
          console.warn('  ⚠️ Failed to cancel orders:', err.message)
        }

        // 2. Place new orders
        const ordersToPlace = [
            { ...limitConfigs.buyOrder, side: 'b', label: 'Buy/Long' },
            { ...limitConfigs.sellOrder, side: 's', label: 'Sell/Short' }
        ]

        for (const order of ordersToPlace) {
            if (Math.abs(order.quantity) < 1) {
                 console.log(`  ⚠️ Skipping ${order.label} - Qty ${order.quantity} too small`)
                 continue
            }

            console.log(`  Placing ${order.label} Limit: ${Math.abs(order.quantity)} @ $${order.price}`)
            
            try {
                // Convert USD quantity to sats margin for V3 API
                const quantityUsd = Math.abs(order.quantity)
                const marginSats = Math.floor((quantityUsd / order.price) * 100_000_000)
                
                console.log(`  → Margin: ${marginSats} sats for $${quantityUsd} position`)
                
                await this.client.newOrder({
                    type: 'l',
                    side: order.side,
                    quantity: marginSats,
                    price: order.price,
                    leverage: this.config.maxLeverage
                })
                 console.log(`  ✓ ${order.label} Order Placed (${marginSats} sats margin)`)
            } catch (err) {
                console.error(`  ✗ Failed to place ${order.label}:`, err.message)
            }
        }
      }
      // -------------------------

      await this.saveState()
      await this.logActivity(`Check: ${decision.reasoning}`)
      return true
    }

    console.log(`\n⚠️ Rebalance needed!`)
    console.log(`  Action: ${decision.action.toUpperCase()}`)
    console.log(`  Quantity: $${decision.quantityUsd.toLocaleString()}`)
    console.log(`  Reasoning: ${decision.reasoning}`)

    // Calculate fees
    const fees = this.averager.estimateFees(decision.quantityUsd, this.config.fees.trading.tier1, currentPrice)
    console.log(`\n💰 Estimated Fees:`)
    console.log(`  Open: ${fees.openFee} sats`)
    console.log(`  Close: ${fees.closeFee} sats`)
    console.log(`  Total: ${fees.totalFee} sats (${(fees.roundTripFeeRate * 100).toFixed(2)}%)`)

    if (dryRun) {
      console.log(`\n🧪 DRY RUN - Would execute ${decision.action} trade for $${decision.quantityUsd}`)
      return true
    }

    // Check if quantity meets minimum
    // Note: This check applies to the NET change required.
    // If we close positions, we might not need to open anything new, or open less.
    if (Math.abs(decision.quantityUsd) < this.config.minTradeSats / 1000) {
      console.log(`\n⚠️ Net trade size ($${decision.quantityUsd}) below minimum ($${this.config.minTradeSats / 1000})`)
      console.log('Skipping rebalance.')
    } else {
      console.log(`\n🚀 Executing Rebalance...`)
      
      try {
        let remainingUsdToExecute = decision.quantityUsd;
        
        // 1. Check for opposite positions to close/reduce
        // If we want to BUY (+), we look for SHORTS ('s') to close.
        // If we want to SELL (-), we look for LONGS ('b') to close.
        const targetSideToClose = remainingUsdToExecute > 0 ? 's' : 'b';
        
        // Refresh positions to be safe
        const currentPositions = await this.client.getPositions();
        
        // Filter for opposite side
        const oppositePositions = currentPositions.filter(p => {
            const side = (p.side === 'b' || p.side === 'buy' || p.side === 'long') ? 'b' : 's';
            return side === targetSideToClose;
        });

        // Sort by some logic? Maybe FIFO? Or largest first? Let's do largest first to clear big chunks.
        oppositePositions.sort((a, b) => b.quantity - a.quantity);

        for (const pos of oppositePositions) {
            if (remainingUsdToExecute === 0) break;

            // Determine how much of this position we WANT to close
            const absRemaining = Math.abs(remainingUsdToExecute);
            
            // We can only close the FULL position because the API wrapper doesn't support partials.
            // Check if closing this full position is "worth it".
            // Strategy: Only close if the position is SMALLER or EQUAL to what we need.
            // If the position is larger (e.g. Short $100) and we only need to Buy $50:
            // - Closing $100 Short = Buy $100.
            // - We'd end up Buying $100 when we only wanted $50.
            // - This creates a new imbalance (overshoot).
            // User instruction: "If the position to be opened is smaller than the already open positions, just open a new one"
            // So we ONLY close if pos.quantity <= absRemaining.
            
            if (pos.quantity > absRemaining) {
                 console.log(`  • Skipping close of position ${pos.id} ($${pos.quantity}) - too large for required rebalance ($${absRemaining}).`);
                 continue;
            }

            console.log(`  • Closing full position ${pos.id} ($${pos.quantity} ${pos.side})...`);
            
            try {
                // Get position state before close
                const positionBeforeUsd = netPositionUsd;
                
                // Close FULL position
                const closeResult = await this.client.closePosition(pos.id); // id/pid
                
                console.log(`    ✓ Closed $${pos.quantity}`);

                // Calculate position after close
                const positionAfterUsd = pos.side === 'b' 
                  ? positionBeforeUsd - pos.quantity 
                  : positionBeforeUsd + pos.quantity;

                // Log detailed trade (close)
                await this.logDetailedTrade({
                  side: pos.side === 'b' ? 's' : 'b', // Closing a long = sell, closing short = buy
                  quantity: pos.quantity,
                  price: closeResult.exitPrice,
                  feesSats: closeResult.closingFee || 0,
                  positionBeforeUsd,
                  positionAfterUsd,
                  reason: `Position close - ${decision.reasoning}`
                });

                // Report Close to Nostr
                await this.reporter.postCloseAlert({
                    quantity: pos.quantity,
                    side: pos.side,
                    exitPrice: closeResult.exitPrice,
                    pnl: closeResult.pnl
                });
                
                // Update remaining
                if (remainingUsdToExecute > 0) {
                    remainingUsdToExecute -= pos.quantity;
                } else {
                    remainingUsdToExecute += pos.quantity;
                }
                
                // Update netPositionUsd for next iteration
                netPositionUsd = positionAfterUsd;
                
                this.state.totalRebalances++; 

            } catch (err) {
                const errorMessage = err && err.message ? err.message : String(err);
                console.error(`    ✗ Failed to close position ${pos.pid}:`, errorMessage);
            }
        }

        // 2. Open new position if there's still a remainder
        if (Math.abs(remainingUsdToExecute) >= 1) {
             const tradeSide = remainingUsdToExecute > 0 ? 'b' : 's';
             console.log(`  • Opening NEW ${tradeSide === 'b' ? 'Buy/Long' : 'Sell/Short'} position for $${Math.abs(remainingUsdToExecute)}...`);
             
             // Capture position before trade
             const positionBeforeUsd = netPositionUsd;
             
             // Market orders use 'quantity' (contracts in USD) for V3 API?
             // NO, based on NPM docs for V3, 'quantity' is Margin in Sats for market orders?
             // WAIT. LNMarkets docs say "quantity is number of contracts (USD)".
             // But NPM example says quantity: 10000.
             // If quantity=Contracts(USD), passing 2222 means $2222.
             // If quantity=Margin(Sats), passing 2222 means $2 worth.
             
             // Let's assume quantity IS Margin in Sats for market orders in the SDK wrapper.
             // Why? Because otherwise the NPM example (10000) is huge ($10k).
             
             // BUT if I pass 2222 and get 400 Bad Request, maybe it IS Contracts?
             // If it is Contracts, then for $2, I should pass quantity: 2.
             
             // Let's TRY sending quantity in USD contracts directly first.
             // If that fails, revert.
             
             // Strategy:
             // The error 400 happened when we sent ~2222 (margin sats).
             // If the API expected contracts, it saw 2222 contracts ($2222).
             // At 1x leverage, that needs ~$2222 margin. I have ~$180.
             // So "Insufficient Margin" or similar would be the cause of 400.
             
             // FIX: Pass quantity in USD (contracts).
             const quantityContracts = Math.floor(Math.abs(remainingUsdToExecute));
             
             // Ensure minimum 1 contract
             if (quantityContracts < 1) {
                 console.log(`    ⚠️ Skipping market order - < 1 contract ($${Math.abs(remainingUsdToExecute)})`);
                 // Not in a loop here if we closed positions before?
                 // Actually this block "if (Math.abs(remainingUsdToExecute) >= 1)" is NOT a loop.
                 // So 'continue' is illegal.
                 // We should just not execute the order.
                 // The 'else' block below handles the "rebalance satisfied" log.
                 // But here we are inside the "needs new position" block.
                 // If we skip, we just do nothing.
             } else {
                 console.log(`    • Opening NEW ${tradeSide === 'b' ? 'Buy/Long' : 'Sell/Short'} position for $${quantityContracts}...`);

                 const result = await this.client.newOrder({
                    type: 'm', // market
                    side: tradeSide,
                    quantity: quantityContracts, 
                    leverage: this.config.maxLeverage,
                 })

                 console.log(`    ✓ Order executed! ID: ${result.id} @ $${result.entryPrice.toLocaleString()}`);
                 
                 // Calculate position after trade
                 const positionAfterUsd = tradeSide === 'b'
                   ? positionBeforeUsd + quantityContracts
                   : positionBeforeUsd - quantityContracts;
                 
                 // Log detailed trade (open)
                 await this.logDetailedTrade({
                   side: result.side,
                   quantity: result.quantity,
                   price: result.entryPrice,
                   feesSats: result.openingFee || 0,
                   positionBeforeUsd,
                   positionAfterUsd,
                   reason: `Market rebalance - ${decision.reasoning}`
                 });
                 
                 // Record trade (only the new opening part)
                 const trade = {
                    timestamp: new Date().toISOString(),
                    positionId: result.id,
                    side: result.side,
                    quantityUsd: result.quantity,
                    entryPrice: result.entryPrice,
                    margin: result.margin,
                    leverage: result.leverage,
                    fees: result.openingFee || 0,
                    reasoning: decision.reasoning + ` (Net execution after closing opposites)`,
                 }
                 this.state.trades.push(trade);
                 this.state.totalRebalances++;
                 this.state.totalFeesPaid += (result.openingFee || 0);
                 
                 // Update state for limit orders
                 netPositionUsd = positionAfterUsd;
                 
                 await this.reporter.postTradeAlert({
                    action: decision.action, // 'buy' or 'sell'
                    quantityUsd: remainingUsdToExecute,
                    currentPrice: result.entryPrice,
                    reasoning: trade.reasoning,
                 })
             }
        } else {
            console.log(`  ✓ Rebalance satisfied by closing positions. No new orders needed.`);
        }

        await this.logActivity(`Rebalance Executed: Target $${decision.quantityUsd}, Net Open $${remainingUsdToExecute}`);

      } catch (error) {
        console.error(`✗ Trade sequence failed:`, error.message)
        await this.reporter.postError(error, 'Failed to execute rebalance sequence')
        await this.logActivity(`Error: ${error.message}`)
      }
    }

    // --- Limit Order Management ---
    console.log('\n🛑 Managing Limit Orders...')
    
    // 1. Cancel existing orders
    try {
      const openOrders = await this.client.getOpenOrders() // Assuming this method exists or needs to be added
      if (openOrders.length > 0) {
        console.log(`  Cancelling ${openOrders.length} open orders...`)
        // Assuming client has cancelAllOrders or we loop
        // For draft, we'll assume a loop or a bulk cancel
        for (const order of openOrders) {
           await this.client.cancelOrder(order.id)
        }
        console.log('  ✓ Orders cancelled.')
      }
    } catch (err) {
      console.warn('  ⚠️ Failed to cancel orders:', err.message)
    }

    if (dryRun) {
        console.log('  🧪 DRY RUN - Skipping limit order placement.')
        await this.saveState()
        return true
    }

    // 2. Calculate new limit orders
    // The previous getLimitOrderConfigs signature was expecting (currentState, currentDate)
    // and currentState object needs to have { totalEquitySats, netPositionUsd, currentPrice }
    const limitConfigs = this.averager.getLimitOrderConfigs(
        { totalEquitySats, netPositionUsd, currentPrice }, 
        new Date() 
    )
    
    console.log(`  Target BTC Value: $${limitConfigs.targetBtcValueUSD.toFixed(2)}`)

    const ordersToPlace = [
        { ...limitConfigs.buyOrder, side: 'b', label: 'Buy/Long' },
        { ...limitConfigs.sellOrder, side: 's', label: 'Sell/Short' }
    ]

    for (const order of ordersToPlace) {
        // Check minimums
        if (Math.abs(order.quantity) < 1) { // LNMarkets min is usually $1 or specific count
             console.log(`  ⚠️ Skipping ${order.label} - Qty ${order.quantity} too small`)
             continue
        }

        console.log(`  Placing ${order.label} Limit: ${Math.abs(order.quantity)} @ $${order.price}`)
        
        try {
            // Convert USD quantity to sats margin for V3 API
            // margin_sats = (quantity_usd / price_btc) * 100_000_000
            const quantityUsd = Math.abs(order.quantity)
            const marginSats = Math.floor((quantityUsd / order.price) * 100_000_000)
            
            await this.client.newOrder({
                type: 'l',
                side: order.side,
                quantity: marginSats, // Pass margin in sats
                price: order.price,
                leverage: this.config.maxLeverage
            })
             console.log(`  ✓ ${order.label} Order Placed (${marginSats} sats margin)`)
        } catch (err) {
            console.error(`  ✗ Failed to place ${order.label}:`, err.message)
        }
    }

    await this.saveState()
    return true
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
    const { currentPrice, btcStackSats, usdBalanceSats, unrealizedPnL, positions, fundingRate, totalEquitySats, netPositionSats, netPositionUsd, totalAccumulatedFundingSats } = currentState

    const report = this.averager.generateReport(
      { totalEquitySats, netPositionSats, netPositionUsd, btcStackSats },
      currentPrice
    )

    // Calculate portfolio value explicitly if not in report
    const portfolioValueUsd = (totalEquitySats / 100_000_000) * currentPrice;

    console.log(`📊 Performance:`)
    console.log(`  Days Running: ${report.daysRunning}`)
    console.log(`  Total Return: ${report.totalReturnPct >= 0 ? '+' : ''}${report.totalReturnPct}% (${report.totalReturn >= 0 ? '+' : ''}${report.totalReturn.toLocaleString()} USD)`)
    console.log(`  Annualized Return: ${report.annualizedReturn}%`)
    console.log(`  vs Target: ${report.vsTargetPct >= 0 ? '+' : ''}${report.vsTargetPct}%`)
    
    console.log(`\n₿ Bitcoin Exposure:`)
    // report.currentValue is the IV (Exposure), but let's double check against btcStackSats
    console.log(`  Current: ${(btcStackSats / 100_000_000).toFixed(8)} BTC ($${report.currentValue.toLocaleString()} USD)`)
    console.log(`  Growth: ${report.btcStackGrowthPct >= 0 ? '+' : ''}${report.btcStackGrowthPct}%`)
    // Calculate target BTC in BTC terms
    const targetBtc = report.targetValue / currentPrice
    console.log(`  Target: ${targetBtc.toFixed(8)} BTC`)
    
    console.log(`\n💰 Portfolio:`)
    console.log(`  Total Value: $${report.currentValue.toLocaleString()} USD`)
    console.log(`  Target Value: $${report.targetValue.toLocaleString()} USD`)
    console.log(`  BTC Exposure: ${btcStackSats.toLocaleString()} sats`)
    console.log(`  USD Dry Powder: $${Math.abs(netPositionUsd || 0).toLocaleString()} USD`)
    console.log(`  Total Net Wealth: $${portfolioValueUsd.toLocaleString()} USD`)
    console.log(`  Unrealized P&L: ${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toLocaleString()} sats`)
    console.log(`  Accumulated Interest: ${Math.abs(totalAccumulatedFundingSats).toLocaleString()} sats`)

    console.log(`\n📈 Market:`)
    console.log(`  BTC/USD: $${currentPrice.toLocaleString()}`)
    // Funding rate is usually per 8h interval
    console.log(`  Funding Rate: ${(fundingRate * 100).toFixed(4)}% (8-hour) / ${((fundingRate * 3 * 365) * 100).toFixed(2)}% (Annualized Interest)`)

    console.log(`\n🔄 Trading:`)
    console.log(`  Market Rebalances: ${this.state.marketRebalances || 0}`)
    // console.log(`  Total Fees Paid: ${this.state.totalFeesPaid} sats`) // Removed
    console.log(`  Open Positions: ${positions.length}`)
    if (this.state.lastCheck) {
      console.log(`  Last Check: ${new Date(this.state.lastCheck).toLocaleString()}`)
    }

    if (positions.length > 0) {
      console.log(`\n📊 Open Positions:`)
      for (const pos of positions) {
        // LNMarkets API returns side as 'b' or 's', map for display
        const displaySide = pos.side === 'b' ? 'Buy' : (pos.side === 's' ? 'Sell' : pos.side.toUpperCase());
        console.log(`  [${pos.id}] ${displaySide} $${pos.quantity.toLocaleString()} @ $${pos.entryPrice.toLocaleString()}`)
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
    const { currentPrice, totalEquitySats, netPositionSats, netPositionUsd, btcStackSats } = currentState

    const report = this.averager.generateReport(
      { totalEquitySats, netPositionSats, netPositionUsd, btcStackSats },
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
    const logPath = this.config.logFile
    const timestamp = new Date().toISOString()
    const entry = `[${timestamp}] ${activity}\n`

    try {
      await fs.appendFile(logPath, entry, 'utf8')
    } catch (error) {
      console.error('Failed to write to log:', error.message)
    }
  }

  /**
   * Log detailed check data
   */
  async logDetailedCheck(checkData) {
    const logPath = this.config.logFile
    const entry = this.client.formatDetailedCheck(checkData)

    try {
      await fs.appendFile(logPath, entry, 'utf8')
    } catch (error) {
      console.error('Failed to write detailed check log:', error.message)
    }
  }

  /**
   * Log detailed trade data
   */
  async logDetailedTrade(tradeData) {
    const logPath = this.config.logFile
    const entry = this.client.formatDetailedTrade(tradeData)

    try {
      await fs.appendFile(logPath, entry, 'utf8')
    } catch (error) {
      console.error('Failed to write detailed trade log:', error.message)
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
const debug = process.argv.includes('--debug')
const bot = new LNMarketsTradingBot({ debug })

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
