# API Key Troubleshooting

## Current Issue

Getting error: `{"message":"Api key does not exist"}`

## Things to Check

### 1. **Activate the API Key** (Most Likely)
After creating the API key, you usually need to:
1. Go back to https://app.lnmarkets.com/user/api
2. Find your new API key in the list
3. Click "Activate" or toggle it to enabled
4. Confirm activation (might require password/2FA)

### 2. **Check Key Status**
In the API section of your profile:
- Is the key shown as "Active" or "Enabled"?
- Does it show green status?
- Is there any warning message?

### 3. **Verify Permissions**
Make sure these are checked:
- ✅ Read account information
- ✅ Trade futures
- ❌ Withdraw (should be OFF)

### 4. **Copy Keys Correctly**
Double-check you copied:
- **API Key**: The long base64 string (not the name)
- **Secret**: The even longer base64 string
- **Passphrase**: The string you chose

## Next Steps

**If key needs activation:**
1. Log into LNMarkets
2. Go to Profile → API
3. Find `api-key-1771036264234`
4. Activate it
5. Tell me when done, I'll test again

**If key is already active:**
Let me know and I'll investigate further - might be a format issue or API version mismatch.

## Test Command

Once activated, I'll run:
```bash
cd ~/.openclaw/workspace/lnmarkets-bot
node bot.js status
```

Should show your account balance!
