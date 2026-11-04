import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import ConverseTabLayout from './_layout';

const mockRedirect = jest.fn();

jest.mock('expo-router', () => {
  function Stack({ children }: { children?: React.ReactNode }) {
    return children ?? null;
  }
  Stack.Screen = function Screen() {
    return null;
  };
  return {
    Stack,
    Redirect: function Redirect(props: { href: string }) {
      mockRedirect(props.href);
      return null;
    },
  };
});

function setPlatform(os: 'ios' | 'web') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

describe('ConverseTabLayout', () => {
  beforeEach(() => mockRedirect.mockClear());
  afterEach(() => setPlatform('ios'));

  it('redirects deep links to Home on web', () => {
    setPlatform('web');
    render(<ConverseTabLayout />);
    expect(mockRedirect).toHaveBeenCalledWith('/');
  });

  it('renders the Talk stack on iOS', () => {
    setPlatform('ios');
    render(<ConverseTabLayout />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
