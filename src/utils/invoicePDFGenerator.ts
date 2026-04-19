interface ParticipantHour {
  date: string;
  hours: number;
  description: string;
  legal_area: string;
  teilnehmer: {
    name: string;
    elite_kleingruppe?: boolean;
  };
}

interface DozentHour {
  date: string;
  hours: number;
  description: string;
  category?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  total_amount: number;
  exam_type?: string;
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
    hourly_rate_unterricht?: number;
    hourly_rate_elite?: number;
    hourly_rate_elite_korrektur?: number;
    hourly_rate_sonstige?: number;
  };
}

interface InvoicePDFData {
  invoice: Invoice;
  participantHours: ParticipantHour[];
  dozentHours: DozentHour[];
}

export const generateInvoicePDF = async (data: InvoicePDFData) => {
  console.log('🎯 generateInvoicePDF called with exam_type:', data.invoice.exam_type);
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
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
    // Convert ae, ue, oe, ss to ä, ü, ö, ß
    const convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/ss/g, 'ß')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö')
      .replace(/SS/g, 'ß');
    doc.text(convertedText, x, y, options);
  };

  // Helper function to format numbers in German format
  const formatNumber = (num: number) => {
    const parts = num.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]).toLocaleString('de-DE');
    const decimalPart = parts[1];
    return `${integerPart},${decimalPart}`;
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

  // Recipient address - different based on exam type
  yPosition += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  
  console.log('PDF Generation - Invoice exam_type:', data.invoice.exam_type);
  
  if (data.invoice.exam_type === '2. Staatsexamen') {
    // 2. Staatsexamen -> Assessor Akademie Kraatz und Heinze GbR
    console.log('Using 2. Staatsexamen recipient: Assessor Akademie Kraatz und Heinze GbR');
    addText('Assessor Akademie Kraatz und Heinze GbR', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  } else {
    // 1. Staatsexamen (or no exam_type) -> Akademie Kraatz GmbH
    console.log('Using 1. Staatsexamen recipient: Akademie Kraatz GmbH');
    addText('Akademie Kraatz GmbH', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  }

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

  // Calculate totals per category
  const regularHours = data.participantHours.filter(h => !h.teilnehmer?.elite_kleingruppe);
  const eliteParticipantHours = data.participantHours.filter(h => h.teilnehmer?.elite_kleingruppe);
  const eliteUnterrichtHours = data.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
  const eliteKorrekturHours = data.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
  const sonstigeHours = data.dozentHours.filter(h => !h.category || !h.category.toLowerCase().includes('elite'));

  const totalRegular = regularHours.reduce((sum, h) => sum + h.hours, 0);
  const totalElite = eliteParticipantHours.reduce((sum, h) => sum + h.hours, 0) + eliteUnterrichtHours.reduce((sum, h) => sum + h.hours, 0);
  const totalEliteKorrektur = eliteKorrekturHours.reduce((sum, h) => sum + h.hours, 0);
  const totalSonstige = sonstigeHours.reduce((sum, h) => sum + h.hours, 0);
  const totalHours = totalRegular + totalElite + totalEliteKorrektur + totalSonstige;

  const rateUnterricht = data.invoice.dozent.hourly_rate_unterricht || 0;
  const rateElite = data.invoice.dozent.hourly_rate_elite || 0;
  const rateEliteKorrektur = data.invoice.dozent.hourly_rate_elite_korrektur || 0;
  const rateSonstige = data.invoice.dozent.hourly_rate_sonstige || 0;

  const amountRegular = totalRegular * rateUnterricht;
  const amountElite = totalElite * rateElite;
  const amountEliteKorrektur = totalEliteKorrektur * rateEliteKorrektur;
  const amountSonstige = totalSonstige * rateSonstige;
  const totalAmount = amountRegular + amountElite + amountEliteKorrektur + amountSonstige;

  // Summary table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 3, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  addText('Leistung', margin + 2, yPosition + 1);
  addText('Stunden', margin + 90, yPosition + 1);
  addText('Satz', margin + 120, yPosition + 1);
  addText('Betrag', pageWidth - margin - 2, yPosition + 1, { align: 'right' });
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (totalRegular > 0) {
    addText('Unterrichtsstunden', margin + 2, yPosition);
    addText(`${formatNumber(totalRegular)} Std.`, margin + 90, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(rateUnterricht)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(amountRegular)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalElite > 0) {
    addText('Elite-Kleingruppe Unterricht', margin + 2, yPosition);
    addText(`${formatNumber(totalElite)} Std.`, margin + 90, yPosition);
    addText(rateElite > 0 ? `${formatNumber(rateElite)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateElite > 0 ? `${formatNumber(amountElite)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalEliteKorrektur > 0) {
    addText('Elite-Kleingruppe Korrektur', margin + 2, yPosition);
    addText(`${formatNumber(totalEliteKorrektur)} Std.`, margin + 90, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(rateEliteKorrektur)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(amountEliteKorrektur)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalSonstige > 0) {
    addText('Sonstige Taetigkeiten', margin + 2, yPosition);
    addText(`${formatNumber(totalSonstige)} Std.`, margin + 90, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(amountSonstige)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  // Total line
  yPosition += 2;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  addText(`Gesamt: ${formatNumber(totalHours)} Stunden`, margin, yPosition);
  if (totalAmount > 0) {
    addText(`${formatNumber(totalAmount)} \u20ac`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }
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

  // Generate filename: invoice_number_month_year_dozent_name.pdf
  const monthName = getMonthName(data.invoice.month);
  const filename = `${data.invoice.invoice_number}_${monthName}_${data.invoice.year}_${data.invoice.dozent.full_name.replace(/\s+/g, '_')}.pdf`;

  // Save the PDF
  doc.save(filename);
};

// Generate PDF as Blob for preview
export const generateInvoicePDFBlob = async (data: InvoicePDFData): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
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
    // Convert ae, ue, oe, ss to ä, ü, ö, ß
    const convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/ss/g, 'ß')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö')
      .replace(/SS/g, 'ß');
    doc.text(convertedText, x, y, options);
  };

  // Helper function to format numbers in German format
  const formatNumber = (num: number) => {
    const parts = num.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]).toLocaleString('de-DE');
    const decimalPart = parts[1];
    return `${integerPart},${decimalPart}`;
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

  // Header - Dozent info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText(data.invoice.dozent.full_name, margin, yPosition);
  yPosition += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Address (street, house_number, postal_code, city)
  if (data.invoice.dozent.street && data.invoice.dozent.house_number) {
    addText(`${data.invoice.dozent.street} ${data.invoice.dozent.house_number}`, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.postal_code && data.invoice.dozent.city) {
    addText(`${data.invoice.dozent.postal_code} ${data.invoice.dozent.city}`, margin, yPosition);
    yPosition += 6;
  }
  
  // Contact info (email, phone)
  if (data.invoice.dozent.email) {
    addText(data.invoice.dozent.email, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.phone) {
    addText(data.invoice.dozent.phone, margin, yPosition);
    yPosition += 4;
  }
  yPosition += 6;

  // Recipient - different based on exam type
  console.log('🎯 generateInvoicePDFBlob called with exam_type:', data.invoice.exam_type);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  
  if (data.invoice.exam_type === '2. Staatsexamen') {
    // 2. Staatsexamen -> Assessor Akademie Kraatz und Heinze GbR
    console.log('Using 2. Staatsexamen recipient: Assessor Akademie Kraatz und Heinze GbR');
    addText('Assessor Akademie Kraatz und Heinze GbR', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  } else {
    // 1. Staatsexamen (or no exam_type) -> Akademie Kraatz GmbH
    console.log('Using 1. Staatsexamen recipient: Akademie Kraatz GmbH');
    addText('Akademie Kraatz GmbH', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  }

  // Invoice title and details
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  addText('Rechnung Erteilung Unterricht lt. Aufstellung', margin, yPosition);
  
  // Invoice number (right aligned)
  addText(`RE-Nr: ${data.invoice.invoice_number}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Date (right aligned)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addText(`Datum: ${formatDate(new Date().toISOString())}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Period
  const periodText = `Leistungszeitraum: ${formatDate(data.invoice.period_start)} - ${formatDate(data.invoice.period_end)}`;
  addText(periodText, margin, yPosition);
  yPosition += 12;

  // Greeting
  doc.setFontSize(11);
  addText('Sehr geehrter Herr Kraatz,', margin, yPosition);
  yPosition += 10;

  // Main text
  const mainText = 'entsprechend unserer Vereinbarung erlaube ich mir meine Leistungen in Ihrem Auftrag in Rechnung zu stellen. Ich bedanke mich fuer die gute Zusammenarbeit. Die Leistungsuebersicht lege ich Ihnen als Anlage bei.';
  yPosition = addWrappedText(mainText, margin, yPosition, contentWidth, 4);
  yPosition += 10;

  // Leistungsübersicht header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText('Leistungsuebersicht:', margin, yPosition);
  yPosition += 8;

  // Hours table header
  checkPageBreak(40);
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 3, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  addText('Datum', margin + 2, yPosition + 2);
  addText('Typ', margin + 25, yPosition + 2);
  addText('Beschreibung', margin + 70, yPosition + 2);
  addText('Stunden', pageWidth - margin - 2, yPosition + 2, { align: 'right' });
  yPosition += 10;

  // Hours entries
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  let totalParticipantHours = 0;
  let totalDozentHours = 0;

  // Participant hours
  if (data.participantHours && data.participantHours.length > 0) {
    const sortedParticipantHours = [...data.participantHours].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const entry of sortedParticipantHours) {
      checkPageBreak(8);
      doc.setFontSize(8);
      addText(formatDate(entry.date), margin + 2, yPosition);
      addText('Einzelunterricht', margin + 25, yPosition);
      const desc = `${entry.legal_area || '-'} - ${entry.teilnehmer?.name || '-'} - ${entry.description || '-'}`.substring(0, 60);
      addText(desc, margin + 70, yPosition);
      addText(entry.hours.toString(), pageWidth - margin - 2, yPosition, { align: 'right' });
      totalParticipantHours += entry.hours;
      yPosition += 5;
    }
  }

  // Dozent hours
  if (data.dozentHours && data.dozentHours.length > 0) {
    const sortedDozentHours = [...data.dozentHours].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    for (const entry of sortedDozentHours) {
      checkPageBreak(8);
      doc.setFontSize(8);
      addText(formatDate(entry.date), margin + 2, yPosition);
      const type = entry.category === 'Elite-Kleingruppe Korrektur' || entry.category?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe' : entry.category || 'Sonstige Tätigkeit';
      addText(type, margin + 25, yPosition);
      const descYPosition = yPosition;
      let extraLines = 0;
      if (entry.category === 'Elite-Kleingruppe Korrektur') {
        yPosition += 4;
        addText('Klausurenkorrektur', margin + 25, yPosition);
        extraLines = 1;
      }
      const desc = (entry.description?.startsWith('Klausurkorrektur:') && (entry.category === 'Elite-Kleingruppe Korrektur' || entry.description?.includes('Elite-Kleingruppe')) ? entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim() : entry.description || '-');
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        lines.forEach((line: string, index: number) => {
          addText(line.substring(0, 80), margin + 70, descYPosition + (index * 4));
        });
        extraLines = Math.max(extraLines, lines.length - 1);
      } else {
        addText(desc.substring(0, 80), margin + 70, descYPosition);
      }
      addText(entry.hours.toString(), pageWidth - margin - 2, descYPosition, { align: 'right' });
      totalDozentHours += entry.hours;
      yPosition += 5 + (extraLines * 4);
    }
  }

  // Total line
  yPosition += 3;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  // Calculate totals per category
  const regularHours = data.participantHours.filter(h => !h.teilnehmer?.elite_kleingruppe);
  const eliteParticipantHours2 = data.participantHours.filter(h => h.teilnehmer?.elite_kleingruppe);
  const eliteUnterrichtHours2 = data.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
  const eliteKorrekturHours2 = data.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
  const sonstigeHours2 = data.dozentHours.filter(h => !h.category || !h.category.toLowerCase().includes('elite'));

  const totalRegular = regularHours.reduce((sum, h) => sum + h.hours, 0);
  const totalElite = eliteParticipantHours2.reduce((sum, h) => sum + h.hours, 0) + eliteUnterrichtHours2.reduce((sum, h) => sum + h.hours, 0);
  const totalEliteKorrektur = eliteKorrekturHours2.reduce((sum, h) => sum + h.hours, 0);
  const totalSonstige = sonstigeHours2.reduce((sum, h) => sum + h.hours, 0);
  const totalHours = totalRegular + totalElite + totalEliteKorrektur + totalSonstige;

  const rateUnterricht = data.invoice.dozent.hourly_rate_unterricht || 0;
  const rateElite = data.invoice.dozent.hourly_rate_elite || 0;
  const rateEliteKorrektur = data.invoice.dozent.hourly_rate_elite_korrektur || 0;
  const rateSonstige = data.invoice.dozent.hourly_rate_sonstige || 0;

  const amountRegular = totalRegular * rateUnterricht;
  const amountElite = totalElite * rateElite;
  const amountEliteKorrektur = totalEliteKorrektur * rateEliteKorrektur;
  const amountSonstige = totalSonstige * rateSonstige;
  const totalAmount = amountRegular + amountElite + amountEliteKorrektur + amountSonstige;

  // Summary table
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 3, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  addText('Leistung', margin + 2, yPosition + 1);
  addText('Stunden', margin + 90, yPosition + 1);
  addText('Satz', margin + 120, yPosition + 1);
  addText('Betrag', pageWidth - margin - 2, yPosition + 1, { align: 'right' });
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (totalRegular > 0) {
    addText('Unterrichtsstunden', margin + 2, yPosition);
    addText(`${formatNumber(totalRegular)} Std.`, margin + 90, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(rateUnterricht)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(amountRegular)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalElite > 0) {
    addText('Elite-Kleingruppe Unterricht', margin + 2, yPosition);
    addText(`${formatNumber(totalElite)} Std.`, margin + 90, yPosition);
    addText(rateElite > 0 ? `${formatNumber(rateElite)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateElite > 0 ? `${formatNumber(amountElite)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalEliteKorrektur > 0) {
    addText('Elite-Kleingruppe Korrektur', margin + 2, yPosition);
    addText(`${formatNumber(totalEliteKorrektur)} Std.`, margin + 90, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(rateEliteKorrektur)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(amountEliteKorrektur)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalSonstige > 0) {
    addText('Sonstige Taetigkeiten', margin + 2, yPosition);
    addText(`${formatNumber(totalSonstige)} Std.`, margin + 90, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} \u20ac` : '-', margin + 120, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(amountSonstige)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  // Total line
  yPosition += 2;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  addText(`Gesamt: ${formatNumber(totalHours)} Stunden`, margin, yPosition);
  if (totalAmount > 0) {
    addText(`${formatNumber(totalAmount)} \u20ac`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }
  yPosition += 15;

  // Tax notice
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeText = 'Auf den Ausweis der Umsatzsteuer wurde verzichtet, da von der Befreiung nach Paragraph 4 Nr. 21 b Doppelbuchstabe b UStG Gebrauch gemacht wurde. Am Abrechnungstag ggf. noch nicht vorliegende Belege rechne ich mit der folgenden Abrechnung ab.';
  yPosition = addWrappedText(taxNoticeText, margin, yPosition, contentWidth, 3.5);
  yPosition += 6;

  // Bank request
  doc.setFontSize(10);
  const bankRequestText = 'Ich bitte, den entsprechenden Betrag, basierend auf den vereinbarten Stundensaetzen, auf mein nachfolgendes Konto zu ueberweisen:';
  yPosition = addWrappedText(bankRequestText, margin, yPosition, contentWidth, 4);
  yPosition += 6;

  // Bank details
  addText(`Kontoinhaber: ${data.invoice.dozent.full_name}`, margin, yPosition);
  yPosition += 4;
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
  yPosition += 8;

  // Closing
  addText('Vielen Dank!', margin, yPosition);
  yPosition += 8;
  addText('Mit freundlichen Gruessen', margin, yPosition);
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

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }

  // Return as Blob
  return doc.output('blob');
};

interface MonthlyInvoiceData {
  month: number;
  year: number;
  period_start: string;
  period_end: string;
  participantHours: ParticipantHour[];
  dozentHours: DozentHour[];
  totalHours: number;
  totalAmount: number;
}

interface QuarterlyInvoiceData {
  invoice: Invoice;
  monthlyData: MonthlyInvoiceData[];
  quarter: number;
  quarterYear: number;
}

export const generateQuarterlyInvoicePDF = async (data: QuarterlyInvoiceData) => {
  console.log('🎯 generateQuarterlyInvoicePDF called with exam_type:', data.invoice.exam_type);
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = margin;
  let currentPage = 1;
  
  // Helper function to check if we need a new page
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 30) {
      doc.addPage();
      currentPage++;
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // Helper function to add text with proper encoding
  const addText = (text: string, x: number, y: number, options?: any) => {
    // Convert ae, ue, oe, ss to ä, ü, ö, ß
    const convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/ss/g, 'ß')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö')
      .replace(/SS/g, 'ß');
    doc.text(convertedText, x, y, options);
  };

  // Helper function to format numbers in German format
  const formatNumber = (num: number) => {
    const parts = num.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]).toLocaleString('de-DE');
    const decimalPart = parts[1];
    return `${integerPart},${decimalPart}`;
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

  const getQuarterName = (quarter: number) => {
    return `Q${quarter}`;
  };

  // Helper function to add footer
  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    addText(`Seite ${pageNum} von ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  };

  // ==================== COVER PAGE ====================
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

  // Recipient address - different based on exam type
  yPosition += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  
  console.log('PDF Generation - Invoice exam_type:', data.invoice.exam_type);
  
  if (data.invoice.exam_type === '2. Staatsexamen') {
    // 2. Staatsexamen -> Assessor Akademie Kraatz und Heinze GbR
    console.log('Using 2. Staatsexamen recipient: Assessor Akademie Kraatz und Heinze GbR');
    addText('Assessor Akademie Kraatz und Heinze GbR', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  } else {
    // 1. Staatsexamen (or no exam_type) -> Akademie Kraatz GmbH
    console.log('Using 1. Staatsexamen recipient: Akademie Kraatz GmbH');
    addText('Akademie Kraatz GmbH', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  }

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

  // Period - show quarter
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const monthsNames = data.monthlyData.map(m => getMonthName(m.month)).join(', ');
  const periodText = `Leistungszeitraum: ${getQuarterName(data.quarter)} ${data.quarterYear} (${monthsNames})`;
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
    'Die Leistungsübersicht für die einzelnen Monate lege ich Ihnen als Anlage bei.'
  ];

  const fullMainText = mainText.join(' ');
  yPosition = addWrappedText(fullMainText, margin, yPosition, contentWidth, 4);
  yPosition += 10;

  // Calculate totals across all months
  let totalRegular = 0;
  let totalElite = 0;
  let totalEliteKorrektur = 0;
  let totalSonstige = 0;
  let grandTotalHours = 0;
  let grandTotalAmount = 0;

  data.monthlyData.forEach(monthData => {
    const regularHours = monthData.participantHours.filter(h => !h.teilnehmer?.elite_kleingruppe);
    const eliteParticipantHours = monthData.participantHours.filter(h => h.teilnehmer?.elite_kleingruppe);
    const eliteUnterrichtHours = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
    const eliteKorrekturHours = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
    const sonstigeHours = monthData.dozentHours.filter(h => !h.category || !h.category.toLowerCase().includes('elite'));

    totalRegular += regularHours.reduce((sum, h) => sum + h.hours, 0);
    totalElite += eliteParticipantHours.reduce((sum, h) => sum + h.hours, 0) + eliteUnterrichtHours.reduce((sum, h) => sum + h.hours, 0);
    totalEliteKorrektur += eliteKorrekturHours.reduce((sum, h) => sum + h.hours, 0);
    totalSonstige += sonstigeHours.reduce((sum, h) => sum + h.hours, 0);
    
    grandTotalHours += monthData.totalHours;
    grandTotalAmount += monthData.totalAmount;
  });

  const rateUnterricht = data.invoice.dozent.hourly_rate_unterricht || 0;
  const rateElite = data.invoice.dozent.hourly_rate_elite || 0;
  const rateEliteKorrektur = data.invoice.dozent.hourly_rate_elite_korrektur || 0;
  const rateSonstige = data.invoice.dozent.hourly_rate_sonstige || 0;

  const amountRegular = totalRegular * rateUnterricht;
  const amountElite = totalElite * rateElite;
  const amountEliteKorrektur = totalEliteKorrektur * rateEliteKorrektur;
  const amountSonstige = totalSonstige * rateSonstige;

  // Summary table on cover page
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText('Zusammenfassung Quartal:', margin, yPosition);
  yPosition += 10;

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 3, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  addText('Leistung', margin + 2, yPosition + 1);
  addText('Stunden', margin + 90, yPosition + 1);
  addText('Satz', margin + 120, yPosition + 1);
  addText('Betrag', pageWidth - margin - 2, yPosition + 1, { align: 'right' });
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (totalRegular > 0) {
    addText('Unterrichtsstunden', margin + 2, yPosition);
    addText(`${formatNumber(totalRegular)} Std.`, margin + 90, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(rateUnterricht)} €` : '-', margin + 120, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(amountRegular)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalElite > 0) {
    addText('Elite-Kleingruppe Unterricht', margin + 2, yPosition);
    addText(`${formatNumber(totalElite)} Std.`, margin + 90, yPosition);
    addText(rateElite > 0 ? `${formatNumber(rateElite)} €` : '-', margin + 120, yPosition);
    addText(rateElite > 0 ? `${formatNumber(amountElite)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalEliteKorrektur > 0) {
    addText('Elite-Kleingruppe Korrektur', margin + 2, yPosition);
    addText(`${formatNumber(totalEliteKorrektur)} Std.`, margin + 90, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(rateEliteKorrektur)} €` : '-', margin + 120, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(amountEliteKorrektur)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalSonstige > 0) {
    addText('Sonstige Tätigkeiten', margin + 2, yPosition);
    addText(`${formatNumber(totalSonstige)} Std.`, margin + 90, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} €` : '-', margin + 120, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(amountSonstige)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  // Total line
  yPosition += 2;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  addText(`Gesamt: ${formatNumber(grandTotalHours)} Stunden`, margin, yPosition);
  if (grandTotalAmount > 0) {
    addText(`${formatNumber(grandTotalAmount)} €`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }
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

  // Add footer to cover page
  addFooter(currentPage, currentPage + data.monthlyData.length);

  // ==================== MONTHLY DETAIL PAGES ====================
  data.monthlyData.forEach((monthData, index) => {
    doc.addPage();
    currentPage++;
    yPosition = margin;

    // Monthly header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    addText(`Leistungsübersicht: ${getMonthName(monthData.month)} ${monthData.year}`, margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    addText(`Zeitraum: ${formatDate(monthData.period_start)} - ${formatDate(monthData.period_end)}`, margin, yPosition);
    yPosition += 12;

    // Hours table header
    checkPageBreak(40);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 3, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    addText('Datum', margin + 2, yPosition + 2);
    addText('Typ', margin + 25, yPosition + 2);
    addText('Beschreibung', margin + 70, yPosition + 2);
    addText('Stunden', pageWidth - margin - 15, yPosition + 2, { align: 'right' });
    yPosition += 10;

    // Hours entries
    doc.setFont('helvetica', 'normal');
    let totalParticipantHours = 0;
    let totalDozentHours = 0;

    // Participant hours
    if (monthData.participantHours && monthData.participantHours.length > 0) {
      for (const entry of monthData.participantHours) {
        checkPageBreak(8);
        doc.setFontSize(8);
        addText(formatDate(entry.date), margin + 2, yPosition);
        addText('Einzelunterricht', margin + 25, yPosition);
        const desc = `${entry.legal_area || '-'} - ${entry.teilnehmer?.name || '-'} - ${entry.description || '-'}`.substring(0, 60);
        addText(desc, margin + 70, yPosition);
        addText(entry.hours.toString(), pageWidth - margin - 2, yPosition, { align: 'right' });
        totalParticipantHours += entry.hours;
        yPosition += 5;
      }
    }

    // Dozent hours
    if (monthData.dozentHours && monthData.dozentHours.length > 0) {
      for (const entry of monthData.dozentHours) {
        checkPageBreak(8);
        doc.setFontSize(8);
        addText(formatDate(entry.date), margin + 2, yPosition);
        const type = entry.category === 'Elite-Kleingruppe Korrektur' || entry.description?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe' : entry.category || 'Sonstige Tätigkeit';
        addText(type, margin + 25, yPosition);
        const descYPosition = yPosition;
        const groupMatch = entry.description?.match(/- Elite-Kleingruppe\s+(\d{4}\/\d{4}\s*-\s*\d+)/);
        let extraLines = 0;
        if (entry.category === 'Elite-Kleingruppe Korrektur') {
          yPosition += 4;
          addText('Klausurenkorrektur', margin + 25, yPosition);
          extraLines = 1;
        } else if (groupMatch) {
          yPosition += 4;
          addText(groupMatch[1], margin + 25, yPosition);
          extraLines = 1;
        }
        const desc = (entry.description?.startsWith('Klausurkorrektur:') && (entry.category === 'Elite-Kleingruppe Korrektur' || entry.description?.includes('Elite-Kleingruppe')) ? entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim().replace(/- Elite-Kleingruppe\s+\d{4}\/\d{4}\s*-\s*\d+/, '').trim() : entry.description?.includes('Elite-Kleingruppe') ? entry.description.replace(/- Elite-Kleingruppe\s+\d{4}\/\d{4}\s*-\s*\d+/, '').trim() : entry.description || '-').substring(0, 80);
        addText(desc, margin + 70, descYPosition);
        addText(entry.hours.toString(), pageWidth - margin - 15, descYPosition, { align: 'right' });
        totalDozentHours += entry.hours;
        yPosition += 5 + (extraLines * 4);
      }
    }

    // Total line
    yPosition += 3;
    doc.setDrawColor(0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Calculate monthly totals per category
    const regularHours = monthData.participantHours.filter(h => !h.teilnehmer?.elite_kleingruppe);
    const eliteParticipantHours2 = monthData.participantHours.filter(h => h.teilnehmer?.elite_kleingruppe);
    const eliteUnterrichtHours2 = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
    const eliteKorrekturHours2 = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
    const sonstigeHours2 = monthData.dozentHours.filter(h => !h.category || !h.category.toLowerCase().includes('elite'));

    const totalRegular = regularHours.reduce((sum, h) => sum + h.hours, 0);
    const totalElite = eliteParticipantHours2.reduce((sum, h) => sum + h.hours, 0) + eliteUnterrichtHours2.reduce((sum, h) => sum + h.hours, 0);
    const totalEliteKorrektur = eliteKorrekturHours2.reduce((sum, h) => sum + h.hours, 0);
    const totalSonstige = sonstigeHours2.reduce((sum, h) => sum + h.hours, 0);
    const totalHours = totalRegular + totalElite + totalEliteKorrektur + totalSonstige;

    const amountRegular = totalRegular * rateUnterricht;
    const amountElite = totalElite * rateElite;
    const amountEliteKorrektur = totalEliteKorrektur * rateEliteKorrektur;
    const amountSonstige = totalSonstige * rateSonstige;
    const totalAmount = amountRegular + amountElite + amountEliteKorrektur + amountSonstige;

    // Monthly summary table
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 3, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    addText('Leistung', margin + 2, yPosition + 1);
    addText('Stunden', margin + 90, yPosition + 1);
    addText('Satz', margin + 120, yPosition + 1);
    addText('Betrag', pageWidth - margin - 2, yPosition + 1, { align: 'right' });
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    if (totalRegular > 0) {
      addText('Unterrichtsstunden', margin + 2, yPosition);
      addText(`${formatNumber(totalRegular)} Std.`, margin + 90, yPosition);
      addText(rateUnterricht > 0 ? `${formatNumber(rateUnterricht)} €` : '-', margin + 120, yPosition);
      addText(rateUnterricht > 0 ? `${formatNumber(amountRegular)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    if (totalElite > 0) {
      addText('Elite-Kleingruppe Unterricht', margin + 2, yPosition);
      addText(`${formatNumber(totalElite)} Std.`, margin + 90, yPosition);
      addText(rateElite > 0 ? `${formatNumber(rateElite)} €` : '-', margin + 120, yPosition);
      addText(rateElite > 0 ? `${formatNumber(amountElite)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    if (totalEliteKorrektur > 0) {
      addText('Elite-Kleingruppe Korrektur', margin + 2, yPosition);
      addText(`${formatNumber(totalEliteKorrektur)} Std.`, margin + 90, yPosition);
      addText(rateEliteKorrektur > 0 ? `${formatNumber(rateEliteKorrektur)} €` : '-', margin + 120, yPosition);
      addText(rateEliteKorrektur > 0 ? `${formatNumber(amountEliteKorrektur)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    if (totalSonstige > 0) {
      addText('Sonstige Tätigkeiten', margin + 2, yPosition);
      addText(`${formatNumber(totalSonstige)} Std.`, margin + 90, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} €` : '-', margin + 120, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(amountSonstige)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    // Monthly total line
    yPosition += 2;
    doc.setDrawColor(0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    addText(`Monatssumme: ${formatNumber(totalHours)} Stunden`, margin, yPosition);
    if (totalAmount > 0) {
      addText(`${formatNumber(totalAmount)} €`, pageWidth - margin - 2, yPosition, { align: 'right' });
    }

    // Add footer to monthly page
    addFooter(currentPage, data.monthlyData.length + 1);
  });

  // Generate filename: invoice_number_quarter_year_dozent_name.pdf
  const filename = `${data.invoice.invoice_number}_Q${data.quarter}_${data.quarterYear}_${data.invoice.dozent.full_name.replace(/\s+/g, '_')}.pdf`;

  // Save the PDF
  doc.save(filename);
};

// Generate quarterly PDF as Blob for preview
export const generateQuarterlyInvoicePDFBlob = async (data: QuarterlyInvoiceData): Promise<Blob> => {
  console.log('🎯 generateQuarterlyInvoicePDFBlob called with exam_type:', data.invoice.exam_type);
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = margin;
  let currentPage = 1;
  
  // Helper function to check if we need a new page
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 30) {
      doc.addPage();
      currentPage++;
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // Helper function to add text with proper encoding
  const addText = (text: string, x: number, y: number, options?: any) => {
    // Convert ae, ue, oe, ss to ä, ü, ö, ß
    const convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/ss/g, 'ß')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö')
      .replace(/SS/g, 'ß');
    doc.text(convertedText, x, y, options);
  };

  // Helper function to format numbers in German format
  const formatNumber = (num: number) => {
    const parts = num.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]).toLocaleString('de-DE');
    const decimalPart = parts[1];
    return `${integerPart},${decimalPart}`;
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

  const getQuarterName = (quarter: number) => {
    return `Q${quarter}`;
  };

  // Helper function to add footer
  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    addText(`Seite ${pageNum} von ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  };

  // ==================== COVER PAGE ====================
  // Header with dozent info (left side)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText(data.invoice.dozent.full_name, margin, yPosition);
  yPosition += 5;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  // Contact info (email, phone)
  if (data.invoice.dozent.email) {
    addText(data.invoice.dozent.email, margin, yPosition);
    yPosition += 4;
  }
  if (data.invoice.dozent.phone) {
    addText(data.invoice.dozent.phone, margin, yPosition);
    yPosition += 4;
  }
  yPosition += 6;

  // Recipient - different based on exam type
  console.log('PDF Generation - Invoice exam_type:', data.invoice.exam_type);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  
  if (data.invoice.exam_type === '2. Staatsexamen') {
    // 2. Staatsexamen -> Assessor Akademie Kraatz und Heinze GbR
    console.log('Using 2. Staatsexamen recipient: Assessor Akademie Kraatz und Heinze GbR');
    addText('Assessor Akademie Kraatz und Heinze GbR', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  } else {
    // 1. Staatsexamen (or no exam_type) -> Akademie Kraatz GmbH
    console.log('Using 1. Staatsexamen recipient: Akademie Kraatz GmbH');
    addText('Akademie Kraatz GmbH', margin, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    addText('Wilmersdorfer Str. 145 / 146', margin, yPosition);
    yPosition += 4;
    addText('10585 Berlin', margin, yPosition);
    yPosition += 8;
  }

  // Invoice title and details
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  addText('Rechnung Erteilung Unterricht lt. Aufstellung', margin, yPosition);
  
  // Invoice number (right aligned)
  addText(`RE-Nr: ${data.invoice.invoice_number}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Date (right aligned)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addText(`Datum: ${formatDate(new Date().toISOString())}`, pageWidth - margin, yPosition, { align: 'right' });
  yPosition += 6;

  // Period - show quarter
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const monthsNames = data.monthlyData.map(m => getMonthName(m.month)).join(', ');
  const periodText = `Leistungszeitraum: ${getQuarterName(data.quarter)} ${data.quarterYear} (${monthsNames})`;
  addText(periodText, margin, yPosition);
  yPosition += 12;

  // Greeting
  doc.setFontSize(11);
  addText('Sehr geehrter Herr Kraatz,', margin, yPosition);
  yPosition += 10;

  // Main text
  const mainText = 'entsprechend unserer Vereinbarung erlaube ich mir meine Leistungen in Ihrem Auftrag in Rechnung zu stellen. Ich bedanke mich fuer die gute Zusammenarbeit. Die Leistungsuebersicht fuer die einzelnen Monate lege ich Ihnen als Anlage bei.';
  yPosition = addWrappedText(mainText, margin, yPosition, contentWidth, 4);
  yPosition += 10;

  // Calculate totals across all months
  let totalRegular = 0;
  let totalElite = 0;
  let totalEliteKorrektur = 0;
  let totalSonstige = 0;
  let grandTotalHours = 0;
  let grandTotalAmount = 0;

  data.monthlyData.forEach(monthData => {
    const regularHours = monthData.participantHours.filter(h => !h.teilnehmer?.elite_kleingruppe);
    const eliteParticipantHours = monthData.participantHours.filter(h => h.teilnehmer?.elite_kleingruppe);
    const eliteUnterrichtHours = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
    const eliteKorrekturHours = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
    const sonstigeHours = monthData.dozentHours.filter(h => !h.category || !h.category.toLowerCase().includes('elite'));

    totalRegular += regularHours.reduce((sum, h) => sum + h.hours, 0);
    totalElite += eliteParticipantHours.reduce((sum, h) => sum + h.hours, 0) + eliteUnterrichtHours.reduce((sum, h) => sum + h.hours, 0);
    totalEliteKorrektur += eliteKorrekturHours.reduce((sum, h) => sum + h.hours, 0);
    totalSonstige += sonstigeHours.reduce((sum, h) => sum + h.hours, 0);
    
    grandTotalHours += monthData.totalHours;
    grandTotalAmount += monthData.totalAmount;
  });

  const rateUnterricht = data.invoice.dozent.hourly_rate_unterricht || 0;
  const rateElite = data.invoice.dozent.hourly_rate_elite || 0;
  const rateEliteKorrektur = data.invoice.dozent.hourly_rate_elite_korrektur || 0;
  const rateSonstige = data.invoice.dozent.hourly_rate_sonstige || 0;

  const amountRegular = totalRegular * rateUnterricht;
  const amountElite = totalElite * rateElite;
  const amountEliteKorrektur = totalEliteKorrektur * rateEliteKorrektur;
  const amountSonstige = totalSonstige * rateSonstige;

  // Summary table on cover page
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText('Zusammenfassung Quartal:', margin, yPosition);
  yPosition += 10;

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPosition - 3, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  addText('Leistung', margin + 2, yPosition + 1);
  addText('Stunden', margin + 90, yPosition + 1);
  addText('Satz', margin + 120, yPosition + 1);
  addText('Betrag', pageWidth - margin - 2, yPosition + 1, { align: 'right' });
  yPosition += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (totalRegular > 0) {
    addText('Unterrichtsstunden', margin + 2, yPosition);
    addText(`${formatNumber(totalRegular)} Std.`, margin + 90, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(rateUnterricht)} €` : '-', margin + 120, yPosition);
    addText(rateUnterricht > 0 ? `${formatNumber(amountRegular)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalElite > 0) {
    addText('Elite-Kleingruppe Unterricht', margin + 2, yPosition);
    addText(`${formatNumber(totalElite)} Std.`, margin + 90, yPosition);
    addText(rateElite > 0 ? `${formatNumber(rateElite)} €` : '-', margin + 120, yPosition);
    addText(rateElite > 0 ? `${formatNumber(amountElite)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalEliteKorrektur > 0) {
    addText('Elite-Kleingruppe Korrektur', margin + 2, yPosition);
    addText(`${formatNumber(totalEliteKorrektur)} Std.`, margin + 90, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(rateEliteKorrektur)} €` : '-', margin + 120, yPosition);
    addText(rateEliteKorrektur > 0 ? `${formatNumber(amountEliteKorrektur)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  if (totalSonstige > 0) {
    addText('Sonstige Tätigkeiten', margin + 2, yPosition);
    addText(`${formatNumber(totalSonstige)} Std.`, margin + 90, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} €` : '-', margin + 120, yPosition);
    addText(rateSonstige > 0 ? `${formatNumber(amountSonstige)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
    yPosition += 5;
  }

  // Total line
  yPosition += 2;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  addText(`Gesamt: ${formatNumber(grandTotalHours)} Stunden`, margin, yPosition);
  if (grandTotalAmount > 0) {
    addText(`${formatNumber(grandTotalAmount)} €`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }
  yPosition += 15;

  // Tax notice
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeText = 'Auf den Ausweis der Umsatzsteuer wurde verzichtet, da von der Befreiung nach Paragraph 4 Nr. 21 b Doppelbuchstabe b UStG Gebrauch gemacht wurde. Am Abrechnungstag ggf. noch nicht vorliegende Belege rechne ich mit der folgenden Abrechnung ab.';
  yPosition = addWrappedText(taxNoticeText, margin, yPosition, contentWidth, 3.5);
  yPosition += 6;

  // Bank request
  doc.setFontSize(10);
  const bankRequestText = 'Ich bitte, den entsprechenden Betrag, basierend auf den vereinbarten Stundensaetzen, auf mein nachfolgendes Konto zu ueberweisen:';
  yPosition = addWrappedText(bankRequestText, margin, yPosition, contentWidth, 4);
  yPosition += 6;

  // Bank details
  addText(`Kontoinhaber: ${data.invoice.dozent.full_name}`, margin, yPosition);
  yPosition += 4;
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
  yPosition += 8;

  // Closing
  addText('Vielen Dank!', margin, yPosition);
  yPosition += 8;
  addText('Mit freundlichen Gruessen', margin, yPosition);
  yPosition += 12;
  addText(data.invoice.dozent.full_name, margin, yPosition);

  // Add footer to cover page
  addFooter(currentPage, currentPage + data.monthlyData.length);

  // ==================== MONTHLY DETAIL PAGES ====================
  data.monthlyData.forEach((monthData, index) => {
    doc.addPage();
    currentPage++;
    yPosition = margin;

    // Monthly header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    addText(`Leistungsuebersicht: ${getMonthName(monthData.month)} ${monthData.year}`, margin, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    addText(`Zeitraum: ${formatDate(monthData.period_start)} - ${formatDate(monthData.period_end)}`, margin, yPosition);
    yPosition += 12;

    // Hours table header
    checkPageBreak(40);
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 3, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    addText('Datum', margin + 2, yPosition + 2);
    addText('Typ', margin + 25, yPosition + 2);
    addText('Beschreibung', margin + 70, yPosition + 2);
    addText('Stunden', pageWidth - margin - 15, yPosition + 2, { align: 'right' });
    yPosition += 10;

    // Hours entries
    doc.setFont('helvetica', 'normal');
    let totalParticipantHours = 0;
    let totalDozentHours = 0;

    // Participant hours
    if (monthData.participantHours && monthData.participantHours.length > 0) {
      for (const entry of monthData.participantHours) {
        checkPageBreak(8);
        doc.setFontSize(8);
        addText(formatDate(entry.date), margin + 2, yPosition);
        addText('Einzelunterricht', margin + 25, yPosition);
        const desc = `${entry.legal_area || '-'} - ${entry.teilnehmer?.name || '-'} - ${entry.description || '-'}`.substring(0, 60);
        addText(desc, margin + 70, yPosition);
        addText(entry.hours.toString(), pageWidth - margin - 2, yPosition, { align: 'right' });
        totalParticipantHours += entry.hours;
        yPosition += 5;
      }
    }

    // Dozent hours
    if (monthData.dozentHours && monthData.dozentHours.length > 0) {
      for (const entry of monthData.dozentHours) {
        checkPageBreak(8);
        doc.setFontSize(8);
        addText(formatDate(entry.date), margin + 2, yPosition);
        const type = entry.category === 'Elite-Kleingruppe Korrektur' || entry.description?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe' : entry.category || 'Sonstige Tätigkeit';
        addText(type, margin + 25, yPosition);
        const descYPosition = yPosition;
        const groupMatch = entry.description?.match(/- Elite-Kleingruppe\s+(\d{4}\/\d{4}\s*-\s*\d+)/);
        let extraLines = 0;
        if (entry.category === 'Elite-Kleingruppe Korrektur') {
          yPosition += 4;
          addText('Klausurenkorrektur', margin + 25, yPosition);
          extraLines = 1;
        } else if (groupMatch) {
          yPosition += 4;
          addText(groupMatch[1], margin + 25, yPosition);
          extraLines = 1;
        }
        const desc = (entry.description?.startsWith('Klausurkorrektur:') && (entry.category === 'Elite-Kleingruppe Korrektur' || entry.description?.includes('Elite-Kleingruppe')) ? entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim().replace(/- Elite-Kleingruppe\s+\d{4}\/\d{4}\s*-\s*\d+/, '').trim() : entry.description?.includes('Elite-Kleingruppe') ? entry.description.replace(/- Elite-Kleingruppe\s+\d{4}\/\d{4}\s*-\s*\d+/, '').trim() : entry.description || '-').substring(0, 80);
        addText(desc, margin + 70, descYPosition);
        addText(entry.hours.toString(), pageWidth - margin - 15, descYPosition, { align: 'right' });
        totalDozentHours += entry.hours;
        yPosition += 5 + (extraLines * 4);
      }
    }

    // Total line
    yPosition += 3;
    doc.setDrawColor(0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Calculate monthly totals per category
    const regularHours = monthData.participantHours.filter(h => !h.teilnehmer?.elite_kleingruppe);
    const eliteParticipantHours2 = monthData.participantHours.filter(h => h.teilnehmer?.elite_kleingruppe);
    const eliteUnterrichtHours2 = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && !h.category.toLowerCase().includes('korrektur'));
    const eliteKorrekturHours2 = monthData.dozentHours.filter(h => h.category && h.category.toLowerCase().includes('elite') && h.category.toLowerCase().includes('korrektur'));
    const sonstigeHours2 = monthData.dozentHours.filter(h => !h.category || !h.category.toLowerCase().includes('elite'));

    const totalRegular = regularHours.reduce((sum, h) => sum + h.hours, 0);
    const totalElite = eliteParticipantHours2.reduce((sum, h) => sum + h.hours, 0) + eliteUnterrichtHours2.reduce((sum, h) => sum + h.hours, 0);
    const totalEliteKorrektur = eliteKorrekturHours2.reduce((sum, h) => sum + h.hours, 0);
    const totalSonstige = sonstigeHours2.reduce((sum, h) => sum + h.hours, 0);
    const totalHours = totalRegular + totalElite + totalEliteKorrektur + totalSonstige;

    const amountRegular = totalRegular * rateUnterricht;
    const amountElite = totalElite * rateElite;
    const amountEliteKorrektur = totalEliteKorrektur * rateEliteKorrektur;
    const amountSonstige = totalSonstige * rateSonstige;
    const totalAmount = amountRegular + amountElite + amountEliteKorrektur + amountSonstige;

    // Monthly summary table
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 3, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    addText('Leistung', margin + 2, yPosition + 1);
    addText('Stunden', margin + 90, yPosition + 1);
    addText('Satz', margin + 120, yPosition + 1);
    addText('Betrag', pageWidth - margin - 2, yPosition + 1, { align: 'right' });
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    if (totalRegular > 0) {
      addText('Unterrichtsstunden', margin + 2, yPosition);
      addText(`${formatNumber(totalRegular)} Std.`, margin + 90, yPosition);
      addText(rateUnterricht > 0 ? `${formatNumber(rateUnterricht)} €` : '-', margin + 120, yPosition);
      addText(rateUnterricht > 0 ? `${formatNumber(amountRegular)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    if (totalElite > 0) {
      addText('Elite-Kleingruppe Unterricht', margin + 2, yPosition);
      addText(`${formatNumber(totalElite)} Std.`, margin + 90, yPosition);
      addText(rateElite > 0 ? `${formatNumber(rateElite)} €` : '-', margin + 120, yPosition);
      addText(rateElite > 0 ? `${formatNumber(amountElite)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    if (totalEliteKorrektur > 0) {
      addText('Elite-Kleingruppe Korrektur', margin + 2, yPosition);
      addText(`${formatNumber(totalEliteKorrektur)} Std.`, margin + 90, yPosition);
      addText(rateEliteKorrektur > 0 ? `${formatNumber(rateEliteKorrektur)} €` : '-', margin + 120, yPosition);
      addText(rateEliteKorrektur > 0 ? `${formatNumber(amountEliteKorrektur)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    if (totalSonstige > 0) {
      addText('Sonstige Tätigkeiten', margin + 2, yPosition);
      addText(`${formatNumber(totalSonstige)} Std.`, margin + 90, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} €` : '-', margin + 120, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(amountSonstige)} €` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    }

    // Monthly total line
    yPosition += 2;
    doc.setDrawColor(0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 6;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    addText(`Monatssumme: ${formatNumber(totalHours)} Stunden`, margin, yPosition);
    if (totalAmount > 0) {
      addText(`${formatNumber(totalAmount)} €`, pageWidth - margin - 2, yPosition, { align: 'right' });
    }

    // Add footer to monthly page
    addFooter(currentPage, data.monthlyData.length + 1);
  });

  // Return as Blob
  return doc.output('blob');
};