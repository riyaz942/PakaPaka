/**
 * Stands in for `react-native-audio-api` under Jest.
 *
 * This library is the microphone and the speaker — executorch supplies neither.
 * The mock lets a test drive what the mic "heard" (`__mockSetRecordedChunks`)
 * and assert what reached the speaker (`__mockPlayedBuffers`).
 */

type PermissionStatus = 'Undetermined' | 'Denied' | 'Granted';

type CallbackOptions = {
  sampleRate: number;
  bufferLength: number;
  channelCount: number;
};

type AudioReadyEvent = {
  buffer: {
    sampleRate: number;
    getChannelData: (channel: number) => Float32Array;
  };
  numFrames: number;
};

const state = {
  recordedChunks: [] as Float32Array[],
  recordedSampleRate: 16000,
  permission: 'Granted' as PermissionStatus,
  permissionRequestResult: 'Granted' as PermissionStatus,
  startError: null as Error | null,
  startErrorAsResult: false,
  played: [] as { samples: Float32Array; sampleRate: number }[],
  permissionRequests: 0,
};

export function __mockResetAudioApi(): void {
  state.recordedChunks = [];
  state.recordedSampleRate = 16000;
  state.permission = 'Granted';
  state.permissionRequestResult = 'Granted';
  state.startError = null;
  state.startErrorAsResult = false;
  state.played = [];
  state.permissionRequests = 0;
}

/** Audio the microphone will deliver on the next recording. */
export function __mockSetRecordedChunks(chunks: Float32Array[], sampleRate = 16000): void {
  state.recordedChunks = chunks;
  state.recordedSampleRate = sampleRate;
}

/** The permission state before anything is asked. */
export function __mockSetPermission(status: PermissionStatus): void {
  state.permission = status;
}

/** What the learner chooses when the system prompt appears. */
export function __mockSetPermissionRequestResult(status: PermissionStatus): void {
  state.permissionRequestResult = status;
}

export function __mockFailRecorderStart(error: Error, asResult = false): void {
  state.startError = error;
  state.startErrorAsResult = asResult;
}

export function __mockPlayedBuffers(): { samples: Float32Array; sampleRate: number }[] {
  return state.played;
}

export function __mockPermissionRequestCount(): number {
  return state.permissionRequests;
}

export class AudioRecorder {
  private callback: ((event: AudioReadyEvent) => void) | null = null;
  private errorCallback: ((error: unknown) => void) | null = null;
  private recording = false;

  onAudioReady(_options: CallbackOptions, callback: (event: AudioReadyEvent) => void) {
    this.callback = callback;
    return { status: 'success' as const };
  }

  clearOnAudioReady(): void {
    this.callback = null;
  }

  async start(): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
    if (state.startError) {
      if (state.startErrorAsResult) {
        return { status: 'error', message: state.startError.message };
      }
      throw state.startError;
    }
    this.recording = true;
    for (const chunk of state.recordedChunks) {
      this.callback?.({
        buffer: {
          sampleRate: state.recordedSampleRate,
          getChannelData: () => chunk,
        },
        numFrames: chunk.length,
      });
    }
    return { status: 'success' };
  }

  async stop(): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
    this.recording = false;
    return { status: 'success' };
  }

  isRecording(): boolean {
    return this.recording;
  }

  onError(callback: (error: unknown) => void): void {
    this.errorCallback = callback;
  }

  clearOnError(): void {
    this.errorCallback = null;
  }
}

class MockAudioBuffer {
  readonly channelData: Float32Array;

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.channelData = new Float32Array(length);
  }

  getChannelData(): Float32Array {
    return this.channelData;
  }

  copyToChannel(source: Float32Array, _channel: number, startInChannel = 0): void {
    this.channelData.set(source, startInChannel);
  }
}

class MockBufferSource {
  buffer: MockAudioBuffer | null = null;
  onEnded: (() => void) | null = null;

  connect(_destination: unknown): void {}
  disconnect(): void {}

  start(): void {
    if (this.buffer) {
      state.played.push({
        samples: this.buffer.getChannelData(),
        sampleRate: this.buffer.sampleRate,
      });
    }
    this.onEnded?.();
  }

  stop(): void {}
}

export class AudioContext {
  readonly destination = {};
  readonly sampleRate: number;

  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate ?? 44100;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource() {
    return new MockBufferSource();
  }

  async close(): Promise<void> {}
}

export const AudioManager = {
  async checkRecordingPermissions(): Promise<PermissionStatus> {
    return state.permission;
  },
  async requestRecordingPermissions(): Promise<PermissionStatus> {
    state.permissionRequests += 1;
    state.permission = state.permissionRequestResult;
    return state.permission;
  },
  setAudioSessionOptions(_options: unknown): void {},
  async setAudioSessionActivity(_enabled: boolean): Promise<void> {},
};
