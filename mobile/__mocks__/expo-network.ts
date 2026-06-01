export {
  getMockNetworkStateAsync as getNetworkStateAsync,
  resetMockNetwork as __mockResetNetwork,
  setMockNetworkState as __mockSetNetworkState,
} from '../test-support/network-test-state';

export const NetworkStateType = {
  NONE: 'NONE',
  UNKNOWN: 'UNKNOWN',
  CELLULAR: 'CELLULAR',
  WIFI: 'WIFI',
  BLUETOOTH: 'BLUETOOTH',
  ETHERNET: 'ETHERNET',
  WIMAX: 'WIMAX',
  VPN: 'VPN',
  OTHER: 'OTHER',
} as const;
