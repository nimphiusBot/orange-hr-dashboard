#!/usr/bin/env node

// Simple Render.com start script
// Works from any directory

console.log('🚀 Starting Orange HR Dashboard for Render.com');
console.log('Current directory:', process.cwd());

// Try to find package.json
const fs = require('fs');
const path = require('path');

// Check current directory
if (fs.existsSync('package.json')) {
  console.log('✅ Found package.json in current directory');
  require('./deploy-server.js');
} else {
  // Try parent directory
  const parentDir = path.join(process.cwd(), '..');
  if (fs.existsSync(path.join(parentDir, 'package.json'))) {
    console.log('✅ Found package.json in parent directory');
    process.chdir(parentDir);
    require('./deploy-server.js');
  } else {
    console.log('❌ Could not find package.json');
    console.log('Looking in:', process.cwd());
    
    // List files for debugging
    try {
      const files = fs.readdirSync('.');
      console.log('Files in current directory:', files.slice(0, 10));
    } catch (e) {
      console.log('Cannot read directory:', e.message);
    }
    
    // Exit with error
    process.exit(1);
  }
}