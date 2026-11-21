import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import AboutScreen from './about';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
}));

describe('AboutScreen', () => {
  it('lists every third-party attribution from NOTICE', () => {
    render(<AboutScreen />);
    expect(screen.getByTestId('about-attribution-edrdg')).toBeTruthy();
    expect(screen.getByTestId('about-attribution-jmdict-furigana')).toBeTruthy();
    expect(screen.getByTestId('about-attribution-kanjivg')).toBeTruthy();
    expect(screen.getByText(/property of the Electronic Dictionary Research and Development Group/)).toBeTruthy();
    expect(screen.getByText(/copyright © Ulrich Apel/)).toBeTruthy();
  });

  it('opens a licence link in the browser', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<AboutScreen />);
    fireEvent.press(screen.getByLabelText('Open EDRDG licence'));
    expect(openURL).toHaveBeenCalledWith('https://www.edrdg.org/edrdg/licence.html');
  });

  it('opens the privacy policy page', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<AboutScreen />);
    fireEvent.press(screen.getByLabelText('Open Privacy policy'));
    expect(openURL).toHaveBeenCalledWith(expect.stringMatching(/\/privacy-policy$/));
  });
});
