const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const ANDROID_RES = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Linear brand colors
const COLORS = {
  primary: '#5e6ad2',      // Linear lavender-blue
  primaryLight: '#818cf8', // lighter variant
  background: '#010102',   // Linear dark canvas
  surface: '#0f1011',      // Linear surface
  white: '#ffffff',
  gray: '#94a3b8',
};

// Create the main icon SVG
function createIconSVG(size, isForeground = false) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;

  if (isForeground) {
    // Foreground icon - server/monitor with pulse
    return `
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <!-- Server rack icon -->
  <rect x="${s*0.15}" y="${s*0.2}" width="${s*0.7}" height="${s*0.55}" rx="${s*0.05}" fill="${COLORS.primary}" opacity="0.9"/>
  <rect x="${s*0.2}" y="${s*0.28}" width="${s*0.6}" height="${s*0.1}" rx="${s*0.02}" fill="${COLORS.background}"/>
  <circle cx="${s*0.32}" cy="${s*0.33}" r="${s*0.025}" fill="#22c55e"/>
  <circle cx="${s*0.42}" cy="${s*0.33}" r="${s*0.025}" fill="#22c55e"/>

  <rect x="${s*0.2}" y="${s*0.43}" width="${s*0.6}" height="${s*0.1}" rx="${s*0.02}" fill="${COLORS.background}"/>
  <circle cx="${s*0.32}" cy="${s*0.48}" r="${s*0.025}" fill="#f59e0b"/>
  <circle cx="${s*0.42}" cy="${s*0.48}" r="${s*0.025}" fill="#22c55e"/>

  <rect x="${s*0.2}" y="${s*0.58}" width="${s*0.6}" height="${s*0.1}" rx="${s*0.02}" fill="${COLORS.background}"/>
  <circle cx="${s*0.32}" cy="${s*0.63}" r="${s*0.025}" fill="#22c55e"/>
  <circle cx="${s*0.42}" cy="${s*0.63}" r="${s*0.025}" fill="#ef4444"/>

  <!-- Activity pulse line -->
  <polyline points="${s*0.1},${s*0.82} ${s*0.25},${s*0.82} ${s*0.35},${s*0.65} ${s*0.45},${s*0.9} ${s*0.55},${s*0.72} ${s*0.65},${s*0.85} ${s*0.75},${s*0.75} ${s*0.85},${s*0.78} ${s*0.9},${s*0.82}"
    fill="none" stroke="${COLORS.primaryLight}" stroke-width="${s*0.04}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
  } else {
    // Background - dark with subtle grid
    return `
<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${s}" height="${s}" fill="${COLORS.background}"/>
  <!-- Subtle grid pattern -->
  <line x1="${s*0.2}" y1="0" x2="${s*0.2}" y2="${s}" stroke="${COLORS.surface}" stroke-width="1"/>
  <line x1="${s*0.4}" y1="0" x2="${s*0.4}" y2="${s}" stroke="${COLORS.surface}" stroke-width="1"/>
  <line x1="${s*0.6}" y1="0" x2="${s*0.6}" y2="${s}" stroke="${COLORS.surface}" stroke-width="1"/>
  <line x1="${s*0.8}" y1="0" x2="${s*0.8}" y2="${s}" stroke="${COLORS.surface}" stroke-width="1"/>
  <line x1="0" y1="${s*0.2}" x2="${s}" y2="${s*0.2}" stroke="${COLORS.surface}" stroke-width="1"/>
  <line x1="0" y1="${s*0.4}" x2="${s}" y2="${s*0.4}" stroke="${COLORS.surface}" stroke-width="1"/>
  <line x1="0" y1="${s*0.6}" x2="${s}" y2="${s*0.6}" stroke="${COLORS.surface}" stroke-width="1"/>
  <line x1="0" y1="${s*0.8}" x2="${s}" y2="${s*0.8}" stroke="${COLORS.surface}" stroke-width="1"/>
</svg>`;
  }
}

// Create Windows ICO with multiple sizes
async function createWindowsIcon() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = [];

  for (const size of sizes) {
    const svg = createIconSVG(size, true);
    const pngBuffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    images.push({ size, buffer: pngBuffer });
  }

  // Create ICO file
  // ICO header: 6 bytes
  // Directory entries: 16 bytes each
  // Image data

  const numImages = images.length;
  let offset = 6 + (numImages * 16); // Start of image data

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images

  const directory = Buffer.alloc(numImages * 16);
  const imageDataBuffers = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const entryOffset = i * 16;

    directory.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset); // Width
    directory.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset + 1); // Height
    directory.writeUInt8(0, entryOffset + 2); // Color palette
    directory.writeUInt8(0, entryOffset + 3); // Reserved
    directory.writeUInt16LE(1, entryOffset + 4); // Color planes
    directory.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    directory.writeUInt32LE(img.buffer.length, entryOffset + 8); // Image size
    directory.writeUInt32LE(offset, entryOffset + 12); // Image offset

    offset += img.buffer.length;
    imageDataBuffers.push(img.buffer);
  }

  const icoBuffer = Buffer.concat([header, directory, ...imageDataBuffers]);
  fs.writeFileSync(path.join(BUILD_DIR, 'app.ico'), icoBuffer);
  console.log('Created app.ico');
}

// Create Android adaptive icon foreground
async function createAndroidForeground() {
  // 108x108 for adaptive icon (centered in safe zone)
  const svg = createIconSVG(108, true);
  const pngBuffer = await sharp(Buffer.from(svg)).resize(108, 108).png().toBuffer();

  // Save to mipmap-anydpi-v26 as ic_launcher_foreground.png
  const foregroundPath = path.join(ANDROID_RES, 'mipmap-hdpi', 'ic_launcher_foreground.png');
  fs.writeFileSync(foregroundPath, pngBuffer);
  console.log('Created ic_launcher_foreground.png');

  // Also copy to other densities
  const densities = ['mdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  for (const density of densities) {
    const densityPath = path.join(ANDROID_RES, `mipmap-${density}`, 'ic_launcher_foreground.png');
    const sizedBuffer = await sharp(Buffer.from(svg)).resize(getDensitySize(density), getDensitySize(density)).png().toBuffer();
    fs.writeFileSync(densityPath, sizedBuffer);
  }

  // Create ic_launcher.png (square icon for older Android)
  const iconPath = path.join(ANDROID_RES, 'mipmap-hdpi', 'ic_launcher.png');
  const iconSvg = createIconSVG(48, true);
  const iconBuffer = await sharp(Buffer.from(iconSvg)).resize(48, 48).png().toBuffer();
  fs.writeFileSync(iconPath, iconBuffer);
  console.log('Created ic_launcher.png');

  // Create ic_launcher_round.png
  const roundPath = path.join(ANDROID_RES, 'mipmap-hdpi', 'ic_launcher_round.png');
  fs.writeFileSync(roundPath, iconBuffer);
  console.log('Created ic_launcher_round.png');

  // Copy to other densities
  for (const density of densities) {
    const size = getDensitySize(density);
    const sizedBuffer = await sharp(Buffer.from(iconSvg)).resize(size, size).png().toBuffer();
    fs.writeFileSync(path.join(ANDROID_RES, `mipmap-${density}`, 'ic_launcher.png'), sizedBuffer);
    fs.writeFileSync(path.join(ANDROID_RES, `mipmap-${density}`, 'ic_launcher_round.png'), sizedBuffer);
  }
}

function getDensitySize(density) {
  const sizes = { mdpi: 48, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  return sizes[density] || 48;
}

// Create Android adaptive icon background (vector drawable)
function createAndroidBackground() {
  const svg = createIconSVG(108, false);
  const bgPath = path.join(ANDROID_RES, 'drawable', 'ic_launcher_background.xml');
  fs.writeFileSync(bgPath, svg);
  console.log('Created ic_launcher_background.xml');
}

// Create a simple favicon for web
async function createFavicon() {
  const svg = createIconSVG(32, true);
  const pngBuffer = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
  const faviconPath = path.join(BUILD_DIR, 'favicon.png');
  fs.writeFileSync(faviconPath, pngBuffer);
  console.log('Created favicon.png');
}

async function main() {
  console.log('Generating icons...');

  // Ensure directories exist
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  await createWindowsIcon();
  await createAndroidForeground();
  createAndroidBackground();
  await createFavicon();

  console.log('Icon generation complete!');
}

main().catch(console.error);
