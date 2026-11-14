import { render } from '@testing-library/react-native';

import RootIndex from './index';

const mockRedirect = jest.fn();

jest.mock('expo-router', () => ({
  Redirect: function Redirect(props: { href: string }) {
    mockRedirect(props.href);
    return null;
  },
}));

describe('root index route', () => {
  it('sends "/" to Home at /dashboard', () => {
    render(<RootIndex />);
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });
});
