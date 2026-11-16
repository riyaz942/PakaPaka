// Google OAuth client IDs per variant (public values). A variant with empty IDs ships
// without the Google sign-in plugin and fails sign-in visibly. The iOS URL scheme is
// derived from iosClientId.
const GOOGLE_WEB_CLIENT_ID =
  '68070992356-b6bralepm3637rkf8sas9dfj10bu85jp.apps.googleusercontent.com';

const GOOGLE_CLIENTS = {
  prod: {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: '68070992356-2c4mub75suml0vnl5hu068agqsff1pf3.apps.googleusercontent.com',
  },
  preview: {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: '68070992356-qjruuekdmqqne6t2168ur0r9limc5npe.apps.googleusercontent.com',
  },
  dev: {
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: '68070992356-i9d5heeej7a6v1e2th86g0l2omffmbu5.apps.googleusercontent.com',
  },
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
