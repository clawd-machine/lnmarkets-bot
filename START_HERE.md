# 🪝 LNMarkets Value Averaging Trading Bot - START HERE

## What Is This?

An **automated Bitcoin trading bot** that uses **value averaging** to systematically grow your BTC stack on LNMarkets.

**Not familiar with value averaging?** It's like dollar-cost averaging, but smarter:
- DCA: Buy $100 of BTC every week (fixed)
- **VA: Adjust purchases to hit a target value path (buy more when down, less/sell when up)**

## Quick Facts

- 💰 **Initial Capital**: 200,000 sats (~$200 at current prices)
- 🎯 **Target**: 0.8% monthly stack growth (~10% annually)
- ⚡ **Strategy**: Value Averaging (systematic rebalancing)
- 🔄 **Frequency**: Checks every 6 hours, trades when needed
- 🛡️ **Safety**: No leverage (1x only), isolated margin
- 📢 **Transparency**: Posts updates to your Nostr account
- 🤖 **Persistence**: Survives session restarts (state saved to disk)

## Do I Need This?

**You might want this if:**
- ✅ You want to grow your BTC stack systematically
- ✅ You believe BTC will stay volatile/sideways for a while
- ✅ You're okay with automated trading (while you sleep)
- ✅ You have 200k+ sats you can afford to experiment with
- ✅ You like ODELL and Marty's approach (they run LNM bots too!)

**Skip this if:**
- ❌ You're pure HODL and never sell (this takes profits on pumps)
- ❌ You don't trust automation
- ❌ You can't afford to lose the capital (this is experimental!)
- ❌ You expect BTC to moon immediately (VA underperforms in strong trends)

## What Files Do I Need to Read?

**Just getting started?**
1. **This file** (START_HERE.md) ← You are here
2. **SETUP.md** - Installation and configuration (15 min)
3. **DEPLOYMENT.md** - Deployment checklist (follow this step-by-step)

**Want to understand the strategy?**
4. **README.md** - Comprehensive overview
5. **RESEARCH.md** - Deep dive on value averaging, fees, expected performance

**Ready to code/customize?**
6. **config.js** - All parameters (growth rate, threshold, intervals)
7. **bot.js** - Main bot logic
8. **lib/** - Modules (VA engine, LNMarkets client, Nostr reporter)

## Installation (5 Minutes)

```bash
# 1. Go to bot directory
cd ~/.openclaw/workspace/lnmarkets-bot

# 2. Install dependencies
npm install

# 3. Copy credentials template
cp credentials.json.example credentials.json

# 4. Edit credentials (add your LNMarkets API key/secret/passphrase)
nano credentials.json

# 5. Test connection
node bot.js status
```

**Expected output:**
```
✗ Bot not initialized. Run "init" first.
```

That's good! It means your setup is correct. Now read SETUP.md for the full walkthrough.

## Quick Start (For the Impatient)

**⚠️ Warning: Only do this if you've read SETUP.md and understand the risks!**

```bash
# Initialize bot
node bot.js init

# Test with dry run (no real trades)
node bot.js rebalance --dry-run

# Run first rebalance (REAL MONEY)
node bot.js rebalance

# Check status
node bot.js status

# Set up automation (6-hour checks)
node bot.js setup-cron
# Then add the cron job it shows you
```

## How It Works (ELI5)

1. **You set a target**: "I want my BTC stack to grow 0.8% per month"
2. **Bot checks regularly**: Every 6 hours, it checks if you're on track
3. **Rebalances when needed**: 
   - Stack too small? → Buy more BTC
   - Stack too big? → Sell a bit
4. **Posts updates**: Tells you (via Nostr) what it did
5. **Repeats forever**: Until you stop it or run out of capital

## Expected Results

### Best Case (Volatile Sideways Market)
- **Stack growth**: +15-20% in 6 months
- **Rebalances**: ~30-40 (lots of opportunities)
- **vs HODL**: Significantly better

### Base Case (Normal Volatility)
- **Stack growth**: +8-10% in 6 months
- **Rebalances**: ~15-20
- **vs HODL**: Better in sideways, similar in trending

### Worst Case (Strong Bull Run)
- **Stack growth**: +3-5% in 6 months
- **Rebalances**: ~8-12 (kept selling on the way up)
- **vs HODL**: Worse (but you still made money!)

**Key insight**: VA beats HODL in choppy markets, trails in strong trends. Current BTC market? Choppy AF.

## What Could Go Wrong?

### Technical
- ❌ API downtime (LNMarkets goes offline)
  - ✅ Bot resumes when back online
- ❌ Credentials expire
  - ✅ Easy to regenerate
- ❌ Cron job stops running
  - ✅ You'll notice (no Nostr updates)

### Financial
- ❌ Funding fees eat profits
  - ✅ Monitor and adjust strategy
- ❌ BTC moons while you're holding shorts
  - ✅ Loss capped at position size (no leverage)
- ❌ Over-trading (too many rebalances)
  - ✅ Fees burn your capital
  - ✅ Solution: Raise rebalance threshold

### Catastrophic
- ❌ LNMarkets gets hacked/insolvent
  - ✅ Withdraw profits regularly
  - ✅ Lightning makes this quick
- ❌ Bot has a bug, trades incorrectly
  - ✅ Start small, monitor closely
  - ✅ Dry-run mode available

## Monitoring

**Daily (first week):**
- Check Nostr for updates
- Run `node bot.js status`
- Review any trades executed

**Weekly:**
- Run `node bot.js report`
- Check fees vs profits
- Verify automation still running

**Monthly:**
- Full performance review
- Adjust parameters if needed
- Decide whether to scale up

## Getting Help

**Something broken?**
1. Check logs: `tail -100 ../memory/lnmarkets-trading.md`
2. Check state: `cat state.json | jq`
3. Run status: `node bot.js status`
4. Ask Brendan (he understands this stuff)

**Want to learn more?**
- LNMarkets Docs: https://docs.lnmarkets.com
- Value Averaging Book: "Value Averaging" by Michael Edleson
- Ask on Nostr (tag @clawd)

## Next Steps

**New user?**
→ Read **SETUP.md** next

**Ready to deploy?**
→ Follow **DEPLOYMENT.md** checklist

**Want to understand deeply?**
→ Read **RESEARCH.md**

**Want to customize?**
→ Edit **config.js** and read code comments

## Philosophy

This bot embodies:
- 🎯 **Systematic** over emotional
- 📊 **Data-driven** over gut feeling
- 🛡️ **Risk-managed** over YOLO
- 🤖 **Automated** over manual
- 📢 **Transparent** over secretive
- 🧪 **Experimental** over production-ready

It's a **learning tool** as much as a trading tool. Use it, break it, improve it, share what you learn.

## Credits

- **Strategy**: Value Averaging (Michael Edleson, 1988)
- **Platform**: LNMarkets (perpetual futures)
- **Inspiration**: ODELL & Marty (OG LNM bot runners)
- **Built by**: Clawd 🪝 (AI daemon for Brendan)
- **Date**: February 2026

## License

MIT (do whatever you want with this)

Consider open-sourcing to ClawHub after you've proven it works!

---

**Ready?** → Read SETUP.md and let's grow that stack! 🚀📈₿
