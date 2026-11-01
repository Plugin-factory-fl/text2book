import { isBlockedIp, isPrivateIPv4, parseHttpUrl, SsrfError } from '../src/lib/ssrf';
import { buildSameDomainUrls, extractTextFromHtml, extractTextFromDocument } from '../src/services/business-import';

describe('SSRF guard', () => {
  it('blocks private IPv4 ranges', () => {
    expect(isPrivateIPv4('127.0.0.1')).toBe(true);
    expect(isPrivateIPv4('10.0.0.5')).toBe(true);
    expect(isPrivateIPv4('192.168.1.20')).toBe(true);
    expect(isPrivateIPv4('172.16.4.1')).toBe(true);
    expect(isPrivateIPv4('169.254.169.254')).toBe(true);
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
  });

  it('blocks localhost and credentialed URLs', () => {
    expect(() => parseHttpUrl('http://localhost/admin')).toThrow(SsrfError);
    expect(() => parseHttpUrl('http://127.0.0.1/')).toThrow(SsrfError);
    expect(() => parseHttpUrl('http://169.254.169.254/latest/meta-data')).toThrow(SsrfError);
    expect(() => parseHttpUrl('file:///etc/passwd')).toThrow(SsrfError);
    expect(() => parseHttpUrl('ftp://example.com')).toThrow(SsrfError);
    expect(() => parseHttpUrl('https://user:pass@example.com')).toThrow(SsrfError);
  });

  it('allows public http(s) URLs', () => {
    expect(parseHttpUrl('https://example.com/about').hostname).toBe('example.com');
    expect(parseHttpUrl('http://my-salon.com').protocol).toBe('http:');
  });

  it('blocks IPv6 loopback and link local', () => {
    expect(isBlockedIp('::1')).toBe(true);
    expect(isBlockedIp('fe80::1')).toBe(true);
  });
});

describe('Business import parse helpers', () => {
  it('strips scripts and tags from HTML', () => {
    const text = extractTextFromHtml(`
      <html>
        <head><script>alert(1)</script><style>body{}</style></head>
        <body>
          <h1>Jane's Hair Studio</h1>
          <p>Cuts and color in San Francisco</p>
        </body>
      </html>
    `);

    expect(text).toContain("Jane's Hair Studio");
    expect(text).toContain('Cuts and color');
    expect(text).not.toContain('alert(1)');
    expect(text).not.toContain('<h1>');
  });

  it('builds same-domain about/services/contact/faq URLs', () => {
    const urls = buildSameDomainUrls('https://janeshair.example/');
    expect(urls).toContain('https://janeshair.example/');
    expect(urls.some((url) => url.endsWith('/about'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/services'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/contact'))).toBe(true);
    expect(urls.some((url) => url.endsWith('/faq'))).toBe(true);
    expect(urls.every((url) => url.startsWith('https://janeshair.example'))).toBe(true);
  });

  it('reads plain text documents', async () => {
    const text = await extractTextFromDocument(
      Buffer.from('Business: Jane Studio\nPhone: 555-123-4567'),
      'info.txt',
      'text/plain'
    );
    expect(text).toContain('Jane Studio');
    expect(text).toContain('555-123-4567');
  });

  it('rejects unsupported image OCR for now', async () => {
    await expect(
      extractTextFromDocument(Buffer.from('fake'), 'storefront.png', 'image/png')
    ).rejects.toThrow(/Image OCR/);
  });
});
