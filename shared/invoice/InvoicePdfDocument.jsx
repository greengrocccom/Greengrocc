import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "./amountInWords.js";
import {
  buildInvoiceLineItems,
  buildInvoiceTotals,
  formatInvoiceAmount,
  formatInvoiceDate,
  formatPlaceOfSupply,
  getInvoiceAdvancePaymentDetails,
  getPaymentModeLabel,
  getPaymentStatusLabel,
  mergeInvoiceConfig,
  STATUS_LABELS,
} from "./invoiceCalculations.js";
import { getInvoicePaymentRows, INVOICE_LOGO_URL, LOGO_URL } from "./invoiceConfig.js";
import { formatCustomerAddress, getAddressFullName, getOrderNumber } from "./invoiceHelpers.js";

const styles = StyleSheet.create({
  page: { padding: 16, fontSize: 9, color: "#111827" },
  header: { textAlign: "center", marginBottom: 8 },
  logo: { width: 200, height: 48, objectFit: "contain", marginHorizontal: "auto", marginBottom: 4 },
  meta: { marginTop: 2, fontSize: 8 },
  title: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    paddingTop: 5,
    marginBottom: 6,
  },
  block: { borderWidth: 1, borderColor: "#d1d5db", marginBottom: 6 },
  sectionBar: {
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    textAlign: "center",
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  infoRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  infoLabel: {
    width: "34%",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    padding: 4,
    fontWeight: 600,
  },
  infoValue: { width: "66%", padding: 4 },
  billTo: { padding: 6, lineHeight: 1.35 },
  billToName: { fontWeight: 700 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    backgroundColor: "#f8fafc",
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  cSrNo: { width: "7%", textAlign: "center", padding: 4 },
  cName: { width: "45%", textAlign: "left", padding: 4 },
  cQty: { width: "8%", textAlign: "center", padding: 4 },
  cRate: { width: "18%", textAlign: "right", padding: 4 },
  cAmount: { width: "22%", textAlign: "right", padding: 4 },
  headerText: { fontWeight: 700 },
  amountWords: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    padding: 6,
    lineHeight: 1.35,
  },
  footerWrap: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#d1d5db" },
  notes: { width: "68%", padding: 6, lineHeight: 1.35 },
  notesTitle: { fontWeight: 700, marginBottom: 4 },
  summary: { width: "32%", borderLeftWidth: 1, borderLeftColor: "#d1d5db" },
  summaryRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  summaryLabel: {
    width: "58%",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    padding: 4,
    fontWeight: 600,
  },
  summaryValue: { width: "42%", padding: 4, textAlign: "right" },
  totalRow: { backgroundColor: "#f8fafc" },
  totalText: { fontWeight: 700 },
});

function formatMoney(amount) {
  return `Rs. ${formatInvoiceAmount(amount)}`;
}

function SummaryRow({ label, value, highlight = false }) {
  return (
    <View style={[styles.summaryRow, highlight ? styles.totalRow : null]}>
      <Text style={[styles.summaryLabel, highlight ? styles.totalText : null]}>{label}</Text>
      <Text style={[styles.summaryValue, highlight ? styles.totalText : null]}>{value}</Text>
    </View>
  );
}

