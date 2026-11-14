const VARIANTS = {
  development: {
    name: 'PakaPaka (Dev)',
    identifier: 'com.pakapaka.app.dev',
    scheme: 'pakapaka-dev',
  },
  preview: {
    name: 'PakaPaka (Preview)',
    identifier: 'com.pakapaka.app.preview',
    scheme: 'pakapaka-preview',
  },
};

module.exports = ({ config }) => {
  const variant = VARIANTS[process.env.APP_VARIANT];
  if (!variant) {
    return config;
  }

  return {
    ...config,
    name: variant.name,
    scheme: variant.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: variant.identifier,
    },
    android: {
      ...config.android,
      package: variant.identifier,
    },
  };
};
