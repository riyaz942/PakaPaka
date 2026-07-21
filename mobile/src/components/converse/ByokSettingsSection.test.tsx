import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ByokSettingsSection } from '@/components/converse/ByokSettingsSection';

const mockUserDb = {};
const mockSetCloudSttOptIn = jest.fn();
let mockCloudSttOptIn = false;
let mockConfigured: string[] = [];

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: mockUserDb }),
}));

jest.mock('@/data/ai/byokCredentialStore', () => ({
  listConfiguredByokProviders: () => Promise.resolve({ ok: true, value: mockConfigured }),
  discardByokKey: jest.fn(),
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getAiActiveProvider: () => null,
  setAiActiveProvider: jest.fn(),
  getCloudSttOptIn: () => mockCloudSttOptIn,
  setCloudSttOptIn: (...args: unknown[]) => mockSetCloudSttOptIn(...args),
}));

describe('ByokSettingsSection cloud STT toggle', () => {
  beforeEach(() => {
    mockConfigured = [];
    mockCloudSttOptIn = false;
    mockSetCloudSttOptIn.mockClear();
  });

  it('is off by default so speech stays on-device (AC6)', async () => {
    mockConfigured = ['openai'];
    render(<ByokSettingsSection />);

    await waitFor(() => expect(screen.getByTestId('cloud-stt-toggle').props.value).toBe(false));
  });

  it('records the opt-in when the learner turns it on', async () => {
    mockConfigured = ['openai'];
    render(<ByokSettingsSection />);

    await waitFor(() => expect(screen.getByTestId('cloud-stt-toggle')).toBeTruthy());
    fireEvent(screen.getByTestId('cloud-stt-toggle'), 'valueChange', true);

    expect(mockSetCloudSttOptIn).toHaveBeenCalledWith(mockUserDb, true);
  });

  it('disables the toggle and says why when only Anthropic is configured', async () => {
    mockConfigured = ['anthropic'];
    render(<ByokSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId('cloud-stt-toggle').props.accessibilityState.disabled).toBe(true),
    );
    expect(screen.getByText(/Anthropic has no transcription endpoint/i)).toBeTruthy();
  });

  it('explains that speech stays on-device when the toggle is off', async () => {
    mockConfigured = ['openai'];
    render(<ByokSettingsSection />);

    await waitFor(() =>
      expect(screen.getByText(/transcribed on this device/i)).toBeTruthy(),
    );
  });
});
