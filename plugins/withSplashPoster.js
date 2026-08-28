const { withAndroidStyles, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function withSplashPoster(config) {
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const destDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app/src/main/res/drawable-nodpi'
      );
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(
        path.join(modConfig.modRequest.projectRoot, 'assets/images/splash.png'),
        path.join(destDir, 'splash_poster.png')
      );
      return modConfig;
    },
  ]);

  config = withAndroidStyles(config, (modConfig) => {
    const splash = modConfig.modResults.resources.style?.find(
      (style) => style.$?.name === 'Theme.App.SplashScreen'
    );
    if (splash) {
      splash.item = splash.item || [];
      splash.item = splash.item.filter(
        (item) => item.$?.name !== 'android:windowSplashScreenBehavior'
      );
      const hasIconBg = splash.item.some(
        (item) => item.$?.name === 'windowSplashScreenIconBackgroundColor'
      );
      if (!hasIconBg) {
        splash.item.push({
          $: { name: 'windowSplashScreenIconBackgroundColor' },
          _: '@color/splashscreen_background',
        });
      }
    }
    const appTheme = modConfig.modResults.resources.style?.find(
      (style) => style.$?.name === 'AppTheme'
    );
    if (appTheme) {
      appTheme.item = appTheme.item || [];
      appTheme.item = appTheme.item.filter((item) => item.$?.name !== 'android:windowBackground');
      appTheme.item.push({
        $: { name: 'android:windowBackground' },
        _: '@color/splashscreen_background',
      });
    }
    return modConfig;
  });

  return config;
}

module.exports = withSplashPoster;
