const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaultBlockList) ? defaultBlockList : [defaultBlockList]),
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
];

module.exports = withNativeWind(config, { input: './src/global.css' });
