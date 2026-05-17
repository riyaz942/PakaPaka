import { cn } from '@/utils/cn';

describe('cn', () => {
  it('merges conflicting Tailwind utilities with tailwind-merge', () => {
    expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
  });

  it('joins conditional class names with clsx', () => {
    expect(cn('base', false && 'hidden', 'block')).toBe('base block');
  });
});
