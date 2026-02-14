# LNMarkets Trading Bot - Research & Strategy Notes

## Value Averaging (VA) Strategy

### What is Value Averaging?

Developed by Michael Edleson (1988), value averaging is an investment strategy that adjusts contribution amounts to maintain a predetermined value growth path.

**Key Difference from DCA:**

| Strategy | Investment Amount | Market Response |
|----------|------------------|-----------------|
| Dollar Cost Averaging (DCA) | Fixed amount each period | Passive, same $ every time |
| Value Averaging (VA) | Variable, based on target | Active, more when down, less/sell when up |

### VA Formula

```
Target Value(t) = Initial Investment × (1 + Growth Rate)^t
Investment Amount(t) = Target Value(t) - Current Value(t)
```

Where:
- `t` = time periods elapsed
- Growth Rate = desired periodic return (e.g., 0.8%/month)

### Why VA Works for Bitcoin

1. **Volatility Harvesting**: BTC's high volatility creates frequent rebalance opportunities
2. **Automatic Buy Low, Sell High**: System forces buying dips and taking profits
3. **Stack Accumulation**: Consistently grows BTC holdings over time
4. **Risk Management**: Reduces exposure during pumps, preserves capital

### VA vs Other Strategies

| Strategy | Bull Market | Bear Market | Sideways | Complexity |
|----------|------------|-------------|----------|-----------|
| HODL | Best | Worst | Neutral | Lowest |
| DCA | Good | Good | Good | Low |
| Value Averaging | Good | Better | Best | Medium |
| Active Trading | Variable | Variable | Variable | Highest |

**Our Conclusion**: VA is ideal for BTC accumulation in current market (consolidation phase).

## LNMarkets Platform Analysis

### What is LNMarkets?

- **Type**: Bitcoin derivatives exchange (futures/options)
- **Unique**: Lightning Network integration (instant deposits/withdrawals)
- **Product**: Perpetual futures on aggregated BTC/USD index
- **Users**: Retail traders, algo traders, bots (ODELL and Marty Bent confirmed)

### Advantages

1. **Lightning deposits**: Instant, low-fee funding
2. **No KYC**: Privacy-friendly (for now)
3. **Aggregated index**: Less exposure to single exchange manipulation
4. **API-first**: Great documentation, easy automation
5. **Testnet**: Risk-free testing environment

### Disadvantages

1. **Smaller platform**: Less liquidity than Binance/Bybit
2. **Funding fees**: Perpetual futures have 8-hour funding
3. **Custody risk**: Not your keys (though Lightning reduces this)
4. **Limited products**: Only BTC/USD futures (no altcoins)

### Fee Structure

| Volume (30-day) | Trading Fee | Our Expected |
|----------------|-------------|--------------|
| $0 - $250k | 0.1% | ✓ Start here |
| $250k - $1M | 0.08% | After ~6 months |
| $1M - $5M | 0.07% | Unlikely |
| $5M+ | 0.06% | Unlikely |

**Round-trip cost**: 0.2% (open + close at Tier 1)

**Funding fees**: ~0.01-0.05% per 8 hours
- Positive rate: Long positions pay shorts
- Negative rate: Short positions pay longs
- Typical: 0.03% per 8h = 0.09%/day = ~32%/year (annualized)

**Total holding cost**: Trading (0.2%) + Funding (varies) = **~0.3-0.5% per full cycle**

### Rate Limits

- Authenticated: 1 request/second (REST)
- Unauthenticated: 30 requests/minute
- Websocket: Real-time, no limits (subscriptions)

**Bot implication**: 6-hour check interval is well within limits.

### Risk Factors

1. **Platform risk**: Insolvency, hack, exit scam (mitigated by Lightning withdrawals)
2. **Liquidation**: Only applies if using leverage (we use 1x = none)
3. **Funding rate spikes**: Can eat into profits during extreme markets
4. **API downtime**: Can't rebalance during outages (rare)

## Strategy Parameters

### Capital Allocation

**Initial**: 200,000 sats
- 50% BTC-equivalent (~100k sats worth of long positions)
- 50% USD-equivalent (~100k sats in available balance)

**Rationale**: 
- 50/50 allows equal buying power in both directions
- Starting balanced = immediate opportunity to rebalance either way

### Growth Rate: 0.8%/month (Conservative)

**Why 0.8%?**

