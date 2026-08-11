/**
 * Script to create a proper multi-size ICO file from the PNG icon
 * Uses canvas/sharp or jimp if available, else uses a manual ICO builder
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Check if jimp is available
async function createIco() {
  try {
    // Try using the built-in PNG -> ICO conversion
    const pngPath = path.join(projectRoot, 'public', 'appicon.png');
    const icoPath = path.join(projectRoot, 'public', 'appicon.ico');
    
    if (!fs.existsSync(pngPath)) {
      console.error('❌ appicon.png not found!');
      process.exit(1);
    }
    
    console.log('📦 PNG file found:', pngPath);
    console.log('📏 PNG size:', fs.statSync(pngPath).size, 'bytes');
    
    // We'll use png-to-ico if available, else just use the PNG directly
    // electron-builder can actually use PNG directly for icon on Windows
    // but it needs to be at least 256x256
    
    try {
      const { default: pngToIco } = await import('png-to-ico');
      const icoBuffer = await pngToIco(pngPath);
      fs.writeFileSync(icoPath, icoBuffer);
      console.log('✅ ICO created from PNG:', icoPath, '(' + icoBuffer.length + ' bytes)');
    } catch (e) {
      console.log('⚠️  png-to-ico not available, checking alternatives...');
      console.log('   The existing appicon.ico will be used.');
      console.log('   If build fails, install: npm install --save-dev png-to-ico');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createIco();
