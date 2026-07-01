/**
 * Backup Products Script
 * Creates a timestamped backup of all products in the products/ folder
 * Saves to Documents/Grogo_Products_Backup/
 */

const fs = require('fs');
const path = require('path');

class ProductsBackup {
  constructor() {
    this.sourceDir = 'data/products';
    this.backupDir = path.join(process.env.HOME, 'Documents', 'Grogo_Products_Backup');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  }

  // Create backup directory structure
  createBackupStructure() {
    try {
      // Create main backup directory
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
        console.log(`📁 Created backup directory: ${this.backupDir}`);
      }

      // Create timestamped subdirectory
      const timestampedDir = path.join(this.backupDir, `backup-${this.timestamp}`);
      if (!fs.existsSync(timestampedDir)) {
        fs.mkdirSync(timestampedDir, { recursive: true });
        console.log(`📁 Created timestamped directory: ${timestampedDir}`);
      }

      return timestampedDir;
    } catch (error) {
      console.error('❌ Error creating backup structure:', error.message);
      return null;
    }
  }

  // Copy directory recursively
  copyDirectory(src, dest) {
    try {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const items = fs.readdirSync(src);
      
      for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        
        if (fs.statSync(srcPath).isDirectory()) {
          this.copyDirectory(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error copying directory ${src}:`, error.message);
      return false;
    }
  }

  // Get directory size
  getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(itemPath);
        } else {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      console.error(`❌ Error calculating size for ${dirPath}:`, error.message);
    }
    
    return totalSize;
  }

  // Format file size
  formatFileSize(bytes) {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Count files in directory
  countFiles(dirPath) {
    let fileCount = 0;
    
    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          fileCount += this.countFiles(itemPath);
        } else {
          fileCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error counting files in ${dirPath}:`, error.message);
    }
    
    return fileCount;
  }

  // Generate backup summary
  generateBackupSummary(backupDir) {
    const summary = {
      timestamp: new Date().toISOString(),
      backupPath: backupDir,
      sourcePath: path.resolve(this.sourceDir),
      totalSize: this.getDirectorySize(backupDir),
      totalFiles: this.countFiles(backupDir),
      directories: []
    };

    // Get directory breakdown
    try {
      const items = fs.readdirSync(backupDir);
      
      for (const item of items) {
        const itemPath = path.join(backupDir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          summary.directories.push({
            name: item,
            size: this.getDirectorySize(itemPath),
            files: this.countFiles(itemPath)
          });
        }
      }
    } catch (error) {
      console.error('❌ Error generating summary:', error.message);
    }

    // Save summary
    const summaryFile = path.join(backupDir, 'backup-summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    
    return summary;
  }

  // Main backup process
  async run() {
    console.log('🚀 Starting Products Backup...');
    console.log('=' .repeat(60));
    console.log(`📂 Source: ${path.resolve(this.sourceDir)}`);
    console.log(`📁 Destination: ${this.backupDir}`);
    console.log(`📅 Timestamp: ${this.timestamp}`);

    try {
      // Check if source directory exists
      if (!fs.existsSync(this.sourceDir)) {
        console.log('❌ Source directory does not exist:', this.sourceDir);
        return;
      }

      // Create backup structure
      const timestampedDir = this.createBackupStructure();
      if (!timestampedDir) {
        console.log('❌ Failed to create backup structure');
        return;
      }

      // Copy all products
      console.log('\n📋 Copying products...');
      const success = this.copyDirectory(this.sourceDir, timestampedDir);
      
      if (!success) {
        console.log('❌ Failed to copy products');
        return;
      }

      // Generate summary
      console.log('\n📊 Generating backup summary...');
      const summary = this.generateBackupSummary(timestampedDir);

      // Display results
      console.log('\n✅ BACKUP COMPLETED SUCCESSFULLY!');
      console.log('=' .repeat(60));
      console.log(`📁 Backup Location: ${timestampedDir}`);
      console.log(`📊 Total Size: ${this.formatFileSize(summary.totalSize)}`);
      console.log(`📄 Total Files: ${summary.totalFiles}`);
      
      console.log('\n📂 DIRECTORY BREAKDOWN:');
      summary.directories.forEach(dir => {
        console.log(`   ${dir.name}: ${dir.files} files (${this.formatFileSize(dir.size)})`);
      });

      console.log('\n📋 BACKUP CONTENTS:');
      this.listBackupContents(timestampedDir);

      console.log('\n💾 Backup saved to your Documents folder!');

    } catch (error) {
      console.error('❌ Error during backup:', error.message);
    }
  }

  // List backup contents
  listBackupContents(backupDir) {
    try {
      const items = fs.readdirSync(backupDir);
      
      items.forEach(item => {
        const itemPath = path.join(backupDir, item);
        const stats = fs.statSync(itemPath);
        
        if (stats.isDirectory()) {
          const fileCount = this.countFiles(itemPath);
          const size = this.formatFileSize(this.getDirectorySize(itemPath));
          console.log(`   📁 ${item}/ (${fileCount} files, ${size})`);
          
          // List files in subdirectory
          const subItems = fs.readdirSync(itemPath);
          subItems.forEach(subItem => {
            if (subItem.endsWith('.json')) {
              console.log(`      📄 ${subItem}`);
            }
          });
        } else {
          const size = this.formatFileSize(stats.size);
          console.log(`   📄 ${item} (${size})`);
        }
      });
    } catch (error) {
      console.error('❌ Error listing backup contents:', error.message);
    }
  }
}

// Main execution
async function main() {
  const backup = new ProductsBackup();
  await backup.run();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = ProductsBackup;