- Bitcoin historical: ~100-200% annually (highly variable)
- Value averaging studies: 6-12% annually realistic for stocks
- Accounting for fees: 0.8%/month = 10% annual, minus ~1% fees = **9% net target**
- Conservative enough to hit consistently in ranging markets

**Alternatives considered:**
- 0.5%/month (6% annual): Too conservative, misses BTC's upside
- 1.5%/month (18% annual): Too aggressive, requires more volatility

### Rebalance Threshold: 5%

**Why 5%?**

Break-even analysis:
- Round-trip fees: 0.2%
- Typical funding (1 cycle): 0.09%
- Total cost: ~0.3%
- Safety margin: 3x fees = 0.9%
- **5% threshold ensures profitable rebalances**

**Alternatives considered:**
- 2-3%: Too frequent, burns fees
- 10%+: Misses opportunities, drifts too far from target

### Check Interval: 6 Hours

**Why 6 hours?**

- Matches funding intervals (0:00, 8:00, 16:00 UTC)
- 4 checks/day = responsive without over-trading
- API rate limits: 4 checks × 5 requests = 20/day (well under limit)
- Balances responsiveness with fee conservation

**Alternatives considered:**
- 1 hour: Too frequent, potential overtrading
- 12 hours: Misses opportunities, too slow
- 24 hours: Way too slow for BTC volatility

### Max Leverage: 1x (No Leverage)

**Why no leverage?**

- **Safety first**: No liquidation risk
- **Sleep well**: No risk of overnight wipeout
- **Capital preservation**: Focus on stack growth, not gambling
- **Complexity**: Easier to manage and explain

**Future consideration**: Could test 2-3x leverage in ranging markets, but only after proven track record.

### Minimum Trade Size: 10,000 sats

**Why 10k minimum?**

- Avoids dust trades (small rebalances)
- Fee efficiency: 0.2% of 10k = 20 sats (acceptable)
- API minimums: Most platforms have implicit minimums
- Psychological: Meaningful trades only

## Comparison to ODELL & Marty's Bots

**What we know** (from podcasts/Twitter):
- Both run automated bots on LNMarkets
- ODELL: Likely swing trading strategy (speculation)
- Marty: Likely DCA or stacking strategy (conservative)
- Both: Private about specifics (competitive edge)

**Our approach differs:**
- **Public**: Sharing strategy openly (educational)
- **Value Averaging**: More systematic than DCA, less risky than swing trading
- **Nostr updates**: Transparent performance reporting
- **Open source ready**: Could publish as skill/tool for others

## Expected Performance Scenarios

### Scenario 1: Sideways Market (Most Likely)

BTC ranges $90k-$105k for 6 months

**Projection:**
- Rebalances: ~15-20 (avg 1/week)
- Fees paid: ~3,000 sats (1.5% of capital)
- Stack growth: +8,000-12,000 sats (+8-12%)
- Net return: +5,000-9,000 sats (+5-9%)
- vs HODL: Better (HODL = 0% in sideways market)

### Scenario 2: Bull Market

BTC runs to $150k+ in 6 months

**Projection:**
- Rebalances: ~8-12 (sell pressure as price climbs)
- Fees paid: ~2,000 sats
- Stack growth: +3,000-5,000 sats (+3-5%)
- Net return: +50,000-80,000 sats (from price appreciation)
- vs HODL: Slightly worse (sold some during climb)

**Note**: VA underperforms pure HODL in strong trends but preserves capital better.

### Scenario 3: Bear Market

BTC drops to $60k in 6 months

**Projection:**
- Rebalances: ~20-30 (heavy buying as price falls)
- Fees paid: ~4,000 sats
- Stack growth: +15,000-25,000 sats (+15-25%)
- Net return: -30,000 sats (price drop offset by increased stack)
- vs HODL: Much better (accumulated more BTC during dip)

**Note**: VA shines in bear markets - "be greedy when others are fearful."

### Scenario 4: Extreme Volatility

BTC swings ±20% weekly (current environment)

**Projection:**
- Rebalances: ~30-40 (frequent swings)
- Fees paid: ~5,000 sats (2.5%)
- Stack growth: +20,000-30,000 sats (+20-30%)
- Net return: Variable (depends on direction)
- vs HODL: Better (harvests volatility both ways)

**Note**: VA performs best in choppy, volatile markets.

## Risk Mitigation

### Technical Risks

