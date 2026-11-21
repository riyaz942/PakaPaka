import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURRICULUM_SCHEMA_VERSION } from './curriculum-schema';

describe('curriculum schema version', () => {
  it('the app requires the same schema version the compiler writes', () => {
    const text = readFileSync(
      join(__dirname, '..', 'mobile', 'src', 'data', 'curriculum', 'curriculumConfig.ts'),
      'utf8',
    );
    const match = /REQUIRED_CURRICULUM_SCHEMA_VERSION\s*=\s*(\d+)/.exec(text);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(CURRICULUM_SCHEMA_VERSION);
  });
});
