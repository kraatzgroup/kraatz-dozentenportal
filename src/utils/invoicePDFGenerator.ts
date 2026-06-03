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

interface FlatRateItem {
  date: string;
  name: string;
  description?: string;
  quantity: number;
  amount_euro: number;
  total_euro: number;
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
  flatRateItems?: FlatRateItem[];
}

// Wraps text to fit within maxWidth, always keeping words whole.
// When a word does not fit on the current line, a new line is started.
const splitTextKeepingWords = (doc: any, text: string, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const lines: string[] = [];
  let currentLine = '';

  const fits = (s: string) => doc.getTextWidth(s) <= maxWidth;

  for (const word of words) {
    const candidate = currentLine ? currentLine + ' ' + word : word;
    if (fits(candidate) || !currentLine) {
      // Either it fits, or the line is empty (place whole word even if it overflows)
      currentLine = candidate;
    } else {
      // Word doesn't fit: start a new line, keeping the word whole
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
};

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
    // Convert ae, ue, oe to ä, ü, ö
    // Only convert ss to ß in specific cases, not in words like "Unterrichtsstunden"
    let convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö');
    
    // Convert ss to ß only if it's not part of "Unterrichtsstunden"
    if (!text.includes('Unterrichtsstunden')) {
      convertedText = convertedText
        .replace(/ss/g, 'ß')
        .replace(/SS/g, 'ß');
    }
    
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

  // Calculate flat rate items total
  const flatRateTotal = (data.flatRateItems || []).reduce((sum, item) => sum + item.total_euro, 0);

  const totalAmount = amountRegular + amountElite + amountEliteKorrektur + amountSonstige + flatRateTotal;

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

  // Breakdown sonstige hours by category
  if (totalSonstige > 0) {
    const sonstigeByCategory: { [key: string]: number } = {};
    sonstigeHours.forEach((h: any) => {
      const category = h.category || 'Sonstige Tätigkeiten';
      sonstigeByCategory[category] = (sonstigeByCategory[category] || 0) + h.hours;
    });

    // Display each category
    Object.entries(sonstigeByCategory).forEach(([category, hours]) => {
      const amount = hours * rateSonstige;
      addText(category, margin + 2, yPosition);
      addText(`${formatNumber(hours)} Std.`, margin + 90, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} \u20ac` : '-', margin + 120, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(amount)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    });
  }

  // Breakdown flat rate items by category
  if (flatRateTotal > 0) {
    const flatRateByCategory: { [key: string]: number } = {};
    (data.flatRateItems || []).forEach((item: any) => {
      const category = item.category || item.name || 'Sonstige';
      flatRateByCategory[category] = (flatRateByCategory[category] || 0) + item.total_euro;
    });

    // Display each category
    Object.entries(flatRateByCategory).forEach(([category, total]) => {
      addText(category, margin + 2, yPosition);
      addText('-', margin + 90, yPosition);
      addText('-', margin + 120, yPosition);
      addText(`${formatNumber(total)} \u20ac`, pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    });
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

  // Tax notice - MUST be on page 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeTextPage1 = 'Auf den Ausweis der Umsatzsteuer wurde verzichtet, da von der Befreiung nach § 4 Nr. 21 b Doppelbuchstabe b UStG Gebrauch gemacht wurde. Am Abrechnungstag ggf. noch nicht vorliegende Belege rechne ich mit der folgenden Abrechnung ab.';
  yPosition = addWrappedText(taxNoticeTextPage1, margin, yPosition, contentWidth, 3.5);
  yPosition += 6;

  // Bank details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const bankRequestTextPage1 = 'Ich bitte, den entsprechenden Betrag, basierend auf den vereinbarten Stundensätzen, auf mein nachfolgendes Konto zu überweisen:';
  yPosition = addWrappedText(bankRequestTextPage1, margin, yPosition, contentWidth, 4);
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

  // Detailed hours listing
  doc.addPage();
  yPosition = margin;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText('Detaillierte Leistungsauflistung:', margin, yPosition);
  yPosition += 10;

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

  // Combine all hours and sort chronologically
  const allHours: Array<{ type: 'participant' | 'dozent' | 'flatrate'; date: string; hours: number; entry: any }> = [];
  
  if (data.participantHours && data.participantHours.length > 0) {
    data.participantHours.forEach(entry => {
      allHours.push({ type: 'participant', date: entry.date, hours: entry.hours, entry });
    });
  }
  
  if (data.dozentHours && data.dozentHours.length > 0) {
    data.dozentHours.forEach(entry => {
      allHours.push({ type: 'dozent', date: entry.date, hours: entry.hours, entry });
    });
  }

  // Add flat rate items (sonstige Posten)
  if (data.flatRateItems && data.flatRateItems.length > 0) {
    data.flatRateItems.forEach(entry => {
      allHours.push({ type: 'flatrate', date: entry.date, hours: 0, entry });
    });
  }

  // Sort all hours by category, then by student, then by date
  const categoryOrder: { [key: string]: number } = {
    'participant': 1,
    'elite_unterricht': 2,
    'elite_korrektur': 3,
    'sonstige': 4,
    'flatrate': 5
  };

  const sortedAllHours = allHours.sort((a, b) => {
    const getCategory = (item: any) => {
      if (item.type === 'participant') return 'participant';
      if (item.type === 'flatrate') return 'flatrate';
      if (item.type === 'dozent') {
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') return 'elite_korrektur';
        if (item.entry.category?.includes('Elite-Kleingruppe')) return 'elite_unterricht';
        // For other dozent entries, use their specific category as sort key
        return item.entry.category || 'sonstige';
      }
      return 'sonstige';
    };

    const getStudentName = (item: any) => {
      if (item.type === 'participant') {
        return item.entry.teilnehmer?.name || '';
      }
      return '';
    };

    const categoryA = getCategory(a);
    const categoryB = getCategory(b);
    const orderA = categoryOrder[categoryA] || 99;
    const orderB = categoryOrder[categoryB] || 99;

    if (orderA !== orderB) return orderA - orderB;
    
    // Within same type order, sort by specific category name (for dozent hours)
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);
    
    // Within same category, sort by student name (for participant hours)
    const studentA = getStudentName(a);
    const studentB = getStudentName(b);
    if (studentA !== studentB) return studentA.localeCompare(studentB);
    
    // Within same student, sort by date
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Display all hours in category order
  let lastCategory = '';
  
  for (const item of sortedAllHours) {
    doc.setFontSize(8);
    
    // Get current category
    const getCategory = (item: any) => {
      if (item.type === 'participant') return 'participant';
      if (item.type === 'flatrate') return 'flatrate';
      if (item.type === 'dozent') {
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') return 'elite_korrektur';
        if (item.entry.category?.includes('Elite-Kleingruppe')) return 'elite_unterricht';
        // For other dozent entries, use their specific category as sort key
        return item.entry.category || 'sonstige';
      }
      return 'sonstige';
    };
    
    const currentCategory = getCategory(item);
    
    // Add blank line between categories
    if (lastCategory !== '' && lastCategory !== currentCategory) {
      yPosition += 3;
    }
    
    lastCategory = currentCategory;
    
    // Calculate required height for this entry
    let requiredHeight = 8; // Base height for one line
    if (item.type === 'participant') {
      const desc = `${item.entry.legal_area || '-'} - ${item.entry.teilnehmer?.name || '-'} - ${item.entry.description || '-'}`;
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
      }
    } else if (item.type === 'dozent') {
      if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
        requiredHeight += 4; // Extra line for "Klausurenkorrektur"
      }
      let desc;
      if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
        desc = item.entry.description?.startsWith('Klausurkorrektur:') 
          ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
          : item.entry.description || '-';
      } else {
        desc = item.entry.description || '-';
      }
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
      }
    } else if (item.type === 'flatrate') {
      const desc = `${item.entry.name}${item.entry.description ? ' - ' + item.entry.description : ''}`;
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
      }
    }
    
    // Check if we need a new page before adding this entry
    checkPageBreak(requiredHeight);
    
    addText(formatDate(item.date), margin + 2, yPosition);
    
    if (item.type === 'participant') {
      addText('Einzelunterricht', margin + 25, yPosition);
      const descYPosition = yPosition;
      const studentName = item.entry.teilnehmer?.name || '-';
      const restDesc = `${item.entry.legal_area || '-'} - ${item.entry.description || '-'}`;
      const hoursColumnWidth = 25; // Width reserved for hours column
      const maxDescX = pageWidth - margin - hoursColumnWidth - 5; // Max x position for description
      const descColumnX = margin + 70 + 50; // Fixed description column (aligned with Elite-Kleingruppe)
      const maxWidth = maxDescX - descColumnX; // Calculate max width based on available space
      
      // Render student name in bold
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      addText(studentName, margin + 70, descYPosition);
      
      // Render the rest of the description in normal font at fixed position
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const startX = descColumnX; // Fixed description column for clean alignment
      
      // Always wrap text to avoid overlapping hours column (with hyphenation)
      const lines = splitTextKeepingWords(doc, restDesc, maxWidth);
      lines.forEach((line: string, index: number) => {
        addText(line, startX, descYPosition + (index * 4));
      });
      yPosition += 5 + ((lines.length - 1) * 4);
      
      addText(item.hours.toString(), pageWidth - margin - 2, descYPosition, { align: 'right' });
      totalParticipantHours += item.hours;
    } else if (item.type === 'dozent') {
      const type = item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.category?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe' : item.entry.category || 'Sonstige Tätigkeit';
      let extraLines = 0;
      
      // Description starts at the same Y position as the first line of category
      const descYPositionForDesc = yPosition;
      
      // Wrap long category names
      const typeMaxWidth = 45; // Max width for category name
      const typeLines = splitTextKeepingWords(doc, type, typeMaxWidth);
      typeLines.forEach((line: string, index: number) => {
        addText(line, margin + 25, yPosition + (index * 4));
      });
      extraLines = Math.max(extraLines, typeLines.length - 1);
      yPosition += (typeLines.length * 4);
      
      if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
        addText('Klausurenkorrektur', margin + 25, yPosition);
        extraLines += 1;
        yPosition += 4;
      }
      
      let desc;
      if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
        desc = item.entry.description?.startsWith('Klausurkorrektur:') 
          ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
          : item.entry.description || '-';
      } else {
        desc = item.entry.description || '-';
      }
      
      // Extract course number and rest of description for Elite-Kleingruppe
      let courseNumber = '';
      let restDesc = desc;
      if (item.entry.category?.includes('Elite-Kleingruppe')) {
        // Match pattern "Elite-Kleingruppe 2025/2026 - 101"
        const match = desc.match(/(Elite-Kleingruppe\s+\d{4}\/\d{4}\s*-\s*\d+)/);
        if (match) {
          courseNumber = match[1];
          restDesc = desc.replace(courseNumber, '').trim();
          // Strip leading/trailing separator dashes left over after removing the course number
          restDesc = restDesc.replace(/^[-\s]+/, '').replace(/[-\s]+$/, '').trim();
        }
      }
      
      const hoursColumnWidth = 25;
      const maxDescX = pageWidth - margin - hoursColumnWidth - 5;
      
      if (courseNumber && item.entry.category?.includes('Elite-Kleingruppe')) {
        // Render course number in bold
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        addText(courseNumber, margin + 70, descYPositionForDesc);
        
        // Render the rest of the description in normal font at fixed column (aligned with Einzelunterricht)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const startX = margin + 70 + 50; // Fixed description column for clean alignment
        const dynamicMaxWidth = maxDescX - startX;
        const lines = splitTextKeepingWords(doc, restDesc, dynamicMaxWidth);
        lines.forEach((line: string, index: number) => {
          addText(line, startX, descYPositionForDesc + (index * 4));
        });
        extraLines = Math.max(extraLines, lines.length - 1);
      } else {
        // Wrap description keeping words whole and avoid overlapping the hours column
        const elseMaxWidth = (pageWidth - margin - hoursColumnWidth - 5) - (margin + 70);
        const lines = splitTextKeepingWords(doc, desc, elseMaxWidth);
        lines.forEach((line: string, index: number) => {
          addText(line, margin + 70, descYPositionForDesc + (index * 4));
        });
        extraLines = Math.max(extraLines, lines.length - 1);
      }
      addText(item.hours.toString(), pageWidth - margin - 2, descYPositionForDesc, { align: 'right' });
      totalDozentHours += item.hours;
      yPosition += 5 + (extraLines * 4);
    } else if (item.type === 'flatrate') {
      addText(item.entry.category || item.entry.name || 'Sonstiger Posten', margin + 25, yPosition);
      const descYPosition = yPosition;
      const desc = item.entry.description || '';
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        lines.forEach((line: string, index: number) => {
          addText(line, margin + 70, descYPosition + (index * 4));
        });
        yPosition += 5 + ((lines.length - 1) * 4);
      } else {
        addText(desc, margin + 70, descYPosition);
        yPosition += 5;
      }
      addText(`${item.entry.quantity} x ${item.entry.amount_euro.toFixed(2)}€`, pageWidth - margin - 2, descYPosition, { align: 'right' });
    }
  }

  // Total line for detailed listing
  yPosition += 3;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  addText(`Gesamt: ${formatNumber(totalHours)} Stunden`, margin, yPosition);
  if (totalAmount > 0) {
    addText(`${formatNumber(totalAmount)} \u20ac`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }
  yPosition += 15;

  // Tax notice - MUST be on page 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeText = 'Auf den Ausweis der Umsatzsteuer wurde verzichtet, da von der Befreiung nach § 4 Nr. 21 b Doppelbuchstabe b UStG Gebrauch gemacht wurde. Am Abrechnungstag ggf. noch nicht vorliegende Belege rechne ich mit der folgenden Abrechnung ab.';
  yPosition = addWrappedText(taxNoticeText, margin, yPosition, contentWidth, 3.5);
  yPosition += 6;

  // Check if we need a new page for the remaining content
  checkPageBreak(80);

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
    // Convert ae, ue, oe to ä, ü, ö
    // Only convert ss to ß in specific cases, not in words like "Unterrichtsstunden"
    let convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö');
    
    // Convert ss to ß only if it's not part of "Unterrichtsstunden"
    if (!text.includes('Unterrichtsstunden')) {
      convertedText = convertedText
        .replace(/ss/g, 'ß')
        .replace(/SS/g, 'ß');
    }
    
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

  // Calculate totals per category for summary table
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

  // Calculate flat rate items total
  const flatRateTotal = (data.flatRateItems || []).reduce((sum, item) => sum + item.total_euro, 0);

  const totalAmount = amountRegular + amountElite + amountEliteKorrektur + amountSonstige + flatRateTotal;

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

  // Breakdown sonstige hours by category
  if (totalSonstige > 0) {
    const sonstigeByCategory: { [key: string]: number } = {};
    sonstigeHours.forEach((h: any) => {
      const category = h.category || 'Sonstige Tätigkeiten';
      sonstigeByCategory[category] = (sonstigeByCategory[category] || 0) + h.hours;
    });

    // Display each category
    Object.entries(sonstigeByCategory).forEach(([category, hours]) => {
      const amount = hours * rateSonstige;
      addText(category, margin + 2, yPosition);
      addText(`${formatNumber(hours)} Std.`, margin + 90, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} \u20ac` : '-', margin + 120, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(amount)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    });
  }

  // Breakdown flat rate items by category
  if (flatRateTotal > 0) {
    const flatRateByCategory: { [key: string]: number } = {};
    (data.flatRateItems || []).forEach((item: any) => {
      const category = item.category || item.name || 'Sonstige';
      flatRateByCategory[category] = (flatRateByCategory[category] || 0) + item.total_euro;
    });

    // Display each category
    Object.entries(flatRateByCategory).forEach(([category, total]) => {
      addText(category, margin + 2, yPosition);
      addText('-', margin + 90, yPosition);
      addText('-', margin + 120, yPosition);
      addText(`${formatNumber(total)} \u20ac`, pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    });
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

  // Tax notice - MUST be on page 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeTextPage1 = 'Auf den Ausweis der Umsatzsteuer wurde verzichtet, da von der Befreiung nach § 4 Nr. 21 b Doppelbuchstabe b UStG Gebrauch gemacht wurde. Am Abrechnungstag ggf. noch nicht vorliegende Belege rechne ich mit der folgenden Abrechnung ab.';
  yPosition = addWrappedText(taxNoticeTextPage1, margin, yPosition, contentWidth, 3.5);
  yPosition += 6;

  // Bank details
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const bankRequestTextPage1 = 'Ich bitte, den entsprechenden Betrag, basierend auf den vereinbarten Stundensätzen, auf mein nachfolgendes Konto zu überweisen:';
  yPosition = addWrappedText(bankRequestTextPage1, margin, yPosition, contentWidth, 4);
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

  // Detailed hours listing
  doc.addPage();
  yPosition = margin;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  addText('Detaillierte Leistungsauflistung:', margin, yPosition);
  yPosition += 10;

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

  // Combine all hours and sort chronologically
  const allHours: Array<{ type: 'participant' | 'dozent' | 'flatrate'; date: string; hours: number; entry: any }> = [];
  
  if (data.participantHours && data.participantHours.length > 0) {
    data.participantHours.forEach(entry => {
      allHours.push({ type: 'participant', date: entry.date, hours: entry.hours, entry });
    });
  }
  
  if (data.dozentHours && data.dozentHours.length > 0) {
    data.dozentHours.forEach(entry => {
      allHours.push({ type: 'dozent', date: entry.date, hours: entry.hours, entry });
    });
  }

  // Add flat rate items (sonstige Posten)
  if (data.flatRateItems && data.flatRateItems.length > 0) {
    data.flatRateItems.forEach(entry => {
      allHours.push({ type: 'flatrate', date: entry.date, hours: 0, entry });
    });
  }

  // Sort all hours by category, then by student, then by date
  const categoryOrder: { [key: string]: number } = {
    'participant': 1,
    'elite_unterricht': 2,
    'elite_korrektur': 3,
    'sonstige': 4,
    'flatrate': 5
  };

  const sortedAllHours = allHours.sort((a, b) => {
    const getCategory = (item: any) => {
      if (item.type === 'participant') return 'participant';
      if (item.type === 'flatrate') return 'flatrate';
      if (item.type === 'dozent') {
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') return 'elite_korrektur';
        if (item.entry.category?.includes('Elite-Kleingruppe')) return 'elite_unterricht';
        // For other dozent entries, use their specific category as sort key
        return item.entry.category || 'sonstige';
      }
      return 'sonstige';
    };

    const getStudentName = (item: any) => {
      if (item.type === 'participant') {
        return item.entry.teilnehmer?.name || '';
      }
      return '';
    };

    const categoryA = getCategory(a);
    const categoryB = getCategory(b);
    const orderA = categoryOrder[categoryA] || 99;
    const orderB = categoryOrder[categoryB] || 99;

    if (orderA !== orderB) return orderA - orderB;
    
    // Within same type order, sort by specific category name (for dozent hours)
    if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);
    
    // Within same category, sort by student name (for participant hours)
    const studentA = getStudentName(a);
    const studentB = getStudentName(b);
    if (studentA !== studentB) return studentA.localeCompare(studentB);
    
    // Within same student, sort by date
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Display all hours in category order
  let lastCategory = '';
  
  for (const item of sortedAllHours) {
    doc.setFontSize(8);
    
    // Get current category
    const getCategory = (item: any) => {
      if (item.type === 'participant') return 'participant';
      if (item.type === 'flatrate') return 'flatrate';
      if (item.type === 'dozent') {
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') return 'elite_korrektur';
        if (item.entry.category?.includes('Elite-Kleingruppe')) return 'elite_unterricht';
        // For other dozent entries, use their specific category as sort key
        return item.entry.category || 'sonstige';
      }
      return 'sonstige';
    };
    
    const currentCategory = getCategory(item);
    
    // Add blank line between categories
    if (lastCategory !== '' && lastCategory !== currentCategory) {
      yPosition += 3;
    }
    
    lastCategory = currentCategory;
    
    // Calculate required height for this entry
    let requiredHeight = 8; // Base height for one line
    if (item.type === 'participant') {
      const desc = `${item.entry.legal_area || '-'} - ${item.entry.teilnehmer?.name || '-'} - ${item.entry.description || '-'}`;
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
      }
    } else if (item.type === 'dozent') {
      if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
        requiredHeight += 4; // Extra line for "Klausurenkorrektur"
      }
      let desc;
      if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
        desc = item.entry.description?.startsWith('Klausurkorrektur:') 
          ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
          : item.entry.description || '-';
      } else {
        desc = item.entry.description || '-';
      }
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
      }
    } else if (item.type === 'flatrate') {
      const desc = `${item.entry.name}${item.entry.description ? ' - ' + item.entry.description : ''}`;
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
      }
    }
    
    // Check if we need a new page before adding this entry
    checkPageBreak(requiredHeight);
    
    addText(formatDate(item.date), margin + 2, yPosition);
    
    if (item.type === 'participant') {
      addText('Einzelunterricht', margin + 25, yPosition);
      const descYPosition = yPosition;
      const studentName = item.entry.teilnehmer?.name || '-';
      const restDesc = `${item.entry.legal_area || '-'} - ${item.entry.description || '-'}`;
      const hoursColumnWidth = 25; // Width reserved for hours column
      const maxDescX = pageWidth - margin - hoursColumnWidth - 5; // Max x position for description
      const descColumnX = margin + 70 + 50; // Fixed description column (aligned with Elite-Kleingruppe)
      const maxWidth = maxDescX - descColumnX; // Calculate max width based on available space
      
      // Render student name in bold
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      addText(studentName, margin + 70, descYPosition);
      
      // Render the rest of the description in normal font at fixed position
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const startX = descColumnX; // Fixed description column for clean alignment
      
      // Always wrap text to avoid overlapping hours column (with hyphenation)
      const lines = splitTextKeepingWords(doc, restDesc, maxWidth);
      lines.forEach((line: string, index: number) => {
        addText(line, startX, descYPosition + (index * 4));
      });
      yPosition += 5 + ((lines.length - 1) * 4);
      
      addText(item.hours.toString(), pageWidth - margin - 2, descYPosition, { align: 'right' });
      totalParticipantHours += item.hours;
    } else if (item.type === 'dozent') {
      const type = item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.category?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe' : item.entry.category || 'Sonstige Tätigkeit';
      let extraLines = 0;
      
      // Description starts at the same Y position as the first line of category
      const descYPositionForDesc = yPosition;
      
      // Wrap long category names
      const typeMaxWidth = 45; // Max width for category name
      const typeLines = splitTextKeepingWords(doc, type, typeMaxWidth);
      typeLines.forEach((line: string, index: number) => {
        addText(line, margin + 25, yPosition + (index * 4));
      });
      extraLines = Math.max(extraLines, typeLines.length - 1);
      yPosition += (typeLines.length * 4);
      
      if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
        addText('Klausurenkorrektur', margin + 25, yPosition);
        extraLines += 1;
        yPosition += 4;
      }
      
      let desc;
      if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
        desc = item.entry.description?.startsWith('Klausurkorrektur:') 
          ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
          : item.entry.description || '-';
      } else {
        desc = item.entry.description || '-';
      }
      
      // Extract course number and rest of description for Elite-Kleingruppe
      let courseNumber = '';
      let restDesc = desc;
      if (item.entry.category?.includes('Elite-Kleingruppe')) {
        // Match pattern "Elite-Kleingruppe 2025/2026 - 101"
        const match = desc.match(/(Elite-Kleingruppe\s+\d{4}\/\d{4}\s*-\s*\d+)/);
        if (match) {
          courseNumber = match[1];
          restDesc = desc.replace(courseNumber, '').trim();
          // Strip leading/trailing separator dashes left over after removing the course number
          restDesc = restDesc.replace(/^[-\s]+/, '').replace(/[-\s]+$/, '').trim();
        }
      }
      
      const hoursColumnWidth = 25;
      const maxDescX = pageWidth - margin - hoursColumnWidth - 5;
      
      if (courseNumber && item.entry.category?.includes('Elite-Kleingruppe')) {
        // Render course number in bold
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        addText(courseNumber, margin + 70, descYPositionForDesc);
        
        // Render the rest of the description in normal font at fixed column (aligned with Einzelunterricht)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const startX = margin + 70 + 50; // Fixed description column for clean alignment
        const dynamicMaxWidth = maxDescX - startX;
        const lines = splitTextKeepingWords(doc, restDesc, dynamicMaxWidth);
        lines.forEach((line: string, index: number) => {
          addText(line, startX, descYPositionForDesc + (index * 4));
        });
        extraLines = Math.max(extraLines, lines.length - 1);
      } else {
        // Wrap description keeping words whole and avoid overlapping the hours column
        const elseMaxWidth = (pageWidth - margin - hoursColumnWidth - 5) - (margin + 70);
        const lines = splitTextKeepingWords(doc, desc, elseMaxWidth);
        lines.forEach((line: string, index: number) => {
          addText(line, margin + 70, descYPositionForDesc + (index * 4));
        });
        extraLines = Math.max(extraLines, lines.length - 1);
      }
      addText(item.hours.toString(), pageWidth - margin - 2, descYPositionForDesc, { align: 'right' });
      totalDozentHours += item.hours;
      yPosition += 5 + (extraLines * 4);
    } else if (item.type === 'flatrate') {
      addText(item.entry.category || item.entry.name || 'Sonstiger Posten', margin + 25, yPosition);
      const descYPosition = yPosition;
      const desc = item.entry.description || '';
      const maxWidth = pageWidth - margin - 20 - (margin + 70);
      if (desc.length > 50) {
        const lines = doc.splitTextToSize(desc, maxWidth);
        lines.forEach((line: string, index: number) => {
          addText(line, margin + 70, descYPosition + (index * 4));
        });
        yPosition += 5 + ((lines.length - 1) * 4);
      } else {
        addText(desc, margin + 70, descYPosition);
        yPosition += 5;
      }
      addText(`${item.entry.quantity} x ${item.entry.amount_euro.toFixed(2)}€`, pageWidth - margin - 2, descYPosition, { align: 'right' });
    }
  }

  // Total line for detailed listing
  yPosition += 3;
  doc.setDrawColor(0);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  addText(`Gesamt: ${formatNumber(totalHours)} Stunden`, margin, yPosition);
  if (totalAmount > 0) {
    addText(`${formatNumber(totalAmount)} \u20ac`, pageWidth - margin - 2, yPosition, { align: 'right' });
  }
  yPosition += 15;

  // Check if we need a new page for the remaining content
  checkPageBreak(80);

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

  // Breakdown sonstige hours by category
  if (totalSonstige > 0) {
    const sonstigeByCategory: { [key: string]: number } = {};
    sonstigeHours.forEach((h: any) => {
      const category = h.category || 'Sonstige Tätigkeiten';
      sonstigeByCategory[category] = (sonstigeByCategory[category] || 0) + h.hours;
    });

    // Display each category
    Object.entries(sonstigeByCategory).forEach(([category, hours]) => {
      const amount = hours * rateSonstige;
      addText(category, margin + 2, yPosition);
      addText(`${formatNumber(hours)} Std.`, margin + 90, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(rateSonstige)} \u20ac` : '-', margin + 120, yPosition);
      addText(rateSonstige > 0 ? `${formatNumber(amount)} \u20ac` : '-', pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    });
  }

  // Breakdown flat rate items by category
  if (flatRateTotal > 0) {
    const flatRateByCategory: { [key: string]: number } = {};
    (data.flatRateItems || []).forEach((item: any) => {
      const category = item.category || item.name || 'Sonstige';
      flatRateByCategory[category] = (flatRateByCategory[category] || 0) + item.total_euro;
    });

    // Display each category
    Object.entries(flatRateByCategory).forEach(([category, total]) => {
      addText(category, margin + 2, yPosition);
      addText('-', margin + 90, yPosition);
      addText('-', margin + 120, yPosition);
      addText(`${formatNumber(total)} \u20ac`, pageWidth - margin - 2, yPosition, { align: 'right' });
      yPosition += 5;
    });
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

  // Check if we need a new page for the remaining content
  checkPageBreak(80);

  // Tax notice
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeText = 'Umsatzsteuer ist richtig';
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
  flatRateItems?: FlatRateItem[];
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
    // Convert ae, ue, oe to ä, ü, ö
    // Only convert ss to ß in specific cases, not in words like "Unterrichtsstunden"
    let convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö');
    
    // Convert ss to ß only if it's not part of "Unterrichtsstunden"
    if (!text.includes('Unterrichtsstunden')) {
      convertedText = convertedText
        .replace(/ss/g, 'ß')
        .replace(/SS/g, 'ß');
    }
    
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

  // Tax notice - MUST be on page 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeText = 'Auf den Ausweis der Umsatzsteuer wurde verzichtet, da von der Befreiung nach § 4 Nr. 21 b Doppelbuchstabe b UStG Gebrauch gemacht wurde. Am Abrechnungstag ggf. noch nicht vorliegende Belege rechne ich mit der folgenden Abrechnung ab.';
  yPosition = addWrappedText(taxNoticeText, margin, yPosition, contentWidth, 3.5);
  yPosition += 6;

  // Check if we need a new page for the remaining content
  checkPageBreak(80);

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

    // Combine all hours and sort chronologically
    const allHours: Array<{ type: 'participant' | 'dozent' | 'flatrate'; date: string; hours: number; entry: any }> = [];
    
    if (monthData.participantHours && monthData.participantHours.length > 0) {
      monthData.participantHours.forEach(entry => {
        allHours.push({ type: 'participant', date: entry.date, hours: entry.hours, entry });
      });
    }
    
    if (monthData.dozentHours && monthData.dozentHours.length > 0) {
      monthData.dozentHours.forEach(entry => {
        allHours.push({ type: 'dozent', date: entry.date, hours: entry.hours, entry });
      });
    }

    // Add flat rate items (sonstige Posten)
    if (monthData.flatRateItems && monthData.flatRateItems.length > 0) {
      monthData.flatRateItems.forEach(entry => {
        allHours.push({ type: 'flatrate', date: entry.date, hours: 0, entry });
      });
    }

    // Sort all hours by category, then by student, then by date
    const categoryOrder: { [key: string]: number } = {
      'participant': 1,
      'elite_unterricht': 2,
      'elite_korrektur': 3,
      'sonstige': 4,
      'flatrate': 5
    };

    const sortedAllHours = allHours.sort((a, b) => {
      const getCategory = (item: any) => {
        if (item.type === 'participant') return 'participant';
        if (item.type === 'flatrate') return 'flatrate';
        if (item.type === 'dozent') {
          if (item.entry.category === 'Elite-Kleingruppe Korrektur') return 'elite_korrektur';
          if (item.entry.category?.includes('Elite-Kleingruppe')) return 'elite_unterricht';
          return 'sonstige';
        }
        return 'sonstige';
      };

      const getStudentName = (item: any) => {
        if (item.type === 'participant') {
          return item.entry.teilnehmer?.name || '';
        }
        return '';
      };

      const categoryA = getCategory(a);
      const categoryB = getCategory(b);
      const orderA = categoryOrder[categoryA] || 99;
      const orderB = categoryOrder[categoryB] || 99;

      if (orderA !== orderB) return orderA - orderB;
      
      // Within same category, sort by student name (for participant hours)
      const studentA = getStudentName(a);
      const studentB = getStudentName(b);
      if (studentA !== studentB) return studentA.localeCompare(studentB);
      
      // Within same student, sort by date
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Display all hours in category order
    for (const item of sortedAllHours) {
      doc.setFontSize(8);
      
      // Calculate required height for this entry
      let requiredHeight = 8; // Base height for one line
      if (item.type === 'participant') {
        const desc = `${item.entry.legal_area || '-'} - ${item.entry.teilnehmer?.name || '-'} - ${item.entry.description || '-'}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
        }
      } else if (item.type === 'dozent') {
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
          requiredHeight += 4; // Extra line for "Klausurenkorrektur"
        }
        const groupMatch = item.entry.description?.match(/- Elite-Kleingruppe\s+(\d{4}\/\d{4}\s*-\s*\d+)/);
        if (groupMatch) {
          requiredHeight += 4; // Extra line for group match
        }
        let desc;
        if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
          desc = item.entry.description?.startsWith('Klausurkorrektur:') 
            ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
            : item.entry.description || '-';
        } else {
          desc = item.entry.description || '-';
        }
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
        }
      } else if (item.type === 'flatrate') {
        const desc = `${item.entry.name}${item.entry.description ? ' - ' + item.entry.description : ''}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
        }
      }
      
      // Check if we need a new page before adding this entry
      checkPageBreak(requiredHeight);
      
      addText(formatDate(item.date), margin + 2, yPosition);
      
      if (item.type === 'participant') {
        addText('Einzelunterricht', margin + 25, yPosition);
        const descYPosition = yPosition;
        const desc = `${item.entry.legal_area || '-'} - ${item.entry.teilnehmer?.name || '-'} - ${item.entry.description || '-'}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          lines.forEach((line: string, index: number) => {
            addText(line, margin + 70, descYPosition + (index * 4));
          });
          yPosition += 5 + ((lines.length - 1) * 4);
        } else {
          addText(desc, margin + 70, descYPosition);
          yPosition += 5;
        }
        addText(item.hours.toString(), pageWidth - margin - 2, descYPosition, { align: 'right' });
        totalParticipantHours += item.hours;
      } else if (item.type === 'dozent') {
        const type = item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe' : item.entry.category || 'Sonstige Tätigkeit';
        addText(type, margin + 25, yPosition);
        const descYPosition = yPosition;
        const groupMatch = item.entry.description?.match(/- Elite-Kleingruppe\s+(\d{4}\/\d{4}\s*-\s*\d+)/);
        let extraLines = 0;
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
          yPosition += 4;
          addText('Klausurenkorrektur', margin + 25, yPosition);
          extraLines = 1;
        } else if (groupMatch) {
          yPosition += 4;
          addText(groupMatch[1], margin + 25, yPosition);
          extraLines = 1;
        }
        let desc;
        if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
          desc = item.entry.description?.startsWith('Klausurkorrektur:') 
            ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
            : item.entry.description || '-';
        } else {
          desc = item.entry.description || '-';
        }
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          lines.forEach((line: string, index: number) => {
            addText(line, margin + 70, descYPosition + (index * 4));
          });
          extraLines = Math.max(extraLines, lines.length - 1);
        } else {
          addText(desc, margin + 70, descYPosition);
        }
        addText(item.hours.toString(), pageWidth - margin - 15, descYPosition, { align: 'right' });
        totalDozentHours += item.hours;
        yPosition += 5 + (extraLines * 4);
      } else if (item.type === 'flatrate') {
        addText('Sonstiger Posten', margin + 25, yPosition);
        const descYPosition = yPosition;
        const desc = `${item.entry.name}${item.entry.description ? ' - ' + item.entry.description : ''}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          lines.forEach((line: string, index: number) => {
            addText(line, margin + 70, descYPosition + (index * 4));
          });
          yPosition += 5 + ((lines.length - 1) * 4);
        } else {
          addText(desc, margin + 70, descYPosition);
          yPosition += 5;
        }
        addText(`${item.entry.quantity} x ${item.entry.amount_euro.toFixed(2)}€`, pageWidth - margin - 2, descYPosition, { align: 'right' });
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
    // Convert ae, ue, oe to ä, ü, ö
    // Only convert ss to ß in specific cases, not in words like "Unterrichtsstunden"
    let convertedText = text
      .replace(/ae/g, 'ä')
      .replace(/ue/g, 'ü')
      .replace(/oe/g, 'ö')
      .replace(/AE/g, 'Ä')
      .replace(/UE/g, 'Ü')
      .replace(/OE/g, 'Ö');
    
    // Convert ss to ß only if it's not part of "Unterrichtsstunden"
    if (!text.includes('Unterrichtsstunden')) {
      convertedText = convertedText
        .replace(/ss/g, 'ß')
        .replace(/SS/g, 'ß');
    }
    
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

  // Check if we need a new page for the remaining content
  checkPageBreak(80);

  // Tax notice
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const taxNoticeText = 'Umsatzsteuer ist richtig';
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

    // Combine all hours and sort chronologically
    const allHours: Array<{ type: 'participant' | 'dozent' | 'flatrate'; date: string; hours: number; entry: any }> = [];
    
    if (monthData.participantHours && monthData.participantHours.length > 0) {
      monthData.participantHours.forEach(entry => {
        allHours.push({ type: 'participant', date: entry.date, hours: entry.hours, entry });
      });
    }
    
    if (monthData.dozentHours && monthData.dozentHours.length > 0) {
      monthData.dozentHours.forEach(entry => {
        allHours.push({ type: 'dozent', date: entry.date, hours: entry.hours, entry });
      });
    }

    // Add flat rate items (sonstige Posten)
    if (monthData.flatRateItems && monthData.flatRateItems.length > 0) {
      monthData.flatRateItems.forEach(entry => {
        allHours.push({ type: 'flatrate', date: entry.date, hours: 0, entry });
      });
    }

    // Sort all hours by category, then by student, then by date
    const categoryOrder: { [key: string]: number } = {
      'participant': 1,
      'elite_unterricht': 2,
      'elite_korrektur': 3,
      'sonstige': 4,
      'flatrate': 5
    };

    const sortedAllHours = allHours.sort((a, b) => {
      const getCategory = (item: any) => {
        if (item.type === 'participant') return 'participant';
        if (item.type === 'flatrate') return 'flatrate';
        if (item.type === 'dozent') {
          if (item.entry.category === 'Elite-Kleingruppe Korrektur') return 'elite_korrektur';
          if (item.entry.category?.includes('Elite-Kleingruppe')) return 'elite_unterricht';
          return 'sonstige';
        }
        return 'sonstige';
      };

      const getStudentName = (item: any) => {
        if (item.type === 'participant') {
          return item.entry.teilnehmer?.name || '';
        }
        return '';
      };

      const categoryA = getCategory(a);
      const categoryB = getCategory(b);
      const orderA = categoryOrder[categoryA] || 99;
      const orderB = categoryOrder[categoryB] || 99;

      if (orderA !== orderB) return orderA - orderB;
      
      // Within same category, sort by student name (for participant hours)
      const studentA = getStudentName(a);
      const studentB = getStudentName(b);
      if (studentA !== studentB) return studentA.localeCompare(studentB);
      
      // Within same student, sort by date
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Display all hours in category order
    for (const item of sortedAllHours) {
      doc.setFontSize(8);
      
      // Calculate required height for this entry
      let requiredHeight = 8; // Base height for one line
      if (item.type === 'participant') {
        const desc = `${item.entry.legal_area || '-'} - ${item.entry.teilnehmer?.name || '-'} - ${item.entry.description || '-'}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
        }
      } else if (item.type === 'dozent') {
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
          requiredHeight += 4; // Extra line for "Klausurenkorrektur"
        }
        const groupMatch = item.entry.description?.match(/- Elite-Kleingruppe\s+(\d{4}\/\d{4}\s*-\s*\d+)/);
        if (groupMatch) {
          requiredHeight += 4; // Extra line for group match
        }
        let desc;
        if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
          desc = item.entry.description?.startsWith('Klausurkorrektur:') 
            ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
            : item.entry.description || '-';
        } else {
          desc = item.entry.description || '-';
        }
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
        }
      } else if (item.type === 'flatrate') {
        const desc = `${item.entry.name}${item.entry.description ? ' - ' + item.entry.description : ''}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          requiredHeight += (lines.length - 1) * 4; // Extra lines for wrapped text
        }
      }
      
      // Check if we need a new page before adding this entry
      checkPageBreak(requiredHeight);
      
      addText(formatDate(item.date), margin + 2, yPosition);
      
      if (item.type === 'participant') {
        addText('Einzelunterricht', margin + 25, yPosition);
        const descYPosition = yPosition;
        const desc = `${item.entry.legal_area || '-'} - ${item.entry.teilnehmer?.name || '-'} - ${item.entry.description || '-'}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          lines.forEach((line: string, index: number) => {
            addText(line, margin + 70, descYPosition + (index * 4));
          });
          yPosition += 5 + ((lines.length - 1) * 4);
        } else {
          addText(desc, margin + 70, descYPosition);
          yPosition += 5;
        }
        addText(item.hours.toString(), pageWidth - margin - 2, descYPosition, { align: 'right' });
        totalParticipantHours += item.hours;
      } else if (item.type === 'dozent') {
        const type = item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe') ? 'Elite-Kleingruppe' : item.entry.category || 'Sonstige Tätigkeit';
        addText(type, margin + 25, yPosition);
        const descYPosition = yPosition;
        const groupMatch = item.entry.description?.match(/- Elite-Kleingruppe\s+(\d{4}\/\d{4}\s*-\s*\d+)/);
        let extraLines = 0;
        if (item.entry.category === 'Elite-Kleingruppe Korrektur') {
          yPosition += 4;
          addText('Klausurenkorrektur', margin + 25, yPosition);
          extraLines = 1;
        } else if (groupMatch) {
          yPosition += 4;
          addText(groupMatch[1], margin + 25, yPosition);
          extraLines = 1;
        }
        let desc;
        if (item.entry.category === 'Elite-Kleingruppe Korrektur' || item.entry.description?.includes('Elite-Kleingruppe')) {
          desc = item.entry.description?.startsWith('Klausurkorrektur:') 
            ? item.entry.description.replace('Klausurkorrektur:', '').trim().replace(/-\s*\d+\s*(?:Punkte|Punkte?)$/, '').trim()
            : item.entry.description || '-';
        } else {
          desc = item.entry.description || '-';
        }
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          lines.forEach((line: string, index: number) => {
            addText(line, margin + 70, descYPosition + (index * 4));
          });
          extraLines = Math.max(extraLines, lines.length - 1);
        } else {
          addText(desc, margin + 70, descYPosition);
        }
        addText(item.hours.toString(), pageWidth - margin - 15, descYPosition, { align: 'right' });
        totalDozentHours += item.hours;
        yPosition += 5 + (extraLines * 4);
      } else if (item.type === 'flatrate') {
        addText('Sonstiger Posten', margin + 25, yPosition);
        const descYPosition = yPosition;
        const desc = `${item.entry.name}${item.entry.description ? ' - ' + item.entry.description : ''}`;
        const maxWidth = pageWidth - margin - 20 - (margin + 70);
        if (desc.length > 50) {
          const lines = doc.splitTextToSize(desc, maxWidth);
          lines.forEach((line: string, index: number) => {
            addText(line, margin + 70, descYPosition + (index * 4));
          });
          yPosition += 5 + ((lines.length - 1) * 4);
        } else {
          addText(desc, margin + 70, descYPosition);
          yPosition += 5;
        }
        addText(`${item.entry.quantity} x ${item.entry.amount_euro.toFixed(2)}€`, pageWidth - margin - 2, descYPosition, { align: 'right' });
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