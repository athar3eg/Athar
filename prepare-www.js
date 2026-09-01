const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const targetDir = path.join(__dirname, 'www');

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

const copyList = [
  'css',
  'js',
  'assets',
  'fonts',
  'index.html',
  'dashboard.html',
  'schedule.html',
  'focus.html',
  'exams.html',
  'settings.html',
  'assistant.html',
  'onboarding.html',
  'landing.html',
  'privacy.html',
  'version.json',
  'icon.png',
  'logo.png',
  'logo-horizontal.png',
  'apple-touch-icon.png',
  'favicon.png',
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png'
];

copyList.forEach(item => {
  const src = path.join(srcDir, item);
  const dest = path.join(targetDir, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, { recursive: true });
  }
});

console.log('✓ www directory prepared for Capacitor build.');
