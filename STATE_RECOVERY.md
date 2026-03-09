# State Recovery Procedure

The LNMarkets Trading Bot maintains its operational state in `state.json`. If this file is corrupted, accidentally deleted, or lost after a crash, the bot is equipped with an automated and manual recovery mechanism using the `state.log` file.

## Automated Recovery

1. **How it works:** Whenever `state.json` is successfully written, the entire state object is appended as a JSONL entry (one JSON object per line) into `state.log`.
2. **On startup:** If `state.json` is completely missing (e.g., deleted), the bot's `loadState()` method will automatically detect this (`ENOENT` error) and attempt to read the last valid entry from `state.log`.
3. **Restoration:** If a valid state is found in the log, the bot will parse it, restore it to memory, and immediately recreate `state.json` from this data.

## Manual Recovery

If `state.json` is corrupted (e.g., half-written) rather than missing, the bot may fail to start with a JSON parsing error. In this case, follow these steps:

1. **Stop the bot:** Ensure the cron job or daemon is stopped so it doesn't attempt concurrent writes.
2. **Remove the corrupted file:**
   ```bash
   rm state.json
   ```
3. **Run the bot to trigger automated recovery:**
   ```bash
   node bot.js status
   ```
   *You should see a message `⚠ Recovered state from state.log`.*
4. **(Alternative) Recreate manually:**
   If automatic recovery fails, you can manually extract the last line of `state.log` and save it as `state.json`.
   ```bash
   tail -n 1 state.log > state.json
   ```
   Then remove the `_loggedAt` key if you wish, though the bot will safely ignore it.

## Validation

Upon loading (whether from `state.json` or recovered from `state.log`), the bot validates that critical fields (`version`, `initialCapital`) are present. If the file is manually tampered with and missing these fields, it will refuse to start and alert you to the corruption.
