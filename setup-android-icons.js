const fs = require('fs');
const path = require('path');

const resDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
const iconSrc = path.join(__dirname, 'assets', 'icon.png');
const icon192Src = path.join(__dirname, 'assets', 'icon-192.png');

if (fs.existsSync(resDir) && fs.existsSync(iconSrc)) {
  const mipmaps = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi',
    'drawable',
    'drawable-land-mdpi',
    'drawable-land-hdpi',
    'drawable-land-xhdpi',
    'drawable-land-xxhdpi',
    'drawable-land-xxxhdpi',
    'drawable-port-mdpi',
    'drawable-port-hdpi',
    'drawable-port-xhdpi',
    'drawable-port-xxhdpi',
    'drawable-port-xxxhdpi'
  ];

  mipmaps.forEach(folder => {
    const dir = path.join(resDir, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (folder.startsWith('mipmap')) {
      fs.copyFileSync(iconSrc, path.join(dir, 'ic_launcher.png'));
      fs.copyFileSync(iconSrc, path.join(dir, 'ic_launcher_round.png'));
      fs.copyFileSync(iconSrc, path.join(dir, 'ic_launcher_foreground.png'));
    } else {
      fs.copyFileSync(iconSrc, path.join(dir, 'splash.png'));
    }
  });

  console.log('✓ Android launcher icons and splash assets updated successfully.');
} else {
  console.log('ℹ android/res directory not found yet (will be applied after cap add android).');
}
