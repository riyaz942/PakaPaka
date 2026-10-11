import { fireEvent, render, screen } from '@testing-library/react-native';

import { MnemonicImage } from '@/components/common/MnemonicImage';

// The real map is generated from the art committed under assets/radicals/, so
// these tests stand in two known refs rather than depending on which radicals
// have been drawn.
jest.mock('@/utils/radicalImages', () => ({
  getRadicalImage: (ref?: string | null) =>
    ref === 'radicals/ichi.webp' || ref === 'radicals/ni.webp' ? 1 : undefined,
}));

describe('MnemonicImage', () => {
  it('shows text fallback when the ref has no bundled image', () => {
    render(
      <MnemonicImage
        imageUrl="radicals/undrawn.webp"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
        testID="mnemonic-fallback"
      />,
    );

    expect(screen.getByLabelText('Radical one (一)')).toBeTruthy();
    expect(screen.queryByTestId('mock-expo-image')).toBeNull();
  });

  it('shows text fallback when the ref is missing', () => {
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

  it('shows text fallback when a remote URL is passed — art is bundled only', () => {
    render(
      <MnemonicImage
        imageUrl="https://assets.japanese-learning.app/radicals/ichi.png"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    expect(screen.queryByTestId('mock-expo-image')).toBeNull();
    expect(screen.getByText('Radical one (一)')).toBeTruthy();
  });

  it('retries image load when the ref changes after an error', () => {
    const { rerender } = render(
      <MnemonicImage
        imageUrl="radicals/ni.webp"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    fireEvent.press(screen.getByTestId('mock-expo-image-trigger-error'));
    expect(screen.getByText('Radical one (一)')).toBeTruthy();

    rerender(
      <MnemonicImage
        imageUrl="radicals/ichi.webp"
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
        imageUrl="radicals/ichi.webp"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    fireEvent.press(screen.getByTestId('mock-expo-image-trigger-error'));

    expect(screen.getByText('Radical one (一)')).toBeTruthy();
  });

  it('sets accessibilityLabel on rendered image', () => {
    render(<MnemonicImage imageUrl="radicals/ichi.webp" meaning="one" primaryForm="一" />);

    expect(screen.getByLabelText('one (一)')).toBeTruthy();
  });

  it('renders mocked expo-image for a bundled ref', () => {
    render(
      <MnemonicImage
        imageUrl="radicals/ichi.webp"
        meaning="one"
        mnemonicText="Radical one (一)"
        primaryForm="一"
      />,
    );

    expect(screen.getByTestId('mock-expo-image')).toBeTruthy();
  });
});
