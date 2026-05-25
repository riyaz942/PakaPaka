import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA_PATH = path.join(__dirname, '..', 'curriculum', 'schema', 'curriculum.schema.json');

function compileRadicalsValidator() {
  const schemaRaw = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as {
    $id?: string;
    $defs: Record<string, unknown>;
  };
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schemaId = schemaRaw.$id ?? 'curriculum.schema.json';
  ajv.addSchema(schemaRaw, schemaId);
  return ajv.compile({ $ref: `${schemaId}#/$defs/radicalsFile` });
}

describe('curriculum schema validation', () => {
  it('accepts valid radicals fixture', () => {
    const validate = compileRadicalsValidator();
    const fixture = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '__fixtures__', 'valid', 'radicals', 'n5.json'),
        'utf8',
      ),
    );
    expect(validate(fixture)).toBe(true);
  });

  it('rejects invalid radical URL', () => {
    const validate = compileRadicalsValidator();
    const fixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, '__fixtures__', 'invalid-radical.json'), 'utf8'),
    );
    expect(validate(fixture)).toBe(false);
    expect(validate.errors?.length).toBeGreaterThan(0);
  });
});
