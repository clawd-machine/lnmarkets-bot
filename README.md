# LNMarkets Value Averaging Trading Bot

## Overview
An automated value averaging (VA) trading bot for LNMarkets that systematically grows a Bitcoin stack by buying more when price dips and selling when price spikes.

## Strategy: Value Averaging

### What is Value Averaging?
Unlike dollar-cost averaging (DCA) which invests fixed amounts regularly, value averaging adjusts investment amounts based on a target growth path. If the portfolio value falls below the target, you buy MORE. If it rises above target, you sell a bit or buy less.

### Our Implementation
- **Initial Budget**: 200,000 sats
- **Initial Split**: 100,000 sats in BTC, 100,000 sats reserved as USD-equivalent (held on LNMarkets)
- **Target Growth Path**: Linear BTC stack growth at ~0.5-1% per month
- **Rebalancing**: Check value every 6-12 hours, adjust position when deviation >5% from target

### Why This Works for Bitcoin
1. **Volatility harvesting**: Bitcoin's volatility lets you buy low and sell high systematically
2. **Stack growth**: You accumulate more BTC during dips without timing the market
3. **Risk management**: You take profits during pumps, preserving capital
4. **Automated discipline**: No emotional trading

## LNMarkets Platform Details

### Authentication
- API Key, Secret, and Passphrase required
- Generate at: https://app.lnmarkets.com/user/api
- Permissions needed: Read account, Trade futures

### Fees
| Trading Volume (30d) | Fee Rate |
|---------------------|----------|
| $0 - $250k | 0.1% |
| $250k - $1M | 0.08% |
| $1M - $5M | 0.07% |
| $5M+ | 0.06% |

### Funding Fees
- Paid every 8 hours (00:00, 08:00, 16:00 UTC)
- Typically 0.01-0.05% per interval (~0.03-0.15% daily)
- Long positions pay when rate is positive
- Short positions pay when rate is negative

### Rate Limits
- Authenticated: 1 request per second
- Unauthenticated: 30 requests per minute

## Bot Configuration

### Parameters
```javascript
{
  initialCapital: 200000,        // Total sats
  targetBtcAllocation: 0.5,      // 50% in BTC equivalent
  rebalanceThreshold: 0.05,      // Rebalance when 5% off target
  targetGrowthRate: 0.008,       // 0.8% monthly growth (conservative)
  checkInterval: 6 * 60 * 60,    // 6 hours (balances fees vs responsiveness)
  maxLeverage: 1,                // No leverage for safety
  minTradeSats: 10000            // Minimum trade size (avoid dust)
}
```

### Fee Optimization
- **Trading fees**: 0.1% per trade (open + close = 0.2% round-trip)
- **Funding fees**: ~0.04% per 8h = ~0.12% daily
- **Break-even**: Need >0.32% price movement to profit after fees
- **Check interval**: 6-12 hours balances responsiveness with fee burn
- **Rebalance threshold**: 5% ensures trades are meaningful vs fees

## Persistence Strategy

The bot survives session restarts via:

1. **State file**: `lnmarkets-bot/state.json`
   - Current position size
   - Entry prices
   - Target value path
   - Trade history
   - Last check timestamp

2. **Cron job**: Wakes bot every 6 hours
   - Reads state from disk
   - Fetches current price & position
   - Calculates rebalance needed
   - Executes trades if threshold exceeded
   - Updates state file
   - Posts update to Nostr

3. **Memory**: `memory/lnmarkets-trading.md`
   - Daily trade log
   - Performance metrics
   - Notable events

## Nostr Updates

The bot posts to Nostr:
- **Daily summary**: Performance, position, P&L
- **Trade alerts**: When rebalancing occurs
- **Weekly report**: Cumulative performance vs HODL strategy

Format: Short, clear updates with stats
Example: "🪝 LNM Bot: +2.3% this week | Stack: 102,450 sats (+2.4%) | BTC @$96,240 | 3 rebalances"

## Installation

```bash
cd ~/.openclaw/workspace
mkdir -p lnmarkets-bot
cd lnmarkets-bot
npm install @ln-markets/api
```

## Setup

1. **Get LNMarkets API credentials**:
   - Visit https://app.lnmarkets.com/user/api
   - Create API key with "Read" and "Trade Futures" permissions
   - Copy `credentials.json.example` to `credentials.json`
   - Fill in your API key, secret, and passphrase

2. **Install Dependencies**:
   - The bot requires the `clawdzap` skill for Nostr reporting. Ensure it is installed at `../skills/clawdzap`.
   - Run `npm install` inside the `lnmarkets-bot` directory.

3. **Fund account**:
   - Deposit 200,000+ sats to LNMarkets
   - Verify balance via bot status command

4. **Initialize bot**:
   ```bash
   node bot.js init
   ```

5. **Set up cron job**:
   ```bash
   node bot.js setup-cron
   ```

## Files

- `bot.js` - Main bot logic
- `config.js` - Configuration and constants
- `state.json` - Persistent state (positions, history)
- `credentials.json` - API keys (gitignored)
- `lib/lnm-client.js` - LNMarkets API wrapper
- `lib/value-averaging.js` - VA calculation engine
- `lib/nostr-reporter.js` - Nostr posting integration (requires `clawdzap` skill)

## Commands

```bash
# Initialize fresh state
node bot.js init

# Check status (no trading)
node bot.js status

# Run rebalance check (trades if needed)
node bot.js rebalance

# Manual trade (override)
node bot.js trade --quantity 10000 --side long

# Historical performance
node bot.js report

# Setup/update cron job
node bot.js setup-cron

# Test mode (paper trading)
node bot.js rebalance --dry-run
```

## Safety Features

1. **Max leverage**: Hardcoded to 1x (no leverage)
2. **Min trade size**: Prevents dust trades
3. **Dry-run mode**: Test without real trades
4. **Position limits**: Max 50% of capital in any position
5. **Emergency stop**: File-based killswitch (`STOP` file)
6. **Alerts**: Nostr posts on errors/anomalies

## Monitoring

The bot logs to:
- `memory/lnmarkets-trading.md` - Daily activities
- Nostr - Public updates
- Console - Real-time when running manually

## Expected Performance

Conservative estimates:
- **Without bot**: HODL 100,000 sats grows with BTC price only
- **With bot**: Target 0.8%/month stack growth = ~10% annually
- **Fees**: ~0.5-1% annually
- **Net**: 8-9% annual stack growth in sideways markets, better in volatile markets

This beats pure HODL if Bitcoin ranges or consolidates. In strong trends, may underperform moon missions but preserves capital better in dumps.

## Risks

1. **Funding fees**: Extended positions pay daily fees
2. **Volatility**: Extreme moves can trigger liquidation (mitigated by no leverage)
3. **API downtime**: Can't trade during LNMarkets outages
4. **Strategy drift**: May need parameter tuning based on market regime

## Future Enhancements

- [ ] Volatility-adjusted thresholds (wider in ranging markets)
- [ ] Multi-timeframe analysis (trend detection)
- [ ] Dynamic growth rate (based on recent performance)
- [ ] Tax-loss harvesting
- [ ] Integration with other exchanges (diversification)