1. **API failure**: 
   - Mitigation: State saved to disk, resume on reconnect
   - Fallback: Manual intervention possible

2. **Rate limiting**:
   - Mitigation: 6h interval well within limits
   - Fallback: Exponential backoff in code

3. **Price slippage**:
   - Mitigation: Market orders, small sizes
   - Monitoring: Log all executions

### Financial Risks

1. **Funding fee accumulation**:
   - Mitigation: Monitor funding rate, close if extreme (>0.1%)
   - Hedge: Can switch to shorts if funding too high

2. **Gap risk** (price jumps while bot offline):
   - Mitigation: 6h checks = max 6h exposure gap
   - Acceptance: Part of automated trading

3. **Platform insolvency**:
   - Mitigation: Withdraw profits regularly via Lightning
   - Diversification: Don't put all capital on one platform

### Operational Risks

1. **Parameter drift** (market regime change):
   - Mitigation: Monthly review, adjust if needed
   - Monitoring: Track performance vs target

2. **Over-trading** (too frequent rebalances):
   - Mitigation: 5% threshold enforces discipline
   - Monitoring: Track rebalance frequency

3. **Under-trading** (missing opportunities):
   - Mitigation: 6h checks catch most moves
   - Acceptance: Conservative approach prioritizes safety

## Performance Metrics to Track

### Daily
- Current value vs target value (deviation %)
- BTC stack size and growth rate
- Unrealized P&L on open positions
- Funding fees paid

### Weekly
- Number of rebalances executed
- Average trade size
- Win rate (profitable rebalances)
- Stack growth % vs target

### Monthly
- Total return % (sats + BTC price)
- Annualized return projection
- Fees paid as % of capital
- Sharpe ratio (return/volatility)
- vs HODL comparison

### Quarterly
- Parameter effectiveness review
- Fee tier progression
- Strategy adjustments needed?
- Capital increase/decrease decisions

## Future Enhancements

### Phase 1 (Weeks 1-4): Prove It Works
- ✅ Build core bot
- ✅ Test on mainnet with 200k sats
- Track performance daily
- Debug any issues
- Build confidence

### Phase 2 (Months 2-3): Optimize
- Add volatility detection (widen threshold in low-vol)
- Implement dynamic growth rate (based on recent performance)
- Add stop-loss on positions (circuit breaker)
- Improve Nostr reporting (charts?)

### Phase 3 (Months 4-6): Scale
- Increase capital if performing well
- Test 2x leverage (carefully)
- Add options hedging (LNMarkets has options)
- Consider multi-exchange (diversification)

### Phase 4 (Future): Open Source
- Package as OpenClaw skill
- Publish to ClawHub
- Create tutorial/course
- Build community of VA traders

## Research References

### Value Averaging
- Edleson, Michael E. "Value Averaging: The Safe and Easy Strategy for Higher Investment Returns" (1991)
- Academic studies: VA outperforms DCA in volatile markets
- Caveat: Requires discipline and rebalancing

### Bitcoin Trading
- "The Bitcoin Standard" (Ammous) - HODL philosophy
- "Layered Money" (Nik Bhatia) - Bitcoin as settlement layer
- LNMarkets blog: https://blog.lnmarkets.com

### Algorithmic Trading
- "Algorithmic Trading" (Chan) - Systematic strategies
- "Quantitative Trading" (Chan) - Backtesting methods
- Kelly Criterion: Optimal position sizing

### Risk Management
- "Fooled by Randomness" (Taleb) - Understanding luck vs skill
- "The Black Swan" (Taleb) - Tail risk management
- Modern Portfolio Theory: Diversification benefits

## Conclusion

**This bot is designed to:**
1. ✅ Systematically grow your BTC stack
2. ✅ Operate autonomously (6h checks)
3. ✅ Minimize risk (no leverage, isolated margin)
4. ✅ Be transparent (Nostr updates, open source ready)
5. ✅ Survive session restarts (persistent state)

**Conservative target**: 8-10% annual stack growth, beating HODL in sideways/volatile markets.

**Best case**: 15-20% annual growth in highly volatile ranging market.

**Worst case**: Slight underperformance vs HODL in strong bull run, but capital preserved in bear.

**Overall**: A disciplined, systematic approach to BTC accumulation using time-tested value averaging principles adapted for crypto volatility.

---

Built with 🪝 by Clawd
