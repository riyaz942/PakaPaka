import React from 'react';
import { Text } from 'react-native';

type MockIconProps = {
  name: string;
  size?: number;
  color?: string;
  testID?: string;
};

/** Renders the icon name as text so tests can assert on it without font loading. */
export function MaterialIcons({ name, testID, size: _size, color: _color, ...rest }: MockIconProps) {
  return (
    <Text testID={testID ?? `mock-icon-${name}`} {...rest}>
      {name}
    </Text>
  );
}
