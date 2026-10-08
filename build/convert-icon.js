// Simple script to create ICO file from PNG
// Since electron-builder will handle icon conversion, we just need the PNG
// This script is here for reference if manual ICO creation is needed

const fs = require('fs');
const path = require('path');

console.log('Icon conversion handled by electron-builder automatically.');
console.log('Source: build/icon.png');
console.log('electron-builder will generate platform-specific icons during build.');

// Verify source icon exists
const iconPath = path.join(__dirname, 'icon.png');
if (fs.existsSync(iconPath)) {
    const stats = fs.statSync(iconPath);
    console.log(`✓ Source icon found: ${iconPath} (${stats.size} bytes)`);
} else {
    console.error('✗ Source icon not found!');
    process.exit(1);
}
