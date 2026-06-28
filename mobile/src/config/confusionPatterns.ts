import type { PatternDefinition } from '@/core/srs/srs.types';

/**
 * App-side confusion pattern definitions for cluster detection.
 *
 * The curriculum schema has NO item-level confusion tags — only grammar example
 * sentences carry `reinforcement_tags`. Patterns are therefore defined here,
 * keyed to known item slugs and/or grammar reinforcement_tags from the N5 seed.
 *
 * Pattern tags are resolved at aggregation time (detectConfusionClusters) by
 * checking whether an item's id or its reinforcement_tags match a pattern's
 * `itemSlugsOrTags` list. The matched pattern IDs are also stored in
 * `weakness_stats.pattern_tags` for fast per-item lookups.
 *
 * With the sparse N5 seed, expect zero clusters in normal testing — that is
 * correct behavior. Test cluster logic with synthetic stats in unit tests.
 */
export const CONFUSION_PATTERNS: PatternDefinition[] = [
  {
    id: 'te_ta_form',
    label: 'て-form vs た-form',
    itemSlugsOrTags: ['te-form', 'ta-form', 'te_form', 'ta_form'],
  },
  {
    id: 'wa_ga_particle',
    label: 'は vs が particle',
    itemSlugsOrTags: ['wa-particle', 'ga-particle', 'wa_particle', 'ga_particle'],
  },
  {
    id: 'ni_de_particle',
    label: 'に vs で particle',
    itemSlugsOrTags: ['ni-particle', 'de-particle', 'ni_particle', 'de_particle'],
  },
  {
    id: 'negative_forms',
    label: 'Negative verb forms',
    itemSlugsOrTags: ['nai-form', 'masen-form', 'nai_form', 'masen_form', 'negative-verb'],
  },
];
