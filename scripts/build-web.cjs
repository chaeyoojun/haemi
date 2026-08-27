const { execSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://if.io.kr/haemi-api',
};

process.chdir(root);
execSync('npx expo export --platform web --output-dir web-dist', {
  stdio: 'inherit',
  env,
});

console.log('\nWeb ready:');
console.log('  ' + path.join(root, 'web-dist'));
