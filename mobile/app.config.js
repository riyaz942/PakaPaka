// Google OAuth client IDs per variant (public values). A variant with empty IDs ships
// without the Google sign-in plugin and fails sign-in visibly. iosUrlScheme is the
// reversed iOS client ID.
const GOOGLE_CLIENTS = {
  prod: { webClientId: '', iosClientId: '', iosUrlScheme: '' },
  preview: { webClientId: '', iosClientId: '', iosUrlScheme: '' },
  dev: { webClientId: '', iosClientId: '', iosUrlScheme: '' },
};

const VARIANTS = {
  development: {
    name: 'PakaPaka (Dev)',
    identifier: 'com.pakapaka.app.dev',
    scheme: 'pakapaka-dev',
    google: 'dev',
  },
  preview: {
    name: 'PakaPaka (Preview)',
    identifier: 'com.pakapaka.app.preview',
    scheme: 'pakapaka-preview',
    google: 'preview',
  },
};

function withGoogle(config, key) {
  const { webClientId, iosClientId, iosUrlScheme } = GOOGLE_CLIENTS[key];
  if (!webClientId || !iosClientId || !iosUrlScheme) {
    return config;
  }

  return {
    ...config,
    extra: { ...config.extra, google: { webClientId, iosClientId } },
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-nitro-google-signin', { iosUrlScheme }],
    ],
  };
}

module.exports = ({ config }) => {
  const variant = VARIANTS[process.env.APP_VARIANT];
  if (!variant) {
    return withGoogle(config, 'prod');
  }

  return withGoogle(
    {
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
    },
    variant.google,
  );
};
