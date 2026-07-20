import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { StudyStatusBanner } from '@/components/learn/StudyStatusBanner';
import type { CurriculumParentItem } from '@/data/curriculum/itemRepository';

const parents: CurriculumParentItem[] = [
  { id: '1', itemType: 'radical', primaryForm: '一' },
  { id: '2', itemType: 'radical', primaryForm: '口' },
];

describe('StudyStatusBanner', () => {
  it('names what is still needed when the item is locked', () => {
    render(
      <StudyStatusBanner status="not_started" isLocked unmetPrerequisites={parents} />,
    );

    expect(screen.getByTestId('study-status-banner')).toBeTruthy();
    expect(screen.getByText(/Study these first/)).toBeTruthy();
    expect(screen.getByText('一')).toBeTruthy();
    expect(screen.getByText('口')).toBeTruthy();
  });

  it('says the item is unstudied when prerequisites are met', () => {
    render(
      <StudyStatusBanner status="not_started" isLocked={false} unmetPrerequisites={[]} />,
    );

    expect(screen.getByText("You haven't studied this yet.")).toBeTruthy();
  });

  it('renders nothing for in-progress items', () => {
    render(
      <StudyStatusBanner status="in_progress" isLocked={false} unmetPrerequisites={[]} />,
    );

    expect(screen.queryByTestId('study-status-banner')).toBeNull();
  });

  it('renders nothing for known items', () => {
    render(<StudyStatusBanner status="known" isLocked={false} unmetPrerequisites={[]} />);

    expect(screen.queryByTestId('study-status-banner')).toBeNull();
  });

  it('still names unmet prerequisites when locked even if status is in progress', () => {
    render(
      <StudyStatusBanner status="in_progress" isLocked unmetPrerequisites={parents} />,
    );

    expect(screen.getByText(/Study these first/)).toBeTruthy();
    expect(screen.getByText('一')).toBeTruthy();
  });

  it('stays passive — it offers no lesson entry point', () => {
    render(
      <StudyStatusBanner status="not_started" isLocked unmetPrerequisites={parents} />,
    );

    expect(screen.queryByText(/Start lesson/i)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
