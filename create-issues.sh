#!/bin/bash
# Script to create GitHub issues for lnmarkets-bot improvements

REPO="clawd-machine/lnmarkets-bot"

echo "Creating GitHub issues for $REPO..."
echo "Note: This requires a GitHub token with 'repo' scope permissions."
echo ""

# Issue 1: State Persistence Logging
echo "Creating Issue 1: Add State Persistence Logging..."
gh issue create \
  --repo "$REPO" \
  --title "Add State Persistence Logging" \
  --label "enhancement" \
  --body "## Objective
Log all state.json changes to the trading log to enable state recovery after crashes and track cumulative metrics.

## Background
Currently, state.json is updated silently. If the bot crashes or state becomes corrupted, there's no audit trail of what changed and when.

## Requirements

### 1. Log State Changes
- Log whenever state.json is written
- Include timestamp and what changed
- Track cumulative metrics over time

### 2. State Recovery
- Enable reconstruction of state from log file if state.json is lost
- Document state recovery procedure
- Add validation on state load

### 3. Cumulative Metrics
- Total fees paid (across all time)
- Total volume traded
- Win/loss ratio
- Longest winning/losing streaks
- Total funding fees received/paid

## Implementation Notes
- Consider adding a \`logStateChange()\` method that's called before \`saveState()\`
- Format state changes as structured data (JSON or markdown table)
- Keep state log separate from trade log, or use clear section markers

## Acceptance Criteria
- [ ] State changes are logged with timestamp
- [ ] State can be recovered from log file
- [ ] Cumulative metrics are tracked and reported in status/report commands
- [ ] Documentation added for state recovery process"

# Issue 2: Improve Error Handling
echo "Creating Issue 2: Improve Error Handling..."
gh issue create \
  --repo "$REPO" \
  --title "Improve Error Handling" \
  --label "enhancement" \
  --body "## Objective
Add robust error handling with retry logic, exponential backoff, and better error context logging.

## Background
Current error handling is basic. Network failures, API rate limits, and transient errors can cause the bot to fail unnecessarily.

## Requirements

### 1. Retry Logic with Exponential Backoff
- Implement retry mechanism for API calls
- Use exponential backoff (e.g., 1s, 2s, 4s, 8s)
- Max retry attempts configurable (default: 3)
- Only retry on retryable errors (5xx, network timeouts, rate limits)

### 2. Enhanced Error Logging
- Log full error context (stack trace, request parameters, response body)
- Include correlation IDs for debugging
- Categorize errors (network, API, validation, internal)
- Log to both console and file

### 3. API Parameter Validation
- Validate all parameters before API calls
- Check quantity minimums/maximums
- Verify price is reasonable (not 0 or negative)
- Validate leverage is within limits
- Provide helpful error messages

## Implementation Notes
- Consider using a dedicated retry library or implementing a simple wrapper
- Add \`validateOrder()\` method before placing orders
- Consider circuit breaker pattern for persistent failures
- Add healthcheck before expensive operations

## Acceptance Criteria
- [ ] Retry logic implemented for all API calls
- [ ] Error logs include full context and categorization
- [ ] Order parameters are validated before submission
- [ ] Transient errors don't crash the bot
- [ ] Tests added for error scenarios"

# Issue 3: Add Performance Tracking Metrics
echo "Creating Issue 3: Add Performance Tracking Metrics..."
gh issue create \
  --repo "$REPO" \
  --title "Add Performance Tracking Metrics" \
  --label "enhancement" \
  --body "## Objective
Calculate and track key performance metrics including daily P&L, cumulative returns vs buy-and-hold, and funding fee accumulation.

## Background
Currently, the bot tracks basic metrics but lacks detailed performance analytics that would help assess strategy effectiveness.

## Requirements

### 1. Daily P&L Tracking
- Calculate realized P&L for each day
- Track unrealized P&L changes
- Separate trading P&L from funding fees
- Log daily summary to performance file

### 2. Cumulative Return vs Buy-and-Hold
- Calculate total return of the strategy
- Compare to simple buy-and-hold benchmark
- Track Sharpe ratio (risk-adjusted return)
- Display in status/report commands

### 3. Funding Fee Monitoring
- Track funding fees received (short positions during positive rates)
- Track funding fees paid (long positions during positive rates)
- Calculate net funding P&L
- Monitor funding rate trends

### 4. Additional Metrics
- Win rate (profitable trades / total trades)
- Average trade size
- Average holding period
- Maximum drawdown
- Best/worst single trade

## Implementation Notes
- Add \`calculateDailyMetrics()\` method that runs at end of day
- Store metrics in state.json or separate performance.json
- Consider using a time-series format for historical metrics
- Add \`performance report\` command for detailed analytics

## Acceptance Criteria
- [ ] Daily P&L calculated and logged
- [ ] Cumulative return vs buy-and-hold comparison shown in status
- [ ] Funding fees tracked separately
- [ ] Win rate and other metrics displayed
- [ ] Historical performance data persisted"

# Issue 4: Add Config Change Logging
echo "Creating Issue 4: Add Config Change Logging..."
gh issue create \
  --repo "$REPO" \
  --title "Add Config Change Logging" \
  --label "enhancement" \
  --label "documentation" \
  --body "## Objective
Log when configuration parameters change and document actual threshold behavior to aid debugging and optimization.

## Background
Config changes (thresholds, leverage, allocations) significantly impact bot behavior. Currently, there's no audit trail of when changes were made or how they affected performance.

## Requirements

### 1. Config Change Tracking
- Log timestamp when config.js is modified
- Record old value → new value for each changed parameter
- Include who/what triggered the change (manual edit, automated adjustment)
- Store in config-history.md or similar

### 2. Threshold Behavior Documentation
- Document how market_rebalance_threshold actually works
- Document how limit_order_threshold actually works
- Explain interaction between thresholds
- Provide examples of triggering conditions

### 3. Config Validation
- Validate config on bot startup
- Check for invalid combinations (e.g., thresholds that can't trigger)
- Warn about risky settings (high leverage, tight thresholds)
- Provide reasonable default values

## Implementation Notes
- Add \`validateConfig()\` method called during initialization
- Consider checksum/hash of config.js to detect changes
- Log config snapshot on every bot run
- Document config schema and constraints in README

## Acceptance Criteria
- [ ] Config changes are logged with timestamp and diff
- [ ] Threshold behavior is documented with examples
- [ ] Config validation implemented
- [ ] Invalid configs are rejected with helpful error messages
- [ ] Config history is queryable"

# Issue 5: Add Unit Tests
echo "Creating Issue 5: Add Unit Tests..."
gh issue create \
  --repo "$REPO" \
  --title "Add Unit Tests" \
  --label "testing" \
  --body "## Objective
Add comprehensive unit tests to ensure critical calculations and logic work correctly across edge cases.

## Background
Current code has no automated tests. Manual testing is time-consuming and doesn't catch regressions. Critical logic like deviation calculations must be correct.

## Requirements

### 1. Core Calculation Tests
- Test deviation calculation with various inputs
- Test target value calculation over time
- Test position sizing calculations
- Test fee estimation accuracy

### 2. State Persistence Tests
- Test state save/load cycle
- Test state recovery after corruption
- Test migration of old state formats
- Test cumulative metric calculations

### 3. Edge Case Tests
- Zero balance
- Extreme prices (very high/low BTC)
- Negative P&L
- API errors and timeouts
- Missing or partial data

### 4. Integration Tests (Optional)
- Test full rebalance cycle (dry-run mode)
- Test limit order placement logic
- Test position closing logic

## Implementation Notes
- Use a test framework (Jest, Mocha, or Node's built-in test runner)
- Mock API calls to avoid hitting real LNMarkets API
- Use test fixtures for realistic data
- Aim for >80% code coverage on critical paths

## Test Files Needed
- \`lib/value-averaging.test.js\` - Core VA calculations
- \`lib/lnm-client.test.js\` - API wrapper (mocked)
- \`bot.test.js\` - Main bot logic (mocked API)
- \`test/fixtures/\` - Sample API responses

## Acceptance Criteria
- [ ] Deviation calculation tests pass
- [ ] Position tracking across restarts tested
- [ ] Edge cases covered (zero balance, extreme prices)
- [ ] Tests run via \`npm test\`
- [ ] CI/CD integration (optional)"

echo ""
echo "All issues created successfully!"
echo "View them at: https://github.com/$REPO/issues"
