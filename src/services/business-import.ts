import { z } from 'zod';
import { SsrfError, assertSafePublicUrl, parseHttpUrl } from '@/lib/ssrf';
import { OPENAI_LIMITS, OPENAI_MODEL_OWNER, requireOpenAIClient } from '@/lib/openai';
import type { ExtractedBusinessInfo } from '@/types/business-import';

export const FETCH_TIMEOUT_MS = 8000;
export const MAX_PAGE_BYTES = 400_000;
export const MAX_PAGES = 7;
export const MAX_REDIRECTS = 3;
export const MAX_SOURCE_TEXT = 24_000;

export const RELATED_PAGE_PATHS = ['/about', '/about-us', '/services', '/contact', '/faq', '/hours'];

export const extractedBusinessSchema = z.object({
  businessName: z.string().nullable(),
  description: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  phone: z.string().nullable(),
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        isActive: z.boolean(),
      })
    )
    .nullable(),
  services: z
    .array(
      z.object({
        name: z.string(),
        price: z.number().nullable(),
        duration: z.number().nullable(),
        description: z.string().nullable(),
      })
    )
    .nullable(),
  policies: z
    .object({
      cancellation: z.string().nullable(),
      deposit: z.string().nullable(),
      late: z.string().nullable(),
    })
    .nullable(),
  faqs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .nullable(),
});

export type { ExtractedBusinessInfo } from '@/types/business-import';

export function extractTextFromHtml(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|br|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return withoutNoise.slice(0, MAX_SOURCE_TEXT);
}

export function buildSameDomainUrls(startUrl: string): string[] {
  const parsed = parseHttpUrl(startUrl);
  const origin = parsed.origin;
  const urls = new Set<string>([parsed.href]);
  for (const path of RELATED_PAGE_PATHS) {
    urls.add(new URL(path, `${origin}/`).href);
  }
  return Array.from(urls).slice(0, MAX_PAGES);
}

async function fetchWithLimit(url: string, hops = 0): Promise<{ url: string; body: string; contentType: string }> {
  if (hops > MAX_REDIRECTS) {
    throw new SsrfError('Too many redirects');
  }

  const safeUrl = await assertSafePublicUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(safeUrl.href, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,text/plain,application/pdf',
        'User-Agent': 'Text2BookImporter/1.0',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new SsrfError('Redirect was missing a location');
      }
      const nextUrl = new URL(location, safeUrl.href).href;
      return fetchWithLimit(nextUrl, hops + 1);
    }

    if (!response.ok) {
      throw new Error(`Could not fetch ${safeUrl.hostname} (${response.status})`);
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_PAGE_BYTES) {
      throw new Error('That page is too large to import');
    }

    return {
      url: safeUrl.href,
      body: buffer.toString('utf8'),
      contentType,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SsrfError('Timed out fetching that website');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWebsiteText(url: string): Promise<{ sourceUrls: string[]; text: string }> {
  const candidates = buildSameDomainUrls(url);
  const pages: string[] = [];
  const sourceUrls: string[] = [];

  for (const candidate of candidates) {
    try {
      const page = await fetchWithLimit(candidate);
      if (!/text\/html|text\/plain/i.test(page.contentType) && page.contentType) {
        continue;
      }
      const text = extractTextFromHtml(page.body);
      if (text.length > 40) {
        pages.push(`Source: ${page.url}\n${text}`);
        sourceUrls.push(page.url);
      }
    } catch (error) {
      if (candidate === candidates[0]) {
        throw error;
      }
    }
    if (pages.length >= MAX_PAGES) break;
  }

  if (pages.length === 0) {
    throw new Error('Could not extract readable text from that website');
  }

  return {
    sourceUrls,
    text: pages.join('\n\n').slice(0, MAX_SOURCE_TEXT),
  };
}

export async function extractTextFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<string> {
  const name = filename.toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (name.endsWith('.txt') || mime.startsWith('text/plain')) {
    return buffer.toString('utf8').slice(0, MAX_SOURCE_TEXT);
  }

  if (name.endsWith('.pdf') || mime === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default as (data: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    return (result.text || '').slice(0, MAX_SOURCE_TEXT);
  }

  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').slice(0, MAX_SOURCE_TEXT);
  }

  if (name.endsWith('.doc')) {
    throw new Error('DOC files are not supported. Upload a PDF, DOCX, or TXT file.');
  }

  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) {
    throw new Error('Image OCR is not enabled yet. Upload a PDF, DOCX, TXT file, or a website URL.');
  }

  throw new Error('Unsupported file type. Upload a PDF, DOCX, or TXT file.');
}

export async function structureBusinessInfo(text: string): Promise<ExtractedBusinessInfo> {
  const openai = requireOpenAIClient();

  const response = await openai.chat.completions.create({
    model: OPENAI_MODEL_OWNER,
    temperature: OPENAI_LIMITS.extractTemperature,
    max_tokens: OPENAI_LIMITS.extractMaxTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Extract booking-relevant business details from the provided text. Return JSON only. Use null when a value is not found. dayOfWeek uses 0=Sunday through 6=Saturday. Times use HH:MM 24-hour format. Prices are numbers in dollars. Durations are minutes.',
      },
      {
        role: 'user',
        content: `Extract business name, description, address, city, state, zipCode, phone, hours, services (name, price, duration, description), policies (cancellation, deposit, late), and a generated FAQ list.\n\nTEXT:\n${text.slice(0, MAX_SOURCE_TEXT)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('The AI did not return any extracted information');
  }

  const parsed = extractedBusinessSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error('Could not structure the extracted business information');
  }
  return parsed.data;
}

export async function extractBusinessInfo(input: {
  url?: string;
  file?: { buffer: Buffer; filename: string; mimeType?: string };
}): Promise<{ extracted: ExtractedBusinessInfo; sourceTextPreview: string; sourceUrls: string[] }> {
  const parts: string[] = [];
  const sourceUrls: string[] = [];

  if (input.url) {
    const site = await fetchWebsiteText(input.url);
    parts.push(site.text);
    sourceUrls.push(...site.sourceUrls);
  }

  if (input.file) {
    const fileText = await extractTextFromDocument(input.file.buffer, input.file.filename, input.file.mimeType);
    parts.push(fileText);
  }

  const sourceText = parts.join('\n\n').trim();
  if (!sourceText) {
    throw new Error('Provide a website URL or upload a document');
  }

  const extracted = await structureBusinessInfo(sourceText);
  return {
    extracted,
    sourceTextPreview: sourceText.slice(0, 800),
    sourceUrls,
  };
}
