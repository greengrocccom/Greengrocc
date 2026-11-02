import React from 'react';
import { Gift } from 'lucide-react';
import AdminModulePage from '../../components/ops/AdminModulePage';

export default function GiftCards() {
  return (
    <AdminModulePage
      title="Gift Cards"
      description="Issue, disable, and track store gift cards."
      icon={Gift}
      path="gift-cards"
      createLabel="Issue gift card"
      searchKeys={['code', 'issuedToName', 'issuedToPhone', 'status']}
      statusFilters={['active', 'redeemed', 'disabled', 'expired']}
      columns={[
        { key: 'code', label: 'Code' },
        { key: 'amount', label: 'Value', render: (row) => `₹${row.amount}` },
        { key: 'balance', label: 'Balance', render: (row) => `₹${row.balance}` },
        { key: 'issuedToName', label: 'Issued to' },
        { key: 'status', label: 'Status' },
      ]}
      defaults={{ amount: 500, issuedToName: '', issuedToPhone: '', note: '', expiresAt: '', status: 'active' }}
      fields={[
        { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
        { name: 'issuedToName', label: 'Customer name' },
        { name: 'issuedToPhone', label: 'Phone' },
        { name: 'expiresAt', label: 'Expires on', type: 'date' },
        { name: 'note', label: 'Note', type: 'textarea' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
            { value: 'disabled', label: 'Disabled' },
            { value: 'redeemed', label: 'Redeemed' },
          ],
        },
      ]}
    />
  );
}
