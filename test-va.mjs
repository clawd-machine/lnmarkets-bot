import { ValueAverager } from './lib/value-averaging.js';

// ============================================================
// Test: Value Averaging with Example Values
// ============================================================
// Setup:
//   - BTC Price: $100,000
//   - Total Equity: 200,000 sats (0.002 BTC = $200)
//   - Short Position: -$100 USD (Dry Powder)
//   - Investment Value (IV): $200 - $100 = $100
//   - Target IV: $100 (Day 0, growth negligible)
//   - Threshold: 4%
//
// Expected Results:
//   - Buy Trigger Price:  $96,000  (IV drops to $96)
//   - Buy Quantity:        +$4     (close $4 of short to restore IV)
//   - Sell Trigger Price: $104,000  (IV rises to $104)
//   - Sell Quantity:       -$4     (open $4 of short to reduce IV)
// ============================================================

const currentState = {
  totalEquitySats: 200000,  // 0.002 BTC
  netPositionUsd: -100,     // $100 short (Dry Powder)
  currentPrice: 100000,     // $100k BTC
};

const config = {
  initial_btc_value_usd: 100,
  target_growth_rate_daily: 0,  // Zero growth for clean test
  limit_order_threshold: 0.04,
};

const va = new ValueAverager(config);
va.initialize(new Date());  // Start date = now

const currentIV = va.getCurrentBtcValueUSD(
  currentState.totalEquitySats,
  currentState.currentPrice,
  currentState.netPositionUsd
);

const targetIV = va.getTargetBtcValueUSD(new Date());

const orders = va.getLimitOrderConfigs(currentState);

console.log('=== INPUT STATE ===');
console.log(`  BTC Price:           $${currentState.currentPrice.toLocaleString()}`);
console.log(`  Total Equity:        ${currentState.totalEquitySats.toLocaleString()} sats (${(currentState.totalEquitySats / 1e8).toFixed(4)} BTC)`);
console.log(`  Total Equity (USD):  $${((currentState.totalEquitySats / 1e8) * currentState.currentPrice).toFixed(2)}`);
console.log(`  Net Position (USD):  $${currentState.netPositionUsd}`);
console.log(`  Dry Powder:          $${Math.abs(currentState.netPositionUsd)}`);
console.log('');

console.log('=== CALCULATED VALUES ===');
console.log(`  Current IV:          $${currentIV.toFixed(2)}`);
console.log(`  Target IV:           $${targetIV.toFixed(2)}`);
console.log(`  Deviation:           ${(((currentIV - targetIV) / targetIV) * 100).toFixed(2)}%`);
console.log('');

console.log('=== LIMIT ORDERS ===');
console.log(`  Buy Order:`);
console.log(`    Trigger Price:     $${orders.buyOrder.price.toLocaleString()}`);
console.log(`    Quantity (USD):    ${orders.buyOrder.quantity > 0 ? '+' : ''}${orders.buyOrder.quantity}`);
console.log(`  Sell Order:`);
console.log(`    Trigger Price:     $${orders.sellOrder.price.toLocaleString()}`);
console.log(`    Quantity (USD):    ${orders.sellOrder.quantity > 0 ? '+' : ''}${orders.sellOrder.quantity}`);
console.log('');

// Verification
const buyPriceOk = orders.buyOrder.price === 96000;
const sellPriceOk = orders.sellOrder.price === 104000;
const buyQtyOk = orders.buyOrder.quantity === 4;
const sellQtyOk = orders.sellOrder.quantity === -4;

console.log('=== VERIFICATION ===');
console.log(`  Buy Price  = $96,000?   ${buyPriceOk ? '✅ PASS' : '❌ FAIL (got $' + orders.buyOrder.price + ')'}`);
console.log(`  Sell Price = $104,000?   ${sellPriceOk ? '✅ PASS' : '❌ FAIL (got $' + orders.sellOrder.price + ')'}`);
console.log(`  Buy Qty    = +$4?       ${buyQtyOk ? '✅ PASS' : '❌ FAIL (got ' + orders.buyOrder.quantity + ')'}`);
console.log(`  Sell Qty   = -$4?       ${sellQtyOk ? '✅ PASS' : '❌ FAIL (got ' + orders.sellOrder.quantity + ')'}`);

const allPass = buyPriceOk && sellPriceOk && buyQtyOk && sellQtyOk;
console.log(`\n  Overall: ${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
