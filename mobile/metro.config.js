const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaultBlockList) ? defaultBlockList : [defaultBlockList]),
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
];

// expo-sqlite's web worker loads a wasm binary.
config.resolver.assetExts.push('wasm');

// Native-only voice libraries throw at import on web. Swap them for an empty
// module at bundle time. The stub lives inside the project root so Metro can hash it.
const NATIVE_ONLY_ON_WEB =
  /^(react-native-executorch|react-native-executorch-expo-resource-fetcher|react-native-audio-api)(\/|$)/;
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && NATIVE_ONLY_ON_WEB.test(moduleName)) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'web-stubs/native-module-stub.js'),
    };
  }
  return (previousResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

// Cross-origin isolation (needed for SharedArrayBuffer) on the dev server too.
// `enhanceMiddleware` is not enough: Expo serves the HTML page from its own
// middleware before Metro's runs, and the page is what needs the headers. So set
// them on every response this dev-server process writes. `expo export` loads this
// file too but serves nothing; the deployed build gets them from `public/_headers`.
const http = require('http');
const originalWriteHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function writeHeadWithIsolation(...args) {
  this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  this.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  return originalWriteHead.apply(this, args);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
