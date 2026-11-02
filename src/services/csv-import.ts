export type ImportKind = 'clients' | 'services' | 'appointments';

export interface ColumnMapping {
  [canonical: string]: string;
}

export interface ImportPreset {
  id: string;
  name: string;
  kind: ImportKind;
  mapping: ColumnMapping;
}

export const IMPORT_PRESETS: ImportPreset[] = [
  {
    id: 'square_clients',
    name: 'Square Appointments clients',
    kind: 'clients',
    mapping: { name: 'Display Name', phone: 'Phone Number', email: 'Email Address' },
  },
  {
    id: 'square_appointments',
    name: 'Square Appointments upcoming',
    kind: 'appointments',
    mapping: {
      clientName: 'Customer Name',
      clientPhone: 'Customer Phone',
      serviceName: 'Service',
      startTime: 'Start Time',
      duration: 'Duration',
      price: 'Amount',
    },
  },
  {
    id: 'vagaro_clients',
    name: 'Vagaro clients',
    kind: 'clients',
    mapping: { name: 'Client Name', phone: 'Mobile', email: 'Email' },
  },
  {
    id: 'vagaro_appointments',
    name: 'Vagaro appointments',
    kind: 'appointments',
    mapping: {
      clientName: 'Client',
      clientPhone: 'Phone',
      serviceName: 'Service Name',
      startTime: 'Appointment Date',
      duration: 'Length',
      price: 'Price',
    },
  },
  {
    id: 'booksy_clients',
    name: 'Booksy clients',
    kind: 'clients',
    mapping: { name: 'Customer', phone: 'Phone', email: 'Email' },
  },
  {
    id: 'booksy_appointments',
    name: 'Booksy appointments',
    kind: 'appointments',
    mapping: {
      clientName: 'Customer',
      clientPhone: 'Phone',
      serviceName: 'Service',
      startTime: 'Date',
      duration: 'Duration',
      price: 'Price',
    },
  },
  {
    id: 'fresha_clients',
    name: 'Fresha clients',
    kind: 'clients',
    mapping: { name: 'Full name', phone: 'Mobile number', email: 'Email' },
  },
  {
    id: 'fresha_appointments',
    name: 'Fresha appointments',
    kind: 'appointments',
    mapping: {
      clientName: 'Client name',
      clientPhone: 'Client mobile',
      serviceName: 'Service name',
      startTime: 'Start time',
      duration: 'Duration (min)',
      price: 'Sale price',
    },
  },
  {
    id: 'glossgenius_clients',
    name: 'GlossGenius clients',
    kind: 'clients',
    mapping: { name: 'Name', phone: 'Phone', email: 'Email' },
  },
  {
    id: 'glossgenius_appointments',
    name: 'GlossGenius appointments',
    kind: 'appointments',
    mapping: {
      clientName: 'Client',
      clientPhone: 'Phone',
      serviceName: 'Service',
      startTime: 'Start',
      duration: 'Minutes',
      price: 'Total',
    },
  },
  {
    id: 'acuity_clients',
    name: 'Acuity clients',
    kind: 'clients',
    mapping: { name: 'First Name + Last Name', phone: 'Phone', email: 'Email' },
  },
  {
    id: 'acuity_appointments',
    name: 'Acuity appointments',
    kind: 'appointments',
    mapping: {
      clientName: 'Name',
      clientPhone: 'Phone',
      serviceName: 'Appointment Type',
      startTime: 'Start Time',
      duration: 'Duration',
      price: 'Price',
    },
  },
  {
    id: 'calendly_appointments',
    name: 'Calendly export',
    kind: 'appointments',
    mapping: {
      clientName: 'Invitee Name',
      clientPhone: 'Invitee Phone Number',
      serviceName: 'Event Type Name',
      startTime: 'Start Date & Time',
      duration: 'Event Duration',
      email: 'Invitee Email',
    },
  },
  {
    id: 'generic_services',
    name: 'Services (name, duration, price)',
    kind: 'services',
    mapping: { name: 'Name', duration: 'Duration', price: 'Price', description: 'Description' },
  },
];

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] || '').trim();
    });
    return row;
  });
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.trim();
}

export interface PreviewRow {
  data: Record<string, string>;
  duplicate: boolean;
  reason?: string;
}

export function previewImport(params: {
  kind: ImportKind;
  rows: Record<string, string>[];
  mapping: ColumnMapping;
  existingPhones?: string[];
  existingServiceNames?: string[];
}): { rows: PreviewRow[]; kept: number; duplicates: number } {
  const existingPhones = new Set((params.existingPhones || []).map((p) => normalizePhone(p).slice(-10)));
  const existingServices = new Set((params.existingServiceNames || []).map((n) => n.toLowerCase()));
  const seen = new Set<string>();
  const preview: PreviewRow[] = [];
  let duplicates = 0;

  for (const raw of params.rows) {
    const data: Record<string, string> = {};
    for (const [canonical, source] of Object.entries(params.mapping)) {
      if (source.includes(' + ')) {
        data[canonical] = source
          .split(' + ')
          .map((part) => raw[part.trim()] || '')
          .filter(Boolean)
          .join(' ')
          .trim();
      } else {
        data[canonical] = raw[source] || '';
      }
    }

    let key = '';
    if (params.kind === 'clients' || params.kind === 'appointments') {
      const phone = normalizePhone(data.phone || data.clientPhone || '');
      key = `${params.kind}:${phone.slice(-10)}:${data.startTime || ''}`;
      if (phone && existingPhones.has(phone.slice(-10)) && params.kind === 'clients') {
        preview.push({ data, duplicate: true, reason: 'Phone already in your clients' });
        duplicates++;
        continue;
      }
    } else if (params.kind === 'services') {
      key = `service:${(data.name || '').toLowerCase()}`;
      if (data.name && existingServices.has(data.name.toLowerCase())) {
        preview.push({ data, duplicate: true, reason: 'Service name already exists' });
        duplicates++;
        continue;
      }
    }

    if (key && seen.has(key)) {
      preview.push({ data, duplicate: true, reason: 'Duplicate row in this file' });
      duplicates++;
      continue;
    }
    if (key) seen.add(key);
    preview.push({ data, duplicate: false });
  }

  return {
    rows: preview,
    kept: preview.filter((r) => !r.duplicate).length,
    duplicates,
  };
}

export function detectPreset(headers: string[]): ImportPreset | null {
  const normalized = headers.map((h) => h.toLowerCase());
  let best: ImportPreset | null = null;
  let bestScore = 0;
  for (const preset of IMPORT_PRESETS) {
    const sources = Object.values(preset.mapping).flatMap((s) =>
      s.includes(' + ') ? s.split(' + ').map((p) => p.trim()) : [s]
    );
    const score = sources.filter((s) => normalized.includes(s.toLowerCase())).length;
    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }
  return bestScore >= 2 ? best : null;
}
