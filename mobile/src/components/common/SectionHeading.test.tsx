import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SectionHeading } from '@/components/common/SectionHeading';

describe('SectionHeading', () => {
  it('renders the label without an info affordance when no topic is given', () => {
    render(<SectionHeading label="Examples" />);

    expect(screen.getByText('Examples')).toBeTruthy();
    expect(screen.queryByTestId('section-heading-info-examples')).toBeNull();
  });

  it('opens the explainer sheet from the info affordance and closes again', () => {
    render(<SectionHeading label="On'yomi" infoTopic="onyomi-kunyomi" />);

    const info = screen.getByTestId("section-heading-info-on'yomi");
    expect(info.props.accessibilityLabel).toBe("What does On'yomi mean?");

    fireEvent.press(info);
    expect(screen.getByText("On'yomi and kun'yomi")).toBeTruthy();

    fireEvent.press(screen.getByTestId('explainer-sheet-close'));
    expect(screen.queryByText("On'yomi and kun'yomi")).toBeNull();
  });

  it('gives the info control a 44px hit target', () => {
    render(<SectionHeading label="Radicals" infoTopic="radical" />);

    const info = screen.getByTestId('section-heading-info-radicals');
    expect(info.props.className).toContain('min-h-[44px]');
    expect(info.props.className).toContain('min-w-[44px]');
  });

  it('uses an explicit testID when provided', () => {
    render(<SectionHeading label="Accepted answers" testID="accepted-answers-heading" />);

    expect(screen.getByTestId('accepted-answers-heading')).toBeTruthy();
  });
});
