#!/bin/bash
# LNMarkets Bot - Deployment Script

set -e

echo "🪝 LNMarkets Trading Bot - Deployment"
echo "======================================"
echo ""

# Check if credentials exist
if [ ! -f "credentials.json" ]; then
    echo "❌ credentials.json not found!"
    echo ""
    echo "Please create it with:"
    echo "  cp credentials.json.example credentials.json"
    echo "  nano credentials.json"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo "✓ Credentials file found"

# Check if dependencies installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✓ Dependencies already installed"
fi

# Test connection
echo ""
echo "🔌 Testing LNMarkets connection..."
node bot.js status 2>&1 | head -10

if [ $? -eq 0 ]; then
    echo "✓ Connection successful!"
else
    echo "⚠️ Connection test had issues (might be expected if not initialized)"
fi

# Initialize bot
echo ""
read -p "Initialize bot now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Initializing bot..."
    node bot.js init
    
    if [ $? -eq 0 ]; then
        echo "✓ Bot initialized successfully!"
    else
        echo "❌ Initialization failed"
        exit 1
    fi
else
    echo "⏭️ Skipping initialization"
fi

# Dry run
echo ""
read -p "Run dry-run test? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧪 Running dry-run rebalance..."
    node bot.js rebalance --dry-run
    
    echo ""
    echo "Review the output above. Does it look correct?"
    read -p "Proceed with live trading? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "💰 Running LIVE rebalance..."
        node bot.js rebalance
    else
        echo "⏸️ Stopped before live trading"
        echo "Run 'node bot.js rebalance' when ready"
        exit 0
    fi
fi

# Setup cron
echo ""
echo "📅 Cron Job Setup"
echo "-----------------"
node bot.js setup-cron

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Set up the cron job shown above"
echo "  2. Monitor with: node bot.js status"
echo "  3. Check Nostr for updates"
echo "  4. Review memory/lnmarkets-trading.md log"
echo ""
echo "Good luck! 🚀"
