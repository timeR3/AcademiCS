import { describe, it, expect } from 'vitest';
import { cn } from '../utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('a', 'b')).toBe('a b');
    expect(cn('a', { b: true, c: false })).toBe('a b');
    expect(cn('px-2 py-2', 'p-4')).toBe('p-4'); // tailwind-merge in action
  });
});
