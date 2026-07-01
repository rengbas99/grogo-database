#!/usr/bin/env node

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

async function setup() {
  console.log('🚀 Setting up Grogo Database...\n');

  try {
    // Check if .env file exists
    const envPath = path.join(projectRoot, '.env');
    const envExamplePath = path.join(projectRoot, 'env.example');
    
    if (!fs.existsSync(envPath)) {
      if (fs.existsSync(envExamplePath)) {
        await fs.copy(envExamplePath, envPath);
        console.log('✅ Created .env file from env.example');
        console.log('⚠️  Please edit .env and add your Apify token');
      } else {
        console.log('❌ env.example file not found');
        return false;
      }
    } else {
      console.log('✅ .env file already exists');
    }

    // Create necessary directories
    const directories = [
      './data',
      './logs',
      './src/scrapers',
      './src/utils',
      './src/config',
      './src/database'
    ];

    for (const dir of directories) {
      await fs.ensureDir(path.join(projectRoot, dir));
      console.log(`✅ Created directory: ${dir}`);
    }

    // Check if package.json exists
    const packageJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log('❌ package.json not found. Please run npm init first.');
      return false;
    }

    // Check if node_modules exists
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('⚠️  node_modules not found. Please run npm install first.');
      console.log('   Run: npm install');
      return false;
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Edit .env file and add your Apify token');
    console.log('2. Run: node src/index.js setup (to validate configuration)');
    console.log('3. Run: node src/index.js scrape-all (to start scraping)');
    
    return true;

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup();
}

export { setup };

