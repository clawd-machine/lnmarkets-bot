// LNMarkets Value Averaging Bot Configuration

export default {
  // Capital allocation
  initialCapital: 200000,        // Total sats to start with
  targetBtcAllocation: 0.5,      // Target 50% in BTC equivalent (rest USD-equivalent)
  
  // Value averaging parameters
  targetGrowthRate: 0.01,       // 0.8% monthly growth rate (conservative)
  rebalanceThreshold: 0.04,      // Rebalance when 5% off target value
  
  // Trading parameters
  maxLeverage: 1,                // No leverage (safety first)
  minTradeSats: 10000,           // Minimum trade size (100k sats)
  maxPositionSize: 1,          // Max 60% of capital in any position
  
  // Timing and intervals
  checkInterval: 4 * 60 * 60 * 1000,  // Check every 4 hours (in ms)
  
  // Fee structure (from LNMarkets docs)
  fees: {
    trading: {
      tier1: 0.001,    // 0.1% for <$250k volume
      tier2: 0.0008,   // 0.08% for $250k-$1M
      tier3: 0.0007,   // 0.07% for $1M-$5M
      tier4: 0.0006,   // 0.06% for $5M+
    },
    fundingInterval: 8 * 60 * 60,    // 8 hours in seconds
    typicalFundingRate: 0.0003,      // ~0.03% per interval (varies)
  },
  
  // Risk management
  stopLossPercent: 0.15,         // Stop loss at 15% down
  maxDailyLoss: 0.05,            // Max 5% loss in 24h before pausing
  
  // Nostr reporting
  nostr: {
    enabled: true,
    dailyUpdate: true,            // Post daily summary
    tradeAlerts: true,            // Post on each rebalance
    weeklyReport: true,           // Post weekly performance
  },
  
  // LNMarkets API
  lnmarkets: {
    network: 'mainnet',           // or 'testnet'
    apiVersion: 'v2',
    rateLimit: 1000,              // 1 request per second
  },
  
  // Persistence
  stateFile: './state.json',
  credentialsFile: './credentials.json',
  logFile: '../memory/lnmarkets-trading.md',
}
