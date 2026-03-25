type EventTicketReceiptInput = {
  eventId: string;
  eventTitle: string;
  payerName?: string;
  payerEmail?: string;
  amount: number;
  currency?: string;
  paidAt?: string;
  reference?: string;
};

type EnterpriseStandReceiptInput = {
  eventId: string;
  eventTitle: string;
  organizerName?: string;
  buyerName?: string;
  buyerEmail?: string;
  amount: number;
  paidAt?: string;
  paymentReference?: string;
  paymentMethodLabel?: string;
};

type MarketplaceUnifiedOrderReceiptItem = {
  product_name: string;
  product_type?: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency?: string;
};

type MarketplaceUnifiedOrderReceiptInput = {
  groupId: string;
  standName?: string;
  paymentMethod?: string;
  status?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  shippingAddress?: string;
  deliveryNotes?: string;
  createdAt?: string;
  paidAt?: string;
  items: MarketplaceUnifiedOrderReceiptItem[];
};

export async function downloadEventTicketReceiptPdf(input: EventTicketReceiptInput) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const { formatInTZ, getUserTimezone } = await import('@/lib/timezone');

  const paidAt = new Date(input.paidAt || new Date().toISOString());
  const amount = Number(input.amount || 0);
  const currency = (input.currency || 'MAD').toUpperCase();
  const reference = input.reference || 'N/A';
  const safeTitle = String(input.eventTitle || 'event').replaceAll(/\s+/g, '-').toLowerCase();

  const doc = new jsPDF();
  const receiptNo = `EVT-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, '0')}${String(paidAt.getDate()).padStart(2, '0')}-${String(input.eventId || '').slice(-6).toUpperCase()}`;

  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229);
  doc.text('EVENT TICKET RECEIPT', 14, 22);

  const paidAtStr = input.paidAt || new Date().toISOString();
  const tz = getUserTimezone();
  const displayDate = formatInTZ(paidAtStr, tz, 'MMMM d, yyyy');
  const displayTime = formatInTZ(paidAtStr, tz, 'hh:mm:ss a');

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Receipt #: ${receiptNo}`, 14, 32);
  doc.text(`Date: ${displayDate}`, 14, 38);
  doc.text(`Time: ${displayTime}`, 14, 44);
  doc.text('Status: PAID', 14, 50);

  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Intelligent Virtual Exhibition Platform', 122, 22);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Visitor Event Ticket', 122, 28);

  doc.setDrawColor(200);
  doc.line(14, 56, 196, 56);

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Payment Ref: ${reference}`, 14, 64);

  doc.setFont('helvetica', 'bold');
  doc.text('Buyer:', 14, 76);
  doc.setFont('helvetica', 'normal');
  doc.text(input.payerName || 'Visitor', 14, 82);
  if (input.payerEmail) doc.text(input.payerEmail, 14, 88);

  doc.setFont('helvetica', 'bold');
  doc.text('Event:', 122, 76);
  doc.setFont('helvetica', 'normal');
  doc.text(input.eventTitle || 'Event Ticket', 122, 82);

  autoTable(doc, {
    startY: 98,
    head: [['#', 'Description', 'Qty', 'Amount', 'Currency']],
    body: [[
      '1',
      `Ticket: ${input.eventTitle || 'Event'}`,
      '1',
      amount.toFixed(2),
      currency,
    ]],
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 24, halign: 'center' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 130;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${amount.toFixed(2)} ${currency}`, 196, finalY + 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text('Payment Method: Stripe (Online Card Payment)', 14, finalY + 14);

  doc.setFontSize(8);
  doc.setTextColor(160);
  doc.text('Thank you for your purchase!', 14, 280);
  doc.text('This is an automatically generated receipt.', 14, 285);

  doc.save(`event-ticket-receipt-${safeTitle}.pdf`);
}

