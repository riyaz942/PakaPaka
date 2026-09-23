import React from 'react';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { cssInterop } from 'nativewind';
import Svg, { Path } from 'react-native-svg';

import { DRAWN_GLYPH_PATHS } from '@/constants/drawnGlyphs';

type DrawnGlyphProps = {
  d: string;
  fontSize?: number;
  color?: string;
  accessibilityLabel?: string;
  testID?: string;
  /** Left over once `cssInterop` lifts colour and size out; not used. */
  style?: StyleProp<TextStyle>;
};

function DrawnGlyph({ d, fontSize = 16, color, accessibilityLabel, testID }: DrawnGlyphProps) {
  return (
    <Svg
      width={fontSize}
      height={fontSize}
      viewBox="0 0 200 200"
      color={color}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID={testID}>
      <Path d={d} fill="currentColor" />
    </Svg>
  );
}

/**
 * The text classes and style set the glyph's colour and size, so a drawn glyph
 * takes the same tokens as the text it stands in for.
 */
const StyledDrawnGlyph = cssInterop(DrawnGlyph, {
  className: { target: 'style', nativeStyleToProp: { color: true, fontSize: true } },
});

/**
 * A `Text` for a hero radical/kanji form. The few forms no font can draw
 * (`DRAWN_GLYPH_PATHS`) render as an SVG outline instead of an empty box.
 */
export function GlyphText({ children, className, style, testID, ...rest }: TextProps) {
  const d = typeof children === 'string' ? DRAWN_GLYPH_PATHS[children] : undefined;
  if (d) {
    return (
      <StyledDrawnGlyph
        d={d}
        className={className}
        style={style}
        accessibilityLabel={children as string}
        testID={testID}
      />
    );
  }
  return (
    <Text className={className} style={style} testID={testID} {...rest}>
      {children}
    </Text>
  );
}
