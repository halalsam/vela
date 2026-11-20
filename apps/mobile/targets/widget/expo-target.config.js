/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'VelaWidgets',
  displayName: 'vela',
  icon: './assets/icon.png',
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  colors: {
    $widgetBackground: '#0A0A0A',
    $accent: '#C8B285',
    velaCanvas: '#0A0A0A',
    velaSurface: '#1A1A1A',
    velaTrack: '#222222',
    velaChampagne: '#C8B285',
    velaWarning: '#F5A524',
    velaDanger: '#FF5A5F',
    velaSuccess: '#3DDC97',
  },
  images: {
    VelaSymbol: './assets/vela-symbol.png',
    VelaSymbolSmall: './assets/vela-symbol-small.png',
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
