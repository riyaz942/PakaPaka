import { Redirect } from 'expo-router';
import React from 'react';

/** Rollout redirect: the Learn hub's discovery role moved to Browse (FR62). */
export default function LearnIndexRedirect() {
  return <Redirect href="/browse" />;
}
