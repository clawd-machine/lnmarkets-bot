# LNMarkets Trading Bot - Setup Guide

## Prerequisites

1. **LNMarkets Account**: https://app.lnmarkets.com
2. **Funded Balance**: At least 200,000 sats deposited
3. **Node.js**: Version 18+ (already installed via OpenClaw)
4. **OpenClaw**: Running with Nostr integration (ClawdZap skill)

## Step 1: Get API Credentials

1. Visit https://app.lnmarkets.com/user/api
2. Click "Create New API Key"
3. Set permissions:
   - ✅ Read account information
   - ✅ Trade futures
   - ❌ Withdraw (not needed)
4. Set a passphrase (save this securely!)
5. Copy your API Key and Secret

## Step 2: Install Dependencies

```bash
cd ~/.openclaw/workspace/lnmarkets-bot
npm install
```

This installs the `@ln-markets/api` package.

## Step 3: Configure Credentials

Create `credentials.json`:

```bash
cp credentials.json.example credentials.json
nano credentials.json
```

Fill in your actual credentials:

```json
{
  "key": "your_api_key_here",
  "secret": "your_api_secret_here",
  "passphrase": "your_passphrase_here"
}
```

**⚠️ IMPORTANT**: Keep these credentials secure! They're gitignored by default.

## Step 4: Test Connection

```bash
node bot.js status
```

If you see an error about "Bot not initialized", that's expected. If you see a connection error, check your credentials.

## Step 5: Initialize the Bot

```bash
node bot.js init
```

This will:
- Connect to LNMarkets
- Check your balance
- Create initial state
- Post initialization message to Nostr

Expected output:
```
🪝 Initializing LNMarkets Trading Bot...

✓ Credentials loaded
✓ Connected to LNMarkets (UID: xxx)
✓ Balance: 200,000 sats

✓ Bot initialized!

Configuration:
  Capital: 200,000 sats
  Target BTC allocation: 50%
  Target growth rate: 0.80%/month
  Rebalance threshold: 5%
  Max leverage: 1x
  Check interval: 6 hours
```

## Step 6: Test Dry Run

Before running live, test with a dry run:

```bash
node bot.js rebalance --dry-run
```

This will:
- Fetch current market data
- Calculate rebalance decision
- Show what trade WOULD be executed
- NOT actually execute any trades

## Step 7: Manual Rebalance (Optional)

When you're ready, execute your first rebalance:

```bash
node bot.js rebalance
```

This will execute a real trade if rebalancing is needed.

## Step 8: Set Up Automation

The bot needs to run periodically (every 6 hours recommended). Two options:

### Option A: OpenClaw Cron (Recommended)

```bash
node bot.js setup-cron
```

This will show you the cron job configuration. Add it via OpenClaw:

Or I can do it for you:

```javascript
// Run this in OpenClaw
await cron({
  action: 'add',
  job: {
    name: 'LNMarkets Value Averaging Bot',
    schedule: {
      kind: 'every',
      everyMs: 6 * 60 * 60 * 1000  // 6 hours
    },
    payload: {
      kind: 'systemEvent',
      text: 'cd ~/.openclaw/workspace/lnmarkets-bot && node bot.js rebalance'
    },
    sessionTarget: 'main',
    enabled: true
  }
})
```

### Option B: System Cron

Add to your crontab:

```bash
crontab -e
```

Add line:
```
0 */6 * * * cd ~/.openclaw/workspace/lnmarkets-bot && node bot.js rebalance >> /tmp/lnm-bot.log 2>&1
```

This runs every 6 hours (00:00, 06:00, 12:00, 18:00 UTC).

## Step 9: Monitor

Check status anytime:

```bash
node bot.js status
```

View daily report:

```bash
node bot.js report
```

Check Nostr for public updates (posted to your ClawdZap account).

Check memory log:

```bash
tail -f ~/.openclaw/workspace/memory/lnmarkets-trading.md
```

## Configuration Tweaks

Edit `config.js` to adjust:

- `targetGrowthRate`: Monthly growth target (default 0.8%)
- `rebalanceThreshold`: Trigger threshold (default 5%)
- `checkInterval`: How often to check (default 6 hours)
- `minTradeSats`: Minimum trade size (default 10k sats)
- `maxLeverage`: Leverage limit (default 1x - NO LEVERAGE)

**⚠️ WARNING**: Changing `maxLeverage` above 1x increases risk significantly!

## Safety Features

1. **No Leverage**: Default 1x leverage = no liquidation risk
2. **Isolated Margin**: Each position is isolated from others
3. **Min Trade Size**: Prevents dust trades that waste fees
4. **Dry Run Mode**: Test without real money
5. **Emergency Stop**: Create a file named `STOP` in the bot directory to pause

## Troubleshooting

### "Rate limit exceeded"

LNMarkets limits to 1 request/second. If you see this, the bot will retry automatically. Don't run multiple instances simultaneously.

### "Insufficient balance"

You need at least the minimum trade size available. Check your balance:

```bash
node bot.js status
```

### "Invalid credentials"

Double-check your `credentials.json`. Make sure:
- No extra spaces
- Passphrase matches what you set on LNMarkets
- API key has correct permissions

### Positions not closing

The bot opens positions and holds them until rebalance triggers a reversal. This is normal. To close all:

```javascript
// In OpenClaw or manually via API
// The bot doesn't have a close-all command by default (safety)
```

## Understanding Value Averaging

**Normal DCA**: Buy $100 of BTC every week (fixed amount)

**Value Averaging**: Target $100 growth every week
- If your stack is worth $90: buy $110
- If your stack is worth $105: buy $95  
- If your stack is worth $120: sell $20

This automatically buys more during dips and takes profits during pumps.

## Expected Performance

- **Sideways market**: 8-10% annual stack growth
- **Volatile market**: Better (more rebalance opportunities)
- **Strong trend**: May underperform pure HODL temporarily
- **Fees**: ~0.5-1% annually

## Risk Management

1. **Start small**: Use testnet first or start with lower capital
2. **Monitor regularly**: Check status daily
3. **Adjust parameters**: Based on market conditions
4. **Understand fees**: Funding fees accumulate (8h intervals)
5. **No leverage**: Safest approach for beginners

## Next Steps

1. ✅ Initialize bot
2. ✅ Run first dry run
3. ✅ Execute first rebalance
4. ✅ Set up automation
5. ✅ Monitor for a week
6. 📊 Review performance
7. 🔧 Tweak parameters if needed
8. 📈 Let it run!

---

**Questions?**

Ask Brendan or check:
- LNMarkets Docs: https://docs.lnmarkets.com
- Bot README: `./README.md`
- Config Reference: `./config.js`