export default function InvoicePdfDocument({ order, customer, storeSettings, logoUrl }) {
  const config = mergeInvoiceConfig(storeSettings);
  const headerLogo = logoUrl || INVOICE_LOGO_URL || LOGO_URL;
  const orderNo = getOrderNumber(order);
  const invoiceNo = `INV-${orderNo}`;
  const addr = order?.deliveryAddress || {};
  const customerName = getAddressFullName(addr) || customer?.name || "-";
  const lineItems = buildInvoiceLineItems(order?.items || []);
  const totals = buildInvoiceTotals({
    lineItems,
    deliveryCharges: order?.deliveryCharges || 0,
    sellerState: config.stateName,
    customerState: addr?.state || "",
  });
  const grandTotal = order?.total ?? totals.grandTotal;
  const advancePayment = getInvoiceAdvancePaymentDetails(order);

  const metaRows = [
    ["Invoice No", invoiceNo],
    ["Order No", orderNo],
    ["Order Status", STATUS_LABELS[order?.status] || order?.status || "-"],
    ["Payment Mode", getPaymentModeLabel(order?.paymentMethod)],
    ["Place of Supply", formatPlaceOfSupply(addr?.state)],
    ["Invoice Date", formatInvoiceDate(new Date())],
    ["Order Date", formatInvoiceDate(order?.createdAt || new Date())],
    ["Payment Status", getPaymentStatusLabel(order?.paymentStatus)],
  ];

  const paymentRows = getInvoicePaymentRows(config);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {headerLogo ? <Image src={headerLogo} style={styles.logo} /> : null}
          <Text style={styles.meta}>{config.address}</Text>
          <Text style={styles.meta}>
            Phone: {config.phone} | Email: {config.email}
          </Text>
        </View>

        <Text style={styles.title}>TAX INVOICE</Text>

        <View style={styles.block}>
          <Text style={styles.sectionBar}>Invoice Detail</Text>
          {metaRows.map(([label, value], idx) => (
            <View key={label} style={[styles.infoRow, idx === metaRows.length - 1 ? { borderBottomWidth: 0 } : null]}>
              <Text style={styles.infoLabel}>{label}</Text>
              <Text style={styles.infoValue}>{String(value ?? "-")}</Text>
            </View>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionBar}>Bill To</Text>
          <View style={styles.billTo}>
            <Text style={styles.billToName}>{customerName}</Text>
            {addr?.shopName ? <Text>{addr.shopName}</Text> : null}
            {addr?.number ? <Text>{addr.number}</Text> : customer?.phone ? <Text>{customer.phone}</Text> : null}
            <Text>{formatCustomerAddress(addr)}</Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.sectionBar}>Order Detail</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.cSrNo, styles.headerText]}>Sr No</Text>
            <Text style={[styles.cName, styles.headerText]}>Product Name</Text>
            <Text style={[styles.cQty, styles.headerText]}>Qty</Text>
            <Text style={[styles.cRate, styles.headerText]}>Rate</Text>
            <Text style={[styles.cAmount, styles.headerText]}>Amount</Text>
          </View>
          {lineItems.map((item, idx) => (
            <View
              key={`${item.srNo}-${idx}`}
              style={[styles.tableRow, idx === lineItems.length - 1 ? { borderBottomWidth: 0 } : null]}
            >
              <Text style={styles.cSrNo}>{item.srNo}</Text>
              <Text style={styles.cName}>{item.name}</Text>
              <Text style={styles.cQty}>{item.qty}</Text>
              <Text style={styles.cRate}>{formatMoney(item.rate)}</Text>
              <Text style={styles.cAmount}>{formatMoney(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.amountWords}>Amount in Words: {amountInWords(grandTotal)}</Text>
          <View style={styles.footerWrap}>
            <View style={styles.notes}>
              <Text style={styles.notesTitle}>Sold By:</Text>
              <Text style={styles.billToName}>{config.companyName}</Text>
              <Text>{config.address}</Text>
              <Text>Phone: {config.phone}</Text>
              <Text>Email: {config.email}</Text>
              {paymentRows.length ? (
                <>
                  <Text style={[styles.notesTitle, { marginTop: 6 }]}>Payment Details:</Text>
                  {paymentRows.map(([label, value]) => (
                    <Text key={label}>
                      {label}: {value}
                    </Text>
                  ))}
                </>
              ) : null}
              <Text style={{ marginTop: 6 }}>
                For any queries about this order, call {config.phone} or email {config.email}.
              </Text>
              <Text style={{ marginTop: 4 }}>
                This is a computer generated invoice and does not require a signature. Thank you for
                shopping with {config.companyName}!
              </Text>
              {advancePayment.isAdvancePaid ? <Text style={{ marginTop: 6 }}>Remarks: {advancePayment.remark}</Text> : null}
            </View>

            <View style={styles.summary}>
              <SummaryRow label="Sub Total" value={formatMoney(totals.subTotal)} />
              {totals.gstBreakdown.map((row) => (
                <SummaryRow key={row.label} label={row.label} value={formatMoney(row.amount)} />
              ))}
              <SummaryRow
                label="Shipping Charges"
                value={totals.deliveryCharges === 0 ? "Free" : formatMoney(totals.deliveryCharges)}
              />
              <SummaryRow label="Total Amount" value={formatMoney(grandTotal)} highlight />
              {advancePayment.isAdvancePaid ? (
                <>
                  <SummaryRow label="Advance Paid (10%)" value={formatMoney(advancePayment.advancePaid)} />
                  <SummaryRow
                    label="Balance Due on Delivery"
                    value={formatMoney(advancePayment.remainingBalance)}
                    highlight
                  />
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
