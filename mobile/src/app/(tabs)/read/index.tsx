import { Redirect } from 'expo-router';
import React from 'react';

/** Rollout redirect: passages are rows in the unified Browse list now (FR63). */
export default function ReadIndexRedirect() {
  return <Redirect href="/browse" />;
}
