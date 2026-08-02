import { render, screen } from '@testing-library/react-native';

import { SectionStepper } from './SectionStepper';

const SECTIONS = ['INTRO', 'MNEMONIC', 'EXAMPLES'] as const;

describe('SectionStepper', () => {
  it('tints the active pill in the item type and leaves the rest neutral', () => {
    render(
      <SectionStepper sections={SECTIONS} activeIndex={1} itemType="kanji" testID="stepper" />,
    );

    expect(screen.getByTestId('stepper-1').props.className).toContain('bg-content-kanji-soft');
    expect(screen.getByTestId('stepper-0').props.className).toContain('bg-surface-elevated');
    expect(screen.getByText('MNEMONIC').props.className).toContain('text-content-kanji-deep');
  });

  it('falls back to jade when no item type is given', () => {
    render(<SectionStepper sections={SECTIONS} activeIndex={0} testID="stepper" />);
    expect(screen.getByTestId('stepper-0').props.className).toContain('bg-brand-soft');
  });

  it('announces position rather than making a screen reader walk three pills', () => {
    render(<SectionStepper sections={SECTIONS} activeIndex={2} itemType="radical" />);
    expect(screen.getByLabelText('Section 3 of 3: EXAMPLES')).toBeTruthy();
  });
});
