import React from 'react';
import { cssInterop } from 'nativewind';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The Design System v2 line-icon set: one drawn family on a 24px grid, 1.75px
 * stroke, round caps and joins. v2 uses no emoji in UI, so every glyph the app
 * needs comes from here.
 *
 * Colour is token-driven: `className="text-brand-500"` sets the SVG's `color`,
 * and every stroke reads `currentColor`. That keeps icons out of the raw-hex
 * exception that SVG props would otherwise force.
 */
const StyledSvg = cssInterop(Svg, {
  className: { target: 'style', nativeStyleToProp: { color: true } },
});

export type IconName =
  | 'home'
  | 'search'
  | 'talk'
  | 'stats'
  | 'settings'
  | 'review'
  | 'lesson'
  | 'passage'
  | 'weakness'
  | 'streak'
  | 'days'
  | 'filter'
  | 'mic'
  | 'send'
  | 'history'
  | 'locked'
  | 'correct'
  | 'close'
  | 'back'
  | 'import'
  | 'info'
  | 'chevron'
  | 'device'
  | 'image';

/** Paths are lifted verbatim from the spec's Iconography grid. */
const ICON_PATHS: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <Path d="M3 10.5 12 3l9 7.5" />
      <Path d="M5 9.5V20h14V9.5" />
      <Path d="M9.5 20v-6h5v6" />
    </>
  ),
  search: (
    <>
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-4.2-4.2" />
    </>
  ),
  talk: (
    <>
      <Path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-5 4Z" />
      <Path d="M8 8.5h8M8 12h5" />
    </>
  ),
  stats: <Path d="M5 20V10M12 20V4M19 20v-7" />,
  settings: (
    <>
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-1.8-3.1-2 .8a7.6 7.6 0 0 0-2.6-1.5L14.4 3H9.6l-.3 2.1a7.6 7.6 0 0 0-2.6 1.5l-2-.8L2.9 8.9l1.7 1.3a7.6 7.6 0 0 0 0 3l-1.7 1.3 1.8 3.1 2-.8a7.6 7.6 0 0 0 2.6 1.5l.3 2.1h4.8l.3-2.1a7.6 7.6 0 0 0 2.6-1.5l2 .8 1.8-3.1Z" />
    </>
  ),
  review: <Path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  lesson: (
    <>
      <Path d="M12 6c-2-1.4-4.5-2-8-2v13c3.5 0 6 .6 8 2 2-1.4 4.5-2 8-2V4c-3.5 0-6 .6-8 2Z" />
      <Path d="M12 6v13" />
    </>
  ),
  passage: <Path d="M4 5h16M7 10h13M4 15h16M7 20h13" />,
  weakness: (
    <>
      <Circle cx={12} cy={12} r={8} />
      <Circle cx={12} cy={12} r={4} />
      <Circle cx={12} cy={12} r={1} fill="currentColor" />
    </>
  ),
  streak: (
    <Path d="M12 3c1 3-1.5 4-1.5 6.5A2.5 2.5 0 0 0 13 12c1.5-1 1-3 1-3 2 1.5 3 3.7 3 6a5 5 0 0 1-10 0c0-3 2.5-4.5 3-6.5.4-1.6 0-3.5 2-5.5Z" />
  ),
  days: (
    <>
      <Rect x={3.5} y={5} width={17} height={16} rx={2.5} />
      <Path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  filter: <Path d="M4 6h16M7 12h10M10 18h4" />,
  mic: (
    <>
      <Rect x={9} y={3} width={6} height={11} rx={3} />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  send: <Path d="M4 12 20 5l-7 15-2.5-6.5Z" />,
  history: (
    <>
      <Path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <Path d="M3 4v4h4" />
      <Path d="M12 8v4l3 2" />
    </>
  ),
  locked: (
    <>
      <Rect x={4.5} y={10.5} width={15} height={10} rx={2.5} />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  correct: <Path d="M20 6 9 17l-5-5" />,
  close: <Path d="M6 6 18 18M18 6 6 18" />,
  back: (
    <>
      <Path d="M11 5 4 12l7 7" />
      <Path d="M4 12h15" />
    </>
  ),
  import: (
    <>
      <Path d="M12 20V8" />
      <Path d="M6.5 13.5 12 8l5.5 5.5" />
      <Path d="M5 4h14" />
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 11v5.5" />
      <Path d="M12 7.6v.5" />
    </>
  ),
  chevron: <Path d="M9 6l6 6-6 6" />,
  device: (
    <>
      <Rect x={6} y={2.5} width={12} height={19} rx={2.5} />
      <Path d="M10.5 18.5h3" />
    </>
  ),
  image: (
    <>
      <Rect x={3} y={4.5} width={18} height={15} rx={2.5} />
      <Circle cx={8.5} cy={10} r={1.8} />
      <Path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4" />
    </>
  ),
};

type IconProps = {
  name: IconName;
  /** Rendered box, in px. The 24px grid is the design reference. */
  size?: number;
  /** Colour token class, e.g. `text-brand-500`. Defaults to body text. */
  className?: string;
  /**
   * Stroke in 24-grid units. The spec thickens to 2–2.4 for small emphatic
   * marks (close affordances, answer-state check/cross) rather than scaling.
   */
  strokeWidth?: number;
  testID?: string;
};

export function Icon({
  name,
  size = 24,
  className = 'text-secondary',
  strokeWidth = 1.75,
  testID,
}: IconProps) {
  return (
    <StyledSvg
      testID={testID}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Icons always sit beside a label or inside a labelled control.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {ICON_PATHS[name]}
    </StyledSvg>
  );
}
