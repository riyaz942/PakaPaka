import { Redirect } from 'expo-router';
import React from 'react';

/**
 * Home is at `/dashboard`. The phone apps open at `/`, so this route sends
 * them there. On the web, a page load of `/` gets the static landing page
 * (`public/landing`, via `public/_redirects`) and never reaches the app; this
 * route then serves only in-app links to `/`.
 */
export default function RootIndex() {
  return <Redirect href="/dashboard" />;
}
