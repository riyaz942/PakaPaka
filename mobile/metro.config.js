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
const previousEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, server) => {
    const enhanced = previousEnhanceMiddleware ? previousEnhanceMiddleware(middleware, server) : middleware;
    return (req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      return enhanced(req, res, next);
    };
  },
};

module.exports = withNativeWind(config, { input: './src/global.css' });
