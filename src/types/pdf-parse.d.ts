declare module 'pdf-parse' {
  interface PDFParseResult {
    text: string;
    numpages?: number;
  }

  function pdfParse(data: Buffer): Promise<PDFParseResult>;
  export default pdfParse;
}
