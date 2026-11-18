import { render, screen } from '@testing-library/react-native';
import React from 'react';

import type { BackupPreview } from '@/core/backup/backup.types';

import { RESTORE_CONFIRM_WARNING, RestorePreviewCard } from './RestorePreviewCard';

const PREVIEW = {
  unmatchedSlugs: [],
  summary: {
    itemCount: 12,
    unmatchedSlugCount: 0,
    unmatchedPassageCount: 0,
    includesConversations: false,
    exportedAt: '2026-08-10T00:00:00.000Z',
    curriculumVersion: '1.4.0',
    schemaVersion: 19,
  },
} as unknown as BackupPreview;

function renderCard(signedIn: boolean) {
  render(
    <RestorePreviewCard
      state="summary"
      preview={PREVIEW}
      signedIn={signedIn}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
    />,
  );
}

describe('RestorePreviewCard warning', () => {
  it('signed in shows the all-devices warning', () => {
    renderCard(true);
    expect(screen.getByTestId('restore-preview-warning')).toHaveTextContent(
      'This replaces the progress on all your signed-in devices.',
    );
  });

  it('signed out shows the device warning', () => {
    renderCard(false);
    expect(screen.getByTestId('restore-preview-warning')).toHaveTextContent(
      RESTORE_CONFIRM_WARNING,
    );
  });
});
