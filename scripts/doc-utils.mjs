import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  TableRow, TableCell, Table, WidthType, BorderStyle, PageBreak,
  Header, Footer, ImageRun, ShadingType, TabStopPosition, TabStopType,
  NumberFormat, LevelFormat, convertInchesToTwip, PageNumber, ExternalHyperlink
} from 'docx';
import { writeFileSync } from 'fs';
import { Packer } from 'docx';

const MONDE_GREEN = '0A6E3C';
const MONDE_DARK = '1a1a2e';

export function title(text, options = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200, before: options.before || 0 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: options.size || 48,
        color: options.color || MONDE_GREEN,
        font: 'Calibri',
      }),
    ],
  });
}

export function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 300, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22,
        color: MONDE_GREEN,
        font: 'Calibri',
      }),
    ],
  });
}

export function subheading(text) {
  return heading(text, HeadingLevel.HEADING_2);
}

export function subsubheading(text) {
  return heading(text, HeadingLevel.HEADING_3);
}

export function para(text, options = {}) {
  return new Paragraph({
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    spacing: { after: options.after || 120, before: options.before || 0 },
    indent: options.indent ? { left: convertInchesToTwip(options.indent) } : undefined,
    children: [
      new TextRun({
        text,
        size: options.size || 22,
        font: 'Calibri',
        bold: options.bold || false,
        italics: options.italics || false,
        color: options.color || '333333',
      }),
    ],
  });
}

export function boldPara(text, options = {}) {
  return para(text, { ...options, bold: true });
}

export function bullet(text, level = 0) {
  return new Paragraph({
    spacing: { after: 60 },
    bullet: { level },
    children: [
      new TextRun({
        text,
        size: 22,
        font: 'Calibri',
        color: '333333',
      }),
    ],
  });
}

export function numberedItem(text, options = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    indent: { left: convertInchesToTwip(options.indent || 0.5) },
    children: [
      new TextRun({
        text,
        size: 22,
        font: 'Calibri',
        color: '333333',
      }),
    ],
  });
}

export function richPara(runs) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120 },
    children: runs.map(r =>
      new TextRun({
        text: r.text,
        bold: r.bold || false,
        italics: r.italics || false,
        size: r.size || 22,
        font: 'Calibri',
        color: r.color || '333333',
      })
    ),
  });
}

export function createTable(headers, rows) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(h =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: MONDE_GREEN },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20, font: 'Calibri' })],
          }),
        ],
        width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
      })
    ),
  });

  const dataRows = rows.map(row =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: String(cell), size: 20, font: 'Calibri', color: '333333' })],
            }),
          ],
          width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

export function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

export function spacer(lines = 1) {
  return new Paragraph({ spacing: { after: 200 * lines } });
}

export function coverPage(docTitle, subtitle, version, date) {
  return [
    spacer(4),
    title('MONDE', { size: 72 }),
    title('Digital Payment System', { size: 36, color: '666666' }),
    spacer(2),
    title(docTitle, { size: 40 }),
    subtitle ? title(subtitle, { size: 28, color: '666666' }) : spacer(),
    spacer(3),
    para(`Version: ${version}`, { alignment: AlignmentType.CENTER, color: '666666' }),
    para(`Date: ${date}`, { alignment: AlignmentType.CENTER, color: '666666' }),
    para('Classification: CONFIDENTIAL', { alignment: AlignmentType.CENTER, color: 'CC0000', bold: true }),
    spacer(2),
    para('Prepared for submission to the Bank of Zambia', { alignment: AlignmentType.CENTER, color: '666666', italics: true }),
    para('Payment Systems Department', { alignment: AlignmentType.CENTER, color: '666666', italics: true }),
    pageBreak(),
  ];
}

export function disclaimer() {
  return [
    heading('CONFIDENTIALITY NOTICE'),
    para('This document contains proprietary and confidential information belonging to Monde. The information contained herein is intended solely for the use of the Bank of Zambia in connection with the application for designation as a payment system under the National Payment Systems Act, 2007. Any reproduction, distribution, or disclosure of this document or its contents to any unauthorized party is strictly prohibited.'),
    spacer(),
  ];
}

export async function saveDoc(doc, filePath) {
  const buffer = await Packer.toBuffer(doc);
  writeFileSync(filePath, buffer);
  console.log(`✅ Created: ${filePath}`);
}

export function createDoc(sections) {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
            right: convertInchesToTwip(1),
          },
        },
      },
      children: sections,
    }],
  });
}

export const TODAY = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
