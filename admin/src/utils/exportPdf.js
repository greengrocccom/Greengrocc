import React from 'react';
import { Document, Page, Text, View, Font, StyleSheet, pdf } from '@react-pdf/renderer';
import { exportColumns } from './exportData.js';

const h = React.createElement;
const styles = StyleSheet.create({
  page: { padding: '92 30 44 30', fontFamily: 'ExportSans', fontSize: 9, color: '#20352a' },
  header: { position: 'absolute', top: 24, left: 30, right: 30, borderBottomWidth: 2, borderBottomColor: '#217346', paddingBottom: 10 },
  brand: { fontSize: 10, color: '#217346', marginBottom: 4 },
  title: { fontSize: 17, marginBottom: 4 },
  meta: { fontSize: 8, color: '#64746b' },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 8, color: '#64746b', flexDirection: 'row', justifyContent: 'space-between' },
  tableHead: { flexDirection: 'row', backgroundColor: '#217346', color: '#ffffff' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#dce6df' },
  cell: { flex: 1, padding: 7 },
  number: { width: 30, padding: 7, fontSize: 8, color: '#718078' },
  recordTitle: { backgroundColor: '#e9f2ec', color: '#217346', padding: 7, marginTop: 10, marginBottom: 3, fontSize: 10 },
  detail: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 0.4, borderBottomColor: '#e3eae6' },
  label: { width: '30%', paddingRight: 12, color: '#53685b' },
  value: { width: '70%', lineHeight: 1.5 },
});

function rich(value, style, key) {
  const parts = String(value ?? '').split(/([\u0900-\u097f\u200c\u200d]+)/u);
  return h(Text, { style, key }, ...parts.map((part, index) => h(Text, { key: index, style: /[\u0900-\u097f]/u.test(part) ? { fontFamily: 'ExportDevanagari' } : undefined }, part)));
}

export function createExportDocument({ title, sections, scope = 'Saved records', generatedAt = new Date() }) {
  const timestamp = generatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  return h(Document, { title: `GreenGrocc - ${title}`, author: 'GreenGrocc', subject: scope },
    ...sections.map((section, sectionIndex) => {
      const columns = exportColumns(section.rows);
      const detailLayout = columns.length > 6 || section.rows.some(row => Object.values(row).some(value => String(value ?? '').length > 160));
      return h(Page, { size: 'A4', orientation: !detailLayout && columns.length > 4 ? 'landscape' : 'portrait', style: styles.page, key: sectionIndex },
        h(View, { fixed: true, style: styles.header }, rich('GreenGrocc | Admin report', styles.brand), rich(`${title} - ${section.title}`, styles.title), rich(`${section.rows.length} records | ${scope} | ${timestamp} IST`, styles.meta)),
        detailLayout
          ? section.rows.map((row, index) => h(View, { key: index },
              h(View, { minPresenceAhead: 35 }, rich(`Record ${index + 1}`, styles.recordTitle)),
              ...columns.filter(column => row[column] !== '' && row[column] != null).map(column => h(View, { key: column, style: styles.detail }, rich(column, styles.label), rich(row[column], styles.value)))))
          : h(View, null,
              h(View, { style: styles.tableHead, fixed: true }, rich('#', { ...styles.number, color: '#ffffff' }), ...columns.map(column => rich(column, styles.cell, column))),
              ...section.rows.map((row, index) => h(View, { key: index, style: { ...styles.tableRow, backgroundColor: index % 2 ? '#f4f8f5' : '#ffffff' }, wrap: false }, rich(index + 1, styles.number), ...columns.map(column => rich(row[column] || '-', styles.cell, column))))),
        h(View, { fixed: true, style: styles.footer }, rich('GreenGrocc | Exported admin data'), h(Text, { render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}` })));
    }));
}

export async function createPdfBlob(report, fonts = { sans: '/fonts/NotoSans-Regular.ttf', devanagari: '/fonts/NotoSansDevanagari-Regular.ttf' }) {
  Font.register({ family: 'ExportSans', src: fonts.sans });
  Font.register({ family: 'ExportDevanagari', src: fonts.devanagari });
  Font.registerHyphenationCallback(word => [word]);
  return pdf(createExportDocument(report)).toBlob();
}
