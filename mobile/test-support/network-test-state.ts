const NetworkStateType = {
  WIFI: 'WIFI',
  CELLULAR: 'CELLULAR',
} as const;

let mockConnected = true;
let mockWifi = true;

export function resetMockNetwork() {
  mockConnected = true;
  mockWifi = true;
}

export function setMockNetworkState(options: {
  isConnected?: boolean;
  isWifi?: boolean;
}) {
  if (options.isConnected !== undefined) {
    mockConnected = options.isConnected;
  }
  if (options.isWifi !== undefined) {
    mockWifi = options.isWifi;
  }
}

export async function getMockNetworkStateAsync() {
  return {
    type: mockWifi ? NetworkStateType.WIFI : NetworkStateType.CELLULAR,
    isConnected: mockConnected,
    isInternetReachable: mockConnected,
  };
}
