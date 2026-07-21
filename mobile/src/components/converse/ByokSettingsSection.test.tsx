import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ByokSettingsSection } from '@/components/converse/ByokSettingsSection';

const mockUserDb = {};
const mockSetCloudSttOptIn = jest.fn();
let mockCloudSttOptIn = false;
let mockConfigured: string[] = [];
let mockActiveProvider: string | null = null;

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: mockUserDb }),
}));

jest.mock('@/data/ai/byokCredentialStore', () => ({
  listConfiguredByokProviders: () => Promise.resolve({ ok: true, value: mockConfigured }),
  discardByokKey: (provider: string) => {
    mockConfigured = mockConfigured.filter((entry) => entry !== provider);
    return Promise.resolve({ ok: true, value: undefined });
  },
}));

jest.mock('@/data/user/preferencesRepository', () => ({
  getAiActiveProvider: () => mockActiveProvider,
  setAiActiveProvider: jest.fn(),
  getCloudSttOptIn: () => mockCloudSttOptIn,
  setCloudSttOptIn: (...args: unknown[]) => mockSetCloudSttOptIn(...args),
}));

describe('ByokSettingsSection cloud STT toggle', () => {
  beforeEach(() => {
    mockConfigured = [];
    mockCloudSttOptIn = false;
    mockActiveProvider = null;
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

  // The toggle must promise exactly what `transcribeTurn` will do: it routes on
  // the *active* provider, not on merely owning an OpenAI key.
  it('disables the toggle when an OpenAI key exists but Anthropic is active', async () => {
    mockConfigured = ['openai', 'anthropic'];
    mockActiveProvider = 'anthropic';
    render(<ByokSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId('cloud-stt-toggle').props.accessibilityState.disabled).toBe(true),
    );
    expect(screen.getByText(/Make OpenAI-compatible the active provider/i)).toBeTruthy();
  });

  it('enables the toggle when OpenAI is the active provider of two keys', async () => {
    mockConfigured = ['openai', 'anthropic'];
    mockActiveProvider = 'openai';
    render(<ByokSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId('cloud-stt-toggle').props.accessibilityState.disabled).toBe(false),
    );
  });

  // Turning it back off must never become unreachable, or the learner is stuck
  // opted into an upload path that always errors.
  it('keeps an already-on toggle operable when OpenAI is no longer available', async () => {
    mockConfigured = ['anthropic'];
    mockCloudSttOptIn = true;
    render(<ByokSettingsSection />);

    await waitFor(() =>
      expect(screen.getByTestId('cloud-stt-toggle').props.accessibilityState.disabled).toBe(false),
    );
    fireEvent(screen.getByTestId('cloud-stt-toggle'), 'valueChange', false);

    expect(mockSetCloudSttOptIn).toHaveBeenCalledWith(mockUserDb, false);
  });

  it('clears the opt-in when the OpenAI key is removed', async () => {
    mockConfigured = ['openai'];
    mockCloudSttOptIn = true;
    render(<ByokSettingsSection />);

    await waitFor(() => expect(screen.getByTestId('byok-remove-openai')).toBeTruthy());
    fireEvent.press(screen.getByTestId('byok-remove-openai'));

    await waitFor(() => expect(mockSetCloudSttOptIn).toHaveBeenCalledWith(mockUserDb, false));
  });
});
