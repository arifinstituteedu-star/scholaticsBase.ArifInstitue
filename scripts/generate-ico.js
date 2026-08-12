import fs from 'fs';
import path from 'path';
import pngToIco from 'png-to-ico';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateIco() {
  try {
    const pngPath = path.resolve(__dirname, '../public/appicon.png');
    const icoPath = path.resolve(__dirname, '../public/appicon.ico');

    if (!fs.existsSync(pngPath)) {
      console.error(`[Icon Generator] Source PNG not found at: ${pngPath}`);
      process.exit(1);
    }

    console.log(`[Icon Generator] Converting ${pngPath} to ICO...`);
    const buf = await pngToIco(pngPath);
    fs.writeFileSync(icoPath, buf);
    console.log(`[Icon Generator] Successfully generated ICO at: ${icoPath}`);
  } catch (err) {
    console.error('[Icon Generator] Failed to generate ICO icon:', err);
    process.exit(1);
  }
}

generateIco();
