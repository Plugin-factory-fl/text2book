import { detectPreset, parseCsv, previewImport } from '../src/services/csv-import';

describe('CSV import', () => {
  it('parses Square style clients and flags duplicates', () => {
    const csv = `Display Name,Phone Number,Email Address
Emily Chen,(555) 987-6543,emily.chen@email.com
Priya Shah,(555) 111-2222,priya@email.com
Priya Shah,(555) 111-2222,priya@email.com`;
    const parsed = parseCsv(csv);
    expect(parsed.headers).toContain('Display Name');
    const preset = detectPreset(parsed.headers);
    expect(preset?.id).toBe('square_clients');
    const preview = previewImport({
      kind: 'clients',
      rows: parsed.rows,
      mapping: preset!.mapping,
      existingPhones: ['+15559876543'],
    });
    expect(preview.duplicates).toBe(2);
    expect(preview.kept).toBe(1);
  });
});
