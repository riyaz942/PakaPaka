import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { ImportSummaryCard } from '@/components/import/ImportSummaryCard';
import type { ImportPreview } from '@/core/import/import.types';

const basePreview: ImportPreview = {
  source: 'wanikani',
  mapped: [],
  unmatched: [],
  summary: {
    source: 'wanikani',
    mappedCount: 2,
    unmatchedCount: 1,
    burnedCount: 1,
    apprenticeCount: 1,
  },
};

describe('ImportSummaryCard', () => {
  it('renders summary counts and SRS mapping lines', () => {
    render(
      <ImportSummaryCard
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onRetry={jest.fn()}
        preview={basePreview}
        state="summary"
      />,
    );

    expect(screen.getByText('WaniKani')).toBeTruthy();
    expect(screen.getByText('Mapped 2 of 3')).toBeTruthy();
    expect(screen.getByText('Burned items stay burned (1)')).toBeTruthy();
    expect(screen.getByText('Apprentice items enter at short intervals (1)')).toBeTruthy();
    expect(screen.getByTestId('import-summary-region').props.accessibilityRole).toBe('summary');
  });

  it('renders unmatched list items', () => {
    const preview: ImportPreview = {
      ...basePreview,
      unmatched: [
        { externalId: '999', srsStage: 4, srsStageName: 'apprentice' },
        { externalId: '1000', srsStage: 2, srsStageName: 'apprentice' },
      ],
      summary: { ...basePreview.summary, unmatchedCount: 2 },
    };

    render(
      <ImportSummaryCard
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onRetry={jest.fn()}
        preview={preview}
        state="summary"
      />,
    );

    expect(screen.getByText('999')).toBeTruthy();
    expect(screen.getByText('1000')).toBeTruthy();
    expect(screen.getByText('Unmatched items (2)')).toBeTruthy();
  });

  it('shows positive empty state when no unmatched items', () => {
    render(
      <ImportSummaryCard
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onRetry={jest.fn()}
        preview={{ ...basePreview, unmatched: [], summary: { ...basePreview.summary, unmatchedCount: 0 } }}
        state="summary"
      />,
    );

    expect(screen.getByText('All items matched')).toBeTruthy();
  });

  it('surfaces warningMessage when present', () => {
    const warning = 'Imported partial Bunpro progress.';
    const preview: ImportPreview = {
      ...basePreview,
      source: 'bunpro',
      summary: { ...basePreview.summary, source: 'bunpro', warningMessage: warning },
    };

    render(
      <ImportSummaryCard
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onRetry={jest.fn()}
        preview={preview}
        state="summary"
      />,
    );

    expect(screen.getByText(warning)).toBeTruthy();
  });

  it('fires confirm, cancel, and retry callbacks', () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const onRetry = jest.fn();

    const { rerender } = render(
      <ImportSummaryCard
        onCancel={onCancel}
        onConfirm={onConfirm}
        onRetry={onRetry}
        preview={basePreview}
        state="summary"
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Confirm import' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: 'Re-import' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(
      <ImportSummaryCard
        errorMessage="Import failed"
        onCancel={onCancel}
        onConfirm={onConfirm}
        onRetry={onRetry}
        state="error"
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders loading state', () => {
    render(
      <ImportSummaryCard
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
        onRetry={jest.fn()}
        state="loading"
      />,
    );

    expect(screen.getByLabelText('Loading import preview')).toBeTruthy();
  });
});
