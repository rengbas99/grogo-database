#!/bin/bash

echo "🚀 Grogo Database - Quick Start Script"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Setup environment
echo "⚙️ Setting up environment..."
node src/setup.js

if [ $? -ne 0 ]; then
    echo "❌ Setup failed"
    exit 1
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your Apify token"
echo "2. Get your token from: https://apify.com/account/integrations"
echo "3. Run: node src/index.js setup (to validate configuration)"
echo "4. Run: node src/index.js test (to test the scraper)"
echo "5. Run: node src/index.js scrape-all (to start scraping)"
echo ""
echo "For more information, see README.md"
