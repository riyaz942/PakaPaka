// Google OAuth client IDs per variant (public values). A variant with empty IDs ships
// without the Google sign-in plugin and fails sign-in visibly. The iOS URL scheme is
// derived from iosClientId.
const GOOGLE_CLIENTS = {
  prod: { webClientId: '', iosClientId: '' },
  preview: { webClientId: '', iosClientId: '' },
  dev: { webClientId: '', iosClientId: '' },
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
  const { webClientId, iosClientId } = GOOGLE_CLIENTS[key];
  if (!webClientId || !iosClientId) {
    return config;
  }
  const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, '')}`;

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
