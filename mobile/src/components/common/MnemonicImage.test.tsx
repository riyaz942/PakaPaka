import { fireEvent, render, screen } from '@testing-library/react-native';

import { MnemonicImage } from '@/components/common/MnemonicImage';

describe('MnemonicImage', () => {
  it('shows text fallback when image URL is invalid', () => {
    render(
      <MnemonicImage
        imageUrl="not-a-url"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
        testID="mnemonic-fallback"
      />,
    );

    expect(screen.getByLabelText('Radical one (一)')).toBeTruthy();
    expect(screen.queryByTestId('mock-expo-image')).toBeNull();
  });

  it('shows text fallback when image URL is missing', () => {
    render(
      <MnemonicImage
        imageUrl={null}
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
        testID="mnemonic-fallback"
      />,
    );

    expect(screen.getByLabelText('Radical one (一)')).toBeTruthy();
    expect(screen.getByText('Radical one (一)')).toBeTruthy();
  });

  it('retries image load when imageUrl changes after an error', () => {
    const { rerender } = render(
      <MnemonicImage
        imageUrl="https://assets.japanese-learning.app/radicals/n5/bad.png"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    fireEvent.press(screen.getByTestId('mock-expo-image-trigger-error'));
    expect(screen.getByText('Radical one (一)')).toBeTruthy();

    rerender(
      <MnemonicImage
        imageUrl="https://assets.japanese-learning.app/radicals/n5/ichi.png"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    expect(screen.getByTestId('mock-expo-image')).toBeTruthy();
  });

  it('shows text fallback when image fails to load', () => {
    render(
      <MnemonicImage
        imageUrl="https://assets.japanese-learning.app/radicals/n5/ichi.png"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    fireEvent.press(screen.getByTestId('mock-expo-image-trigger-error'));

    expect(screen.getByText('Radical one (一)')).toBeTruthy();
  });

  it('sets accessibilityLabel on rendered image', () => {
    render(
      <MnemonicImage
        imageUrl="https://assets.japanese-learning.app/radicals/n5/ichi.png"
        meaning="one"
        primaryForm="一"
      />,
    );

    expect(screen.getByLabelText('one (一)')).toBeTruthy();
  });

  it('renders mocked expo-image for a valid URL', () => {
    render(
      <MnemonicImage
        imageUrl="https://assets.japanese-learning.app/radicals/n5/ichi.png"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    expect(screen.getByTestId('mock-expo-image')).toBeTruthy();
  });
});
