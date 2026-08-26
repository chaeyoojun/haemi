const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const androidStudioJbr = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const localSdk = path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const shortGradleHome = path.join(process.env.USERPROFILE || 'C:\\', '.gradle');

process.env.CI = '1';

if (!process.env.JAVA_HOME && fs.existsSync(androidStudioJbr)) {
  process.env.JAVA_HOME = androidStudioJbr;
}

if (!process.env.ANDROID_HOME && fs.existsSync(localSdk)) {
  process.env.ANDROID_HOME = localSdk;
}

if (!process.env.ANDROID_SDK_ROOT && process.env.ANDROID_HOME) {
  process.env.ANDROID_SDK_ROOT = process.env.ANDROID_HOME;
}

// Cursor/sandbox Gradle homes can exceed Windows' 260-char path limit during CMake.
process.env.GRADLE_USER_HOME = shortGradleHome;

const env = { ...process.env };
process.chdir(root);

execSync('npx expo prebuild --platform android', {
  stdio: 'inherit',
  env,
});

const gradleProperties = path.join(androidDir, 'gradle.properties');
const extras = [
  'android.overridePathCheck=true',
  'reactNativeArchitectures=arm64-v8a,x86_64',
  'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m -Dfile.encoding=UTF-8',
];
let properties = fs.readFileSync(gradleProperties, 'utf8');
for (const extra of extras) {
  const key = extra.split('=')[0];
  if (properties.includes(`${key}=`)) {
    properties = properties.replace(new RegExp(`^${key}=.*$`, 'm'), extra);
  } else {
    properties += `\n${extra}\n`;
  }
}
fs.writeFileSync(gradleProperties, properties);

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';

try {
  execSync(`${gradlew} --stop`, {
    cwd: androidDir,
    stdio: 'inherit',
    shell: true,
    env,
  });
} catch {
  // No daemon running yet.
}

execSync(`${gradlew} assembleRelease`, {
  cwd: androidDir,
  stdio: 'inherit',
  shell: true,
  env,
});

const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const distDir = path.join(root, 'dist');
const copied = path.join(distDir, 'haemi.apk');

if (!fs.existsSync(apk)) {
  throw new Error(`APK not found: ${apk}`);
}

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(apk, copied);

console.log('\nAPK ready:');
console.log(`  ${copied}`);
