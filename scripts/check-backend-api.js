#!/usr/bin/env node

/**
 * Check Backend API Status
 * Verify if the backend API server is running and accessible
 */

const http = require('http');
const https = require('https');

class BackendAPIChecker {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000'; // Default backend port
    this.status = {
      serverRunning: false,
      apiEndpoints: [],
      errors: [],
      startTime: new Date()
    };
  }

  async checkBackendAPI() {
    try {
      console.log('🔍 Checking Backend API Status...');
      console.log('=' .repeat(50));

      // Check if backend server is running
      await this.checkServerStatus();

      // Test API endpoints
      await this.testAPIEndpoints();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Error checking backend API:', error);
      this.status.errors.push(error.message);
      this.displayResults();
    }
  }

  async checkServerStatus() {
    return new Promise((resolve) => {
      console.log(`🔍 Checking if backend server is running on ${this.apiBaseUrl}...`);
      
      const url = new URL(this.apiBaseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 3000,
        path: '/api',
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        console.log(`✅ Backend server is running (Status: ${res.statusCode})`);
        this.status.serverRunning = true;
        resolve();
      });

      req.on('error', (error) => {
        console.log(`❌ Backend server is not running: ${error.message}`);
        this.status.errors.push(`Server not running: ${error.message}`);
        resolve();
      });

      req.on('timeout', () => {
        console.log('⏰ Backend server request timed out');
        this.status.errors.push('Server request timed out');
        req.destroy();
        resolve();
      });

      req.end();
    });
  }

  async testAPIEndpoints() {
    if (!this.status.serverRunning) {
      console.log('⚠️  Skipping API endpoint tests - server not running');
      return;
    }

    const endpoints = [
      { path: '/api', name: 'API Root' },
      { path: '/api/products/tesco_uxbridge', name: 'Tesco Products' },
      { path: '/api/products/sainsbury_uxbridge', name: 'Sainsbury Products' },
      { path: '/api/products/aldi_west_drayton', name: 'Aldi Products' },
      { path: '/api/products/lidl_uxbridge_cowley', name: 'Lidl Products' },
      { path: '/api/products/iceland_uxbridge', name: 'Iceland Products' }
    ];

    console.log('\n🧪 Testing API endpoints...');

    for (const endpoint of endpoints) {
      await this.testEndpoint(endpoint);
    }
  }

  async testEndpoint(endpoint) {
    return new Promise((resolve) => {
      const url = new URL(endpoint.path, this.apiBaseUrl);
      const options = {
        hostname: url.hostname,
        port: url.port || 3000,
        path: url.pathname,
        method: 'GET',
        timeout: 10000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const success = res.statusCode >= 200 && res.statusCode < 300;
          const status = success ? '✅' : '❌';
          
          console.log(`   ${status} ${endpoint.name}: ${res.statusCode} (${res.statusMessage})`);
          
          this.status.apiEndpoints.push({
            name: endpoint.name,
            path: endpoint.path,
            statusCode: res.statusCode,
            success: success,
            responseSize: data.length
          });

          if (!success) {
            this.status.errors.push(`${endpoint.name} returned ${res.statusCode}: ${res.statusMessage}`);
          }

          resolve();
        });
      });

      req.on('error', (error) => {
        console.log(`   ❌ ${endpoint.name}: ${error.message}`);
        this.status.apiEndpoints.push({
          name: endpoint.name,
          path: endpoint.path,
          statusCode: 0,
          success: false,
          error: error.message
        });
        this.status.errors.push(`${endpoint.name}: ${error.message}`);
        resolve();
      });

      req.on('timeout', () => {
        console.log(`   ⏰ ${endpoint.name}: Request timed out`);
        this.status.apiEndpoints.push({
          name: endpoint.name,
          path: endpoint.path,
          statusCode: 0,
          success: false,
          error: 'Request timed out'
        });
        this.status.errors.push(`${endpoint.name}: Request timed out`);
        req.destroy();
        resolve();
      });

      req.end();
    });
  }

  displayResults() {
    const duration = (new Date() - this.status.startTime) / 1000;
    
    console.log('\n🔍 BACKEND API STATUS REPORT');
    console.log('=' .repeat(50));
    console.log(`⏱️  Check Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🖥️  Server Status: ${this.status.serverRunning ? '✅ RUNNING' : '❌ NOT RUNNING'}`);
    console.log(`🌐 API Base URL: ${this.apiBaseUrl}`);

    if (this.status.apiEndpoints.length > 0) {
      console.log('\n📊 API ENDPOINTS:');
      console.log('─'.repeat(30));
      
      this.status.apiEndpoints.forEach(endpoint => {
        const status = endpoint.success ? '✅' : '❌';
        const size = endpoint.responseSize ? `(${endpoint.responseSize} bytes)` : '';
        console.log(`${status} ${endpoint.name}: ${endpoint.statusCode} ${size}`);
        
        if (endpoint.error) {
          console.log(`   Error: ${endpoint.error}`);
        }
      });
    }

    if (this.status.errors.length > 0) {
      console.log('\n❌ ERRORS FOUND:');
      console.log('─'.repeat(20));
      this.status.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('─'.repeat(20));
    
    if (!this.status.serverRunning) {
      console.log('1. Start the backend server:');
      console.log('   cd grogo-mvp/backend');
      console.log('   npm start');
      console.log('   or');
      console.log('   node src/server.js');
    } else if (this.status.errors.length > 0) {
      console.log('1. Check server logs for detailed error messages');
      console.log('2. Verify Firebase connection in backend');
      console.log('3. Check if all required dependencies are installed');
    } else {
      console.log('✅ Backend API is working correctly!');
      console.log('💡 Check your mobile app configuration:');
      console.log('   - Verify API_BASE_URL in mobile app config');
      console.log('   - Check if mobile app is using correct endpoints');
      console.log('   - Ensure mobile app has internet connectivity');
    }

    // Mobile app troubleshooting
    console.log('\n📱 MOBILE APP TROUBLESHOOTING:');
    console.log('─'.repeat(35));
    console.log('1. Check API_BASE_URL in mobile app config');
    console.log('2. Verify mobile app has internet permission');
    console.log('3. Check if you\'re using localhost vs actual IP address');
    console.log('4. For physical device, use your computer\'s IP instead of localhost');
    console.log('5. Check if firewall is blocking the connection');
  }
}

// Main execution
async function main() {
  const checker = new BackendAPIChecker();
  await checker.checkBackendAPI();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BackendAPIChecker;

