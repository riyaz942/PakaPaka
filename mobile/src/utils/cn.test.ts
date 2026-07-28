import { cn } from '@/utils/cn';

describe('cn', () => {
  it('merges conflicting Tailwind utilities with tailwind-merge', () => {
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
  });

  it('joins conditional class names with clsx', () => {
    expect(cn('base', false && 'hidden', 'block')).toBe('base block');
  });

  // Regression: a custom font-size token used to be read as a text *color*, so the
  // real color was dropped and the text fell back to platform black.
  it('keeps a text color alongside a custom font-size token', () => {
    expect(cn('text-primary text-center', 'text-title')).toBe(
      'text-primary text-center text-title',
    );
    expect(cn('text-secondary', 'text-caption')).toBe('text-secondary text-caption');
  });

  it('still collapses two font sizes and two text colors', () => {
    expect(cn('text-body', 'text-title')).toBe('text-title');
    expect(cn('text-primary', 'text-secondary')).toBe('text-secondary');
  });
});
