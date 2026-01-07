interface ParticipantHour {
  date: string;
  hours: number;
  description: string;
  legal_area: string;
  teilnehmer: {
    name: string;
  };
}

interface DozentHour {
  date: string;
  hours: number;
  description: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  total_amount: number;
  dozent: {
    full_name: string;
    email: string;
    phone: string;
    tax_id: string;
    bank_name: string;
    iban: string;
    bic: string;
    street?: string;
    house_number?: string;
    postal_code?: string;
    city?: string;
  };
}

interface InvoicePDFData {
  invoice: Invoice;
  participantHours: ParticipantHour[];
  dozentHours: DozentHour[];
}

export const generateInvoicePDF = async (data: InvoicePDFData) => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = margin;
  
  // Helper function to check if we need a new page
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 30) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // Helper function to add text with proper encoding
  const addText = (text: string, x: number, y: number, options?: any) => {
    const cleanText = text.replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F]/g, '');
    doc.text(cleanText, x, y, options);
  };

  // Helper function to add text with automatic line wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 4) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string, index: number) => {
      addText(line, x, y + (index * lineHeight));
    });
    return y + (lines.length * lineHeight);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getMonthName = (month: number) => {
    return new Date(2023, month - 1).toLocaleDateString('de-DE', { month: 'long' });
  };

  // Header with dozent info (left side)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText(data.invoice.dozent.full_name, margin, yPosition);
  yPosition += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Dozent address
  if (data.invoice.dozent.street && data.invoice.dozent.house_number) {
    addText(`${data.invoice.dozent.street} ${data.invoice.dozent.house_number}`, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.postal_code && data.invoice.dozent.city) {
    addText(`${data.invoice.dozent.postal_code} ${data.invoice.dozent.city}`, margin, yPosition);
    yPosition += 4;
  }
  
  // Contact info
  if (data.invoice.dozent.email) {
    addText(data.invoice.dozent.email, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.phone) {
    addText(data.invoice.dozent.phone, margin, yPosition);
    yPosition += 4;
  }
  
  if (data.invoice.dozent.tax_id) {
    addText(`Steuernummer: ${data.invoice.dozent.tax_id}`, margin, yPosition);
    yPosition += 6;
  } else {
    yPosition += 4;
  }

  // Recipient address
  yPosition += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  addText('Akademie Kraatz GmbH & Assessor Akademie Kraatz und Heinze GbR', margin, yPosition);
  yPosition += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
  yPosition += 4;
  addText('10585 Berlin', margin, yPosition);
  yPosition += 4;
  addText('Telefon: 030 756 573 97', margin, yPosition);
  yPosition += 4;
  addText('E-Mail: info@kraatz-group.de', margin, yPosition);
  yPosition += 12;

  // Invoice title and details
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  addText('Rechnung Erteilung Unterricht lt. Aufstellung', margin, yPosition);
  
  // Invoice number (right aligned)
  addText(`RE-Nr: ${data.invoice.invoice_number}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Date (right aligned, directly under invoice number)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addText(`Datum: ${formatDate(new Date().toISOString())}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Period
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const periodText = `Leistungszeitraum: ${formatDate(data.invoice.period_start)} - ${formatDate(data.invoice.period_end)}`;
  addText(periodText, margin, yPosition);
  yPosition += 12;

  // Greeting
  doc.setFontSize(11);
  addText('Sehr geehrter Herr Kraatz,', margin, yPosition);
  yPosition += 10;

  // Main text
  const mainText = [
    'entsprechend unserer Vereinbarung erlaube ich mir meine Leistungen in Ihrem',
    'Auftrag in Rechnung zu stellen. Ich bedanke mich für die gute Zusammenarbeit.',
    'Die Leistungsübersicht lege ich Ihnen als Anlage bei.'
  ];

  const fullMainText = mainText.join(' ');
  yPosition = addWrappedText(fullMainText, margin, yPosition, contentWidth, 4);
  yPosition += 10;

  // Hours breakdown table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText('Leistungsübersicht:', margin, yPosition);
  yPosition += 10;

  // Calculate totals
  const totalParticipantHours = data.participantHours.reduce((sum, h) => sum + h.hours, 0);
  const totalDozentHours = data.dozentHours.reduce((sum, h) => sum + h.hours, 0);
  const totalHours = totalParticipantHours + totalDozentHours;

  // Simple hours summary
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  if (totalParticipantHours > 0) {
    addText(`Unterrichtsstunden: ${totalParticipantHours.toFixed(2)} Stunden`, margin, yPosition);
    yPosition += 5;
  }
  
  if (totalDozentHours > 0) {
    addText(`Sonstige Tätigkeiten: ${totalDozentHours.toFixed(2)} Stunden`, margin, yPosition);
    yPosition += 5;
  }

  yPosition += 6;

  // Total amount
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText(`Gesamt: ${totalHours.toFixed(2)} Stunden`, margin, yPosition);
  yPosition += 15;

  // Tax notice
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeText = 'Auf den Ausweis der Umsatzsteuer wurde verzichtet, da von der Befreiung nach § 4 Nr. 21 b Doppelbuchstabe b UStG Gebrauch gemacht wurde. Am Abrechnungstag ggf. noch nicht vorliegende Belege rechne ich mit der folgenden Abrechnung ab.';
  yPosition = addWrappedText(taxNoticeText, margin, yPosition, contentWidth, 3.5);
  yPosition += 6;

  // Bank details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const bankRequestText = 'Ich bitte, den entsprechenden Betrag, basierend auf den vereinbarten Stundensätzen, auf mein nachfolgendes Konto zu überweisen:';
  yPosition = addWrappedText(bankRequestText, margin, yPosition, contentWidth, 4);
  yPosition += 6;

  if (data.invoice.dozent.bank_name) {
    addText(`Bank: ${data.invoice.dozent.bank_name}`, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.iban) {
    addText(`IBAN: ${data.invoice.dozent.iban}`, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.bic) {
    addText(`BIC: ${data.invoice.dozent.bic}`, margin, yPosition);
    yPosition += 4;
  }
  addText(`Kontoinhaber: ${data.invoice.dozent.full_name}`, margin, yPosition);
  yPosition += 10;

  // Closing
  addText('Vielen Dank!', margin, yPosition);
  yPosition += 8;
  addText('Mit freundlichen Grüßen', margin, yPosition);
  yPosition += 12;
  addText(data.invoice.dozent.full_name, margin, yPosition);

  // Footer
  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    addText(`Seite ${pageNum} von ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  };

  // Add footer to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }

  // Generate filename
  const monthName = getMonthName(data.invoice.month);
  const filename = `Rechnung_${data.invoice.invoice_number}_${monthName}_${data.invoice.year}_${data.invoice.dozent.full_name.replace(/\s+/g, '_')}.pdf`;

  // Save the PDF
  doc.save(filename);
};

// Generate PDF as Blob for preview
export const generateInvoicePDFBlob = async (data: InvoicePDFData): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = margin;
  
  // Helper function to check if we need a new page
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 30) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // Helper function to add text with proper encoding
  const addText = (text: string, x: number, y: number, options?: any) => {
    const cleanText = text.replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F]/g, '');
    doc.text(cleanText, x, y, options);
  };

  // Helper function to add text with automatic line wrapping
  const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 4) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string, index: number) => {
      addText(line, x, y + (index * lineHeight));
    });
    return y + (lines.length * lineHeight);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getMonthName = (month: number) => {
    const months = ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return months[month - 1];
  };

  // Header - Dozent info
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  addText(data.invoice.dozent.full_name, margin, yPosition);
  yPosition += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Dozent address
  if (data.invoice.dozent.street && data.invoice.dozent.house_number) {
    addText(`${data.invoice.dozent.street} ${data.invoice.dozent.house_number}`, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.postal_code && data.invoice.dozent.city) {
    addText(`${data.invoice.dozent.postal_code} ${data.invoice.dozent.city}`, margin, yPosition);
    yPosition += 4;
  }
  
  // Contact info
  if (data.invoice.dozent.email) {
    addText(data.invoice.dozent.email, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.phone) {
    addText(data.invoice.dozent.phone, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.tax_id) {
    addText(`Steuernummer: ${data.invoice.dozent.tax_id}`, margin, yPosition);
    yPosition += 4;
  }
  yPosition += 8;

  // Recipient
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  addText('Akademie Kraatz GmbH & Assessor Akademie Kraatz und Heinze GbR', margin, yPosition);
  yPosition += 4;
  doc.setFont('helvetica', 'normal');
  addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
  yPosition += 4;
  addText('10585 Berlin', margin, yPosition);
  yPosition += 4;
  addText('Telefon: 030 756 573 97', margin, yPosition);
  yPosition += 4;
  addText('E-Mail: info@kraatz-group.de', margin, yPosition);
  yPosition += 12;

  // Date
  addText(`Berlin, den ${formatDate(new Date().toISOString())}`, pageWidth - margin - 50, yPosition);
  yPosition += 15;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const monthName = getMonthName(data.invoice.month);
  addText(`Abrechnung ${monthName} ${data.invoice.year}`, margin, yPosition);
  yPosition += 6;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addText(`Rechnungsnummer: ${data.invoice.invoice_number}`, margin, yPosition);
  yPosition += 10;

  // Period
  addText(`Abrechnungszeitraum: ${formatDate(data.invoice.period_start)} - ${formatDate(data.invoice.period_end)}`, margin, yPosition);
  yPosition += 10;

  // Hours table header
  checkPageBreak(40);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 3, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  addText('Datum', margin + 2, yPosition + 2);
  addText('Teilnehmer', margin + 25, yPosition + 2);
  addText('Beschreibung', margin + 70, yPosition + 2);
  addText('Stunden', pageWidth - margin - 15, yPosition + 2, { align: 'right' });
  yPosition += 10;

  // Hours entries
  doc.setFont('helvetica', 'normal');
  let totalHours = 0;

  // Participant hours
  if (data.participantHours && data.participantHours.length > 0) {
    for (const entry of data.participantHours) {
      checkPageBreak(8);
      doc.setFontSize(8);
      addText(formatDate(entry.date), margin + 2, yPosition);
      const teilnehmerName = entry.teilnehmer?.name || '-';
      addText(teilnehmerName.substring(0, 20), margin + 25, yPosition);
      const desc = (entry.description || '-').substring(0, 35);
      addText(desc, margin + 70, yPosition);
      addText(entry.hours.toString(), pageWidth - margin - 15, yPosition, { align: 'right' });
      totalHours += entry.hours;
      yPosition += 5;
    }
  }

  // Dozent hours
  if (data.dozentHours && data.dozentHours.length > 0) {
    for (const entry of data.dozentHours) {
      checkPageBreak(8);
      doc.setFontSize(8);
      addText(formatDate(entry.date), margin + 2, yPosition);
      addText('Eigenarbeit', margin + 25, yPosition);
      const desc = (entry.description || '-').substring(0, 35);
      addText(desc, margin + 70, yPosition);
      addText(entry.hours.toString(), pageWidth - margin - 15, yPosition, { align: 'right' });
      totalHours += entry.hours;
      yPosition += 5;
    }
  }

  // Total
  yPosition += 3;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  addText('Gesamt:', margin + 2, yPosition);
  addText(`${totalHours} Stunden`, pageWidth - margin - 15, yPosition, { align: 'right' });
  yPosition += 10;

  // Amount
  if (data.invoice.total_amount > 0) {
    doc.setFontSize(12);
    addText(`Rechnungsbetrag: ${data.invoice.total_amount.toFixed(2)} EUR`, margin, yPosition);
    yPosition += 10;
  }

  // Footer
  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    addText(`Seite ${pageNum} von ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  };

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }

  // Return as Blob
  return doc.output('blob');
};