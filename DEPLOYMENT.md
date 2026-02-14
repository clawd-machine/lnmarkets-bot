# LNMarkets Trading Bot - Deployment Checklist

## Pre-Deployment

- [ ] LNMarkets account created
- [ ] 200,000+ sats deposited
- [ ] API credentials generated (Read + Trade permissions)
- [ ] Nostr account working (ClawdZap tested)
- [ ] Understanding of value averaging strategy
- [ ] Risk tolerance confirmed (comfortable with automated trading)

## Installation

- [ ] Dependencies installed: `cd lnmarkets-bot && npm install`
- [ ] Credentials file created: `cp credentials.json.example credentials.json`
- [ ] Credentials filled in (key, secret, passphrase)
- [ ] Test connection works: `node bot.js status` (expect "not initialized" message)

## Testing (HIGHLY RECOMMENDED)

### Option 1: Testnet (Safest)
- [ ] Get testnet sats from LNMarkets faucet
- [ ] Change `config.js`: `network: 'testnet'`
- [ ] Test full workflow on testnet
- [ ] Verify rebalancing logic works
- [ ] Switch back to mainnet when confident

### Option 2: Dry Run (Medium Safety)
- [ ] Initialize bot: `node bot.js init`
- [ ] Run dry run: `node bot.js rebalance --dry-run`
- [ ] Review what trade WOULD execute
- [ ] Verify calculations make sense
- [ ] Run live only when confident

### Option 3: Small Capital (Low Safety)
- [ ] Edit `config.js`: `initialCapital: 50000` (50k sats)
- [ ] Run with smaller amount first
- [ ] Scale up after proving it works

## Initialization

- [ ] Run init: `node bot.js init`
- [ ] Verify Nostr post appears (initialization announcement)
- [ ] Check state file created: `ls -la state.json`
- [ ] Check status: `node bot.js status`
- [ ] Verify initial values look correct

## First Rebalance

- [ ] Run dry run first: `node bot.js rebalance --dry-run`
- [ ] Review the decision logic
- [ ] Confirm you understand what will happen
- [ ] Run live: `node bot.js rebalance`
- [ ] Check LNMarkets UI to confirm position opened
- [ ] Verify Nostr trade alert posted
- [ ] Check memory log updated

## Automation Setup

Choose ONE method:

### Method A: OpenClaw Cron (Recommended)
- [ ] Run: `node bot.js setup-cron`
- [ ] Copy the JSON configuration shown
- [ ] Add to OpenClaw cron via gateway tool or web UI
- [ ] Verify cron job created: Use cron list command
- [ ] Wait for first automated run (6 hours)
- [ ] Check logs after first run

### Method B: System Cron
- [ ] Add crontab entry: `crontab -e`
- [ ] Paste: `0 */6 * * * cd ~/.openclaw/workspace/lnmarkets-bot && node bot.js rebalance >> /tmp/lnm-bot.log 2>&1`
- [ ] Save and exit
- [ ] Verify: `crontab -l`
- [ ] Check log after first run: `tail /tmp/lnm-bot.log`

## Monitoring Setup

- [ ] Bookmark Nostr profile (for public updates)
- [ ] Add memory log to daily checks: `memory/lnmarkets-trading.md`
- [ ] Set reminder to check status weekly
- [ ] Document expected performance in MEMORY.md
- [ ] Consider setting up alerts (Discord webhook, email, etc.)

## Day 1 Checks

- [ ] Morning: Run `node bot.js status`
- [ ] Afternoon: Check if rebalance executed
- [ ] Evening: Review any positions opened
- [ ] Night: Verify Nostr updates posting
- [ ] Before bed: Quick status check

## Week 1 Checks (Daily)

- [ ] Day 2: Status check, verify automation working
- [ ] Day 3: Review first few trades
- [ ] Day 4: Check funding fees accrued
- [ ] Day 5: Assess if parameters need tweaking
- [ ] Day 6: Calculate current performance vs target
- [ ] Day 7: Generate weekly report: `node bot.js report`

## Week 2-4 Checks (Every 2-3 days)

- [ ] Monitor that cron is running
- [ ] Check for any error messages
- [ ] Verify positions make sense
- [ ] Track stack growth vs target
- [ ] Watch funding fee accumulation

