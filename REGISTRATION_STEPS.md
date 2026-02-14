# LNMarkets Registration - Quick Steps for Brendan

## Step 1: Create Account (5 minutes)

1. **Open browser**: https://app.lnmarkets.com
2. **Click "Sign Up"** (or similar button)
3. **Choose login method**:
   - Email/Password (simplest)
   - OR Lightning/Nostr login (if available)
4. **Complete registration**
5. **Verify email** (if required)

## Step 2: Generate API Credentials (3 minutes)

1. **Log in** to LNMarkets
2. **Go to Profile** → **API** section
   - Or direct link: https://app.lnmarkets.com/user/api
3. **Click "Create New API Key"**
4. **Set permissions**:
   - ✅ **Read account information** (required)
   - ✅ **Trade futures** (required)
   - ❌ **Withdraw** (NOT needed - security!)
5. **Set a passphrase** (you choose this - save it!)
6. **Generate key**
7. **SAVE THESE IMMEDIATELY**:
   - API Key (looks like: `lnm_xxxxxxxx`)
   - API Secret (long string)
   - Passphrase (what you just set)

⚠️ **CRITICAL**: The secret is shown ONCE. Copy it immediately!

## Step 3: Add Credentials to Bot

I'll handle this once you send me the credentials. Or you can:

```bash
cd ~/.openclaw/workspace/lnmarkets-bot
nano credentials.json
```

Fill in:
```json
{
  "key": "YOUR_API_KEY_HERE",
  "secret": "YOUR_API_SECRET_HERE",
  "passphrase": "YOUR_PASSPHRASE_HERE"
}
```

## Step 4: Fund Account

1. **In LNMarkets UI**, go to **Wallet** or **Deposit**
2. **Choose Lightning Network** (instant, low fees)
3. **Generate invoice** for **200,000+ sats**
4. **Pay from your LNBits wallet**:
   ```bash
   # I can help with this command
   cd ~/.openclaw/workspace/skills/lnbits
   ./scripts/pay_invoice.sh <INVOICE>
   ```
5. **Wait for confirmation** (~instant with Lightning)

## Step 5: Verify Balance

Once funded, run:
```bash
cd ~/.openclaw/workspace/lnmarkets-bot
node bot.js status
```

Should show your balance!

## What I Need From You

**After registration, send me**:
1. ✅ API Key
2. ✅ API Secret  
3. ✅ Passphrase

**DO NOT** post these in public channels! Send via:
- Direct message
- Encrypted channel
- Or paste them directly when I prompt you

Then I'll:
1. Add credentials to bot
2. Test connection
3. Initialize bot
4. Run first dry-run
5. Deploy automation

## Notes

- **No KYC required** (for now)
- **Lightning deposits/withdrawals** = instant
- **Testnet available** if you want to test first: https://testnet4.lnmarkets.com
- **US IP blocked** (use VPN if needed - or you're in Australia so no issue!)

---

Ready when you are! 🪝
