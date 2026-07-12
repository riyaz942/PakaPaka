import { fireEvent, render, screen } from '@testing-library/react-native';

import { GrammarMcOptions } from './GrammarMcOptions';

const options = ['は', 'が', 'を', 'に'];

describe('GrammarMcOptions (Plan 08)', () => {
  it('renders every option as a radio', () => {
    render(<GrammarMcOptions options={options} onSelect={jest.fn()} />);
    for (const option of options) {
      expect(screen.getByLabelText(option)).toBeTruthy();
    }
  });

  it('submits the pressed option', () => {
    const onSelect = jest.fn();
    render(<GrammarMcOptions options={options} onSelect={onSelect} />);
    fireEvent.press(screen.getByLabelText('が'));
    expect(onSelect).toHaveBeenCalledWith('が');
  });

  it('marks the pressed option selected for assistive tech', () => {
    render(<GrammarMcOptions options={options} onSelect={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('を'));
    expect(screen.getByLabelText('を').props.accessibilityState.selected).toBe(true);
  });

  it('does not submit when disabled', () => {
    const onSelect = jest.fn();
    render(<GrammarMcOptions options={options} onSelect={onSelect} disabled />);
    fireEvent.press(screen.getByLabelText('は'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
