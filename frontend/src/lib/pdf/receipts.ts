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

export async function downloadEventTicketReceiptPdf(input: EventTicketReceiptInput) {
  const { default: jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const paidAt = new Date(input.paidAt || new Date().toISOString());
  const amount = Number(input.amount || 0);
  const currency = (input.currency || 'MAD').toUpperCase();
  const reference = input.reference || 'N/A';
  const safeTitle = String(input.eventTitle || 'event').replace(/\s+/g, '-').toLowerCase();

  const doc = new jsPDF();
  const receiptNo = `EVT-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, '0')}${String(paidAt.getDate()).padStart(2, '0')}-${String(input.eventId || '').slice(-6).toUpperCase()}`;

  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229);
  doc.text('EVENT TICKET RECEIPT', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Receipt #: ${receiptNo}`, 14, 32);
  doc.text(`Date: ${paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 38);
  doc.text(`Time: ${paidAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 14, 44);
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

  const paidAt = new Date(input.paidAt || new Date().toISOString());
  const amount = Number(input.amount || 0);
  const paymentMethod = input.paymentMethodLabel || 'Stripe (Online Card Payment)';
  const reference = input.paymentReference || 'N/A';
  const safeTitle = String(input.eventTitle || 'event').replace(/\s+/g, '-').toLowerCase();

  const doc = new jsPDF();
  const invoiceNo = `ENT-${paidAt.getFullYear()}${String(paidAt.getMonth() + 1).padStart(2, '0')}${String(paidAt.getDate()).padStart(2, '0')}-${String(input.eventId || '').slice(-6).toUpperCase()}`;

  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229);
  doc.text('STAND FEE RECEIPT', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Invoice #: ${invoiceNo}`, 14, 32);
  doc.text(`Date: ${paidAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 38);
  doc.text(`Time: ${paidAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`, 14, 44);
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
