import PDFDocument from 'pdfkit';
import type { InvoiceData } from './invoice';

const INK = '#111111';
const MUTED = '#666666';
const RULE = '#DDDDDD';

function amount(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' });
}

export function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const credit = data.kind === 'credit_note';
    const title = credit ? 'Credit note' : 'Tax invoice';
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `${title} ${data.number}`, Author: data.seller.name } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const rule = () => {
      doc.moveDown(0.6);
      doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.moveDown(0.6);
    };
    const pair = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(label, left, y, { width: width * 0.6 });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(INK).text(value, left + width * 0.6, y, { width: width * 0.4, align: 'right' });
      doc.moveDown(0.3);
    };

    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(title);
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`${data.number}  ·  ${istDate(data.issuedAt)}  ·  Order ${data.orderNumber}`);
    if (credit && data.againstInvoice) doc.text(`Against tax invoice ${data.againstInvoice}. The full amount below has been refunded.`);
    rule();

    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(data.seller.name, left, top, { width: width / 2 - 8 });
    doc.font('Helvetica').fillColor(MUTED);
    if (data.seller.address) doc.text(data.seller.address, { width: width / 2 - 8 });
    doc.text(`GSTIN: ${data.seller.gstin ?? 'pending registration'}`, { width: width / 2 - 8 });
    const sellerBottom = doc.y;
    doc.font('Helvetica-Bold').fillColor(INK).text('Billed to', left + width / 2, top, { width: width / 2 });
    doc.font('Helvetica').fillColor(MUTED).text(data.buyer.name, { width: width / 2 });
    if (data.buyer.email) doc.text(data.buyer.email, { width: width / 2 });
    if (data.buyer.phone) doc.text(data.buyer.phone, { width: width / 2 });
    doc.text(`Place of supply: ${data.placeOfSupply}`, { width: width / 2 });
    doc.y = Math.max(sellerBottom, doc.y);
    doc.x = left;
    rule();

    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(data.description, left, doc.y, { width });
    doc.font('Helvetica').fillColor(MUTED).text(`SAC ${data.sac}`);
    doc.moveDown(0.8);

    pair('Price (GST included)', amount(data.subtotal, data.currency));
    if (data.discount > 0) pair('Discount', `- ${amount(data.discount, data.currency)}`);
    if (data.credit > 0) pair('Travel credit', `- ${amount(data.credit, data.currency)}`);
    pair('Taxable value', amount(data.taxable, data.currency));
    if (data.igst > 0) pair('IGST 18%', amount(data.igst, data.currency));
    else {
      pair('CGST 9%', amount(data.cgst, data.currency));
      pair('SGST 9%', amount(data.sgst, data.currency));
    }
    rule();
    pair(credit ? 'Total refunded' : 'Total paid', amount(data.total, data.currency), true);

    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`This is a computer-generated ${credit ? 'credit note' : 'invoice'} and needs no signature.`, left, doc.y, { width });
    doc.end();
  });
}