export async function downloadEnterpriseStandFeeReceiptPdf(input: EnterpriseStandReceiptInput) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const { formatInTZ, getUserTimezone } = await import('@/lib/timezone');

  const paidAt = new Date(input.paidAt || new Date().toISOString());
  const amount = Number(input.amount || 0);
  const paymentMethod = input.paymentMethodLabel || 'Stripe (Online Card Payment)';
  const reference = input.paymentReference || 'N/A';
  const safeTitle = String(input.eventTitle || 'event').replaceAll(/\s+/g, '-').toLowerCase();

  const doc = new jsPDF();
  const invoiceNo = `ENT-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, '0')}${String(paidAt.getDate()).padStart(2, '0')}-${String(input.eventId || '').slice(-6).toUpperCase()}`;

  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229);
  doc.text('STAND FEE RECEIPT', 14, 22);

  const paidAtStr = input.paidAt || new Date().toISOString();
  const tz = getUserTimezone();
  const displayDate = formatInTZ(paidAtStr, tz, 'MMMM d, yyyy');
  const displayTime = formatInTZ(paidAtStr, tz, 'hh:mm:ss a');

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Invoice #: ${invoiceNo}`, 14, 32);
  doc.text(`Date: ${displayDate}`, 14, 38);
  doc.text(`Time: ${displayTime}`, 14, 44);
  doc.text('Status: PAID', 14, 50);

  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Intelligent Virtual Exhibition Platform', 122, 22);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Enterprise Stand Participation', 122, 28);

  doc.setDrawColor(200);
  doc.line(14, 56, 196, 56);

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Payment Ref: ${reference}`, 14, 64);

  doc.setFont('helvetica', 'bold');
  doc.text('Buyer:', 14, 76);
  doc.setFont('helvetica', 'normal');
  doc.text(input.buyerName || 'Enterprise', 14, 82);
  if (input.buyerEmail) doc.text(input.buyerEmail, 14, 88);

  doc.setFont('helvetica', 'bold');
  doc.text('Seller:', 122, 76);
  doc.setFont('helvetica', 'normal');
  doc.text('Intelligent Virtual Exhibition Platform', 122, 82);
  if (input.organizerName) doc.text(`Organizer: ${input.organizerName}`, 122, 88);

  autoTable(doc, {
    startY: 98,
    head: [['#', 'Description', 'Qty', 'Amount', 'Currency']],
    body: [[
      '1',
      `Stand Fee: ${input.eventTitle || 'Event'}`,
      '1',
      amount.toFixed(2),
      'MAD',
    ]],
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 24, halign: 'center' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 130;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${amount.toFixed(2)} MAD`, 196, finalY + 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Payment Method: ${paymentMethod}`, 14, finalY + 14);

  doc.setFontSize(8);
  doc.setTextColor(160);
  doc.text('Thank you for your payment!', 14, 280);
  doc.text('This is an automatically generated receipt.', 14, 285);

  doc.save(`stand-fee-receipt-${safeTitle}.pdf`);
}

export async function downloadMarketplaceUnifiedOrderReceiptPdf(input: MarketplaceUnifiedOrderReceiptInput) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const { formatInTZ, getUserTimezone } = await import('@/lib/timezone');

  const doc = new jsPDF();
  const createdAtIso = input.createdAt || new Date().toISOString();
  const paidAtIso = input.paidAt || createdAtIso;
  const tz = getUserTimezone();

  const currency = (input.items[0]?.currency || 'MAD').toUpperCase();
  const total = input.items.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const receiptNo = `MKT-${new Date(createdAtIso).getFullYear()}-${String(input.groupId || '').replaceAll(/[^a-zA-Z0-9]/g, '').slice(-10).toUpperCase()}`;

  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229);
  doc.text('MARKETPLACE RECEIPT', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Receipt #: ${receiptNo}`, 14, 32);
  doc.text(`Date: ${formatInTZ(createdAtIso, tz, 'MMMM d, yyyy')}`, 14, 38);
  doc.text(`Time: ${formatInTZ(createdAtIso, tz, 'hh:mm:ss a')}`, 14, 44);
  doc.text(`Status: ${(input.status || 'paid').toUpperCase()}`, 14, 50);

  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text('Intelligent Virtual Exhibition Platform', 112, 22);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Stand: ${input.standName || 'Enterprise Stand'}`, 112, 28);

  doc.setDrawColor(200);
  doc.line(14, 56, 196, 56);

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Order Group: ${input.groupId}`, 14, 64);
  doc.text(`Paid At: ${formatInTZ(paidAtIso, tz, 'MMMM d, yyyy hh:mm a')}`, 14, 70);

  doc.setFont('helvetica', 'bold');
  doc.text('Buyer:', 14, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(input.buyerName || 'Visitor', 14, 86);
  if (input.buyerEmail) doc.text(input.buyerEmail, 14, 92);
  if (input.buyerPhone) doc.text(`Phone: ${input.buyerPhone}`, 14, 98);

  doc.setFont('helvetica', 'bold');
  doc.text('Delivery:', 112, 80);
  doc.setFont('helvetica', 'normal');
  doc.text(input.shippingAddress || 'Not provided', 112, 86);
  if (input.deliveryNotes) doc.text(`Notes: ${input.deliveryNotes}`, 112, 92);

  const rows = input.items.map((item, index) => {
    const isService = String(item.product_type || 'product') === 'service';
    return [
      String(index + 1),
      item.product_name,
      isService ? 'Service' : 'Product',
      isService ? '—' : String(item.quantity || 1),
      `${Number(item.unit_price || 0).toFixed(2)} ${currency}`,
      `${Number(item.total_amount || 0).toFixed(2)} ${currency}`,
    ];
  });

  autoTable(doc, {
    startY: 106,
    head: [['#', 'Item', 'Type', 'Qty', 'Unit Price', 'Subtotal']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 34, halign: 'right' },
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.setFont('helvetica', 'bold');
  doc.text(`Grand Total: ${total.toFixed(2)} ${currency}`, 196, finalY + 14, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Payment Method: ${input.paymentMethod === 'cash_on_delivery' ? 'Pay on Reception (COD)' : 'Stripe'}`, 14, finalY + 14);

  doc.setFontSize(8);
  doc.setTextColor(160);
  doc.text('This is an automatically generated receipt.', 14, 285);

  doc.save(`marketplace-receipt-${String(input.groupId).replaceAll(/[^a-zA-Z0-9-]/g, '').slice(-18)}.pdf`);
}
