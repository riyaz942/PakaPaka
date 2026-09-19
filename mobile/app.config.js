const VARIANTS = {
  development: {
    name: 'NihongoCore (Dev)',
    identifier: 'com.nihongocore.app.dev',
    scheme: 'nihongocore-dev',
  },
  preview: {
    name: 'NihongoCore (Preview)',
    identifier: 'com.nihongocore.app.preview',
    scheme: 'nihongocore-preview',
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