## Monthly Review

- [ ] Generate full report
- [ ] Calculate actual returns vs projections
- [ ] Compare to HODL strategy
- [ ] Review parameter effectiveness:
  - Is rebalance threshold too tight/loose?
  - Is growth rate achievable?
  - Are fees eating too much profit?
- [ ] Adjust config if needed
- [ ] Document changes in MEMORY.md
- [ ] Post monthly summary to Nostr

## Emergency Procedures

### If Bot Malfunctions
1. Check logs: `tail -100 ../memory/lnmarkets-trading.md`
2. Check state file: `cat state.json`
3. Run status manually: `node bot.js status`
4. If positions look wrong, pause automation
5. Contact LNMarkets support if needed

### If You Need to Stop
1. Disable cron job (comment out or delete)
2. Close all positions manually (via LNMarkets UI or API)
3. Withdraw funds via Lightning
4. Document what happened in MEMORY.md

### If Market Goes Crazy
1. Funding fees spike (>0.1% per 8h):
   - Consider closing positions temporarily
   - Wait for rates to normalize
   - Resume when funding <0.05%

2. BTC crashes/moons (>30% in 24h):
   - Bot will rebalance automatically (this is good!)
   - May hit rate limits due to rapid changes
   - Monitor closely, but let it work

3. LNMarkets downtime:
   - Bot will fail gracefully
   - State preserved on disk
   - Resumes on next check
   - No action needed unless prolonged

## Performance Benchmarks

### Week 1 Expectations
- Rebalances: 1-3
- Stack growth: 0-2%
- Learning curve: High
- Confidence: Building

### Month 1 Expectations
- Rebalances: 4-8
- Stack growth: 0.5-1.5%
- Fees: ~0.3-0.5% of capital
- Net gain: Small but positive

### Month 3 Expectations
- Rebalances: 12-24
- Stack growth: 2-4%
- Strategy: Well-tuned
- Confidence: High

### Month 6 Expectations
- Rebalances: 24-48
- Stack growth: 4-8%
- Returns: Beating HODL (if market sideways/volatile)
- Fees: Tier 2 unlocked? (if >$250k volume)

## Red Flags (When to Intervene)

🚩 **Rebalancing too frequently** (>2/day)
- Check threshold, consider raising to 7-10%

🚩 **Not rebalancing at all** (0 trades in 1 week)
- Market too stable, or bot broken?
- Check logs, verify cron running

🚩 **Funding fees eating profits** (>1% monthly)
- Consider shorter holding periods
- Or accept as cost of strategy

🚩 **Stack shrinking** (despite BTC price stable)
- Something wrong with logic
- Review trades, check for bugs

🚩 **Error messages accumulating**
- API issues, credentials expired?
- Fix immediately

## Success Criteria

✅ **After 1 week:**
- Bot running without errors
- At least 1 successful rebalance
- Nostr updates posting
- You understand what it's doing

✅ **After 1 month:**
- Stack growing (even if small)
- Fees under control (<1% of capital)
- No manual interventions needed
- Confident in strategy

✅ **After 3 months:**
- Positive returns vs target path
- Strategy proven in different market conditions
- Comfortable leaving it alone
- Considering scaling up

✅ **After 6 months:**
- Clear outperformance vs HODL (in sideways market)
- OR acceptable underperformance vs HODL (in bull market)
- Fees optimized (possibly Tier 2)
- Ready to teach others / open source

## Final Pre-Launch Checklist

Before running `node bot.js init` for real:

- [ ] I understand value averaging
- [ ] I've read the RESEARCH.md file
- [ ] I'm comfortable with 200k sats at risk
- [ ] I have API credentials ready
- [ ] I've tested the bot (testnet or dry-run)
- [ ] I know how to monitor it
- [ ] I know how to stop it if needed
- [ ] I accept that this is experimental
- [ ] I'm ready to learn and iterate
- [ ] Let's fucking go! 🚀

---

**Remember**: Start small, monitor closely, iterate based on results. This is a learning process!

Good luck! 🪝

---

Built by Clawd for Brendan
Version 1.0 - February 2026
