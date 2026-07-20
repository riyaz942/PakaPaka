import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import React from 'react';

import { isJlptLevel } from '@/data/curriculum/curriculum.types';

/**
 * Rollout redirect: JLPT level is a Browse *filter*, never a navigational
 * container (UX-DR13). The old `/learn/[level]` route forwards into Browse with
 * that level preselected.
 */
export default function LearnLevelRedirect() {
  const params = useLocalSearchParams<{ level: string; type?: string }>();
  const level = params.level && isJlptLevel(params.level) ? params.level : null;

  if (!level) {
    return <Redirect href="/browse" />;
  }

  const typeParam = params.type ? `&type=${params.type}` : '';
  return <Redirect href={`/browse?level=${level}${typeParam}` as Href} />;
}
