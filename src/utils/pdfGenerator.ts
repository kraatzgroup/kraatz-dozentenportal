interface CombinedHoursEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  legal_area?: string;
  teilnehmer_name?: string;
  type: 'participant' | 'dozent';
}

interface PDFData {
  dozentName: string;
  selectedMonth: number;
  selectedYear: number;
  combinedHours: CombinedHoursEntry[];
  totalHours: number;
}

export const generateTaetigkeitsberichtPDF = async (data: PDFData) => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = margin;
  
  // Helper function to check if we need a new page
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 30) { // Leave space for footer
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // Helper function to add text with proper encoding
  const addText = (text: string, x: number, y: number, options?: any) => {
    // Clean text to avoid encoding issues
    const cleanText = text.replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F]/g, '');
    doc.text(cleanText, x, y, options);
  };
  
  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  addText('Tätigkeitsbericht', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;
  
  // Dozent info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  addText(`Dozent: ${data.dozentName}`, margin, yPosition);
  yPosition += 10;
  
  // Month/Year
  const monthName = new Date(2023, data.selectedMonth - 1).toLocaleDateString('de-DE', { month: 'long' });
  addText(`Berichtszeitraum: ${monthName} ${data.selectedYear}`, margin, yPosition);
  yPosition += 10;
  
  // Generation date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  addText(`Erstellt am: ${new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, yPosition);
  yPosition += 20;
  
  // Summary box
  // Hours entries header
  checkPageBreak(20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  addText('Stundeneinträge', margin, yPosition);
  yPosition += 15;
  
  if (data.combinedHours.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    addText(`Fuer ${monthName} ${data.selectedYear} wurden keine Stunden eingetragen.`, margin, yPosition);
  } else {
    // Table setup
    const tableStartY = yPosition;
    const colWidths = {
      date: 22,
      type: 40,
      hours: 18,
      rechtsgebiet: 35,
      description: contentWidth - 115
    };
    
    // Table header
    checkPageBreak(12);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPosition, contentWidth, 10, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition, contentWidth, 10);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    
    let xPos = margin + 2;
    addText('Datum', xPos, yPosition + 7);
    xPos += colWidths.date;
    addText('Typ / Teilnehmer', xPos, yPosition + 7);
    xPos += colWidths.type;
    addText('Stunden', xPos, yPosition + 7);
    xPos += colWidths.hours;
    addText('Rechtsgebiet', xPos, yPosition + 7);
    xPos += colWidths.rechtsgebiet;
    addText('Beschreibung', xPos, yPosition + 7);
    
    yPosition += 10;
    
    // Table rows
    data.combinedHours.forEach((entry, index) => {
      const rowHeight = 12;
      checkPageBreak(rowHeight);
      
      // Alternating row colors
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition, contentWidth, rowHeight, 'F');
      }
      
      // Row border
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPosition, contentWidth, rowHeight);
      
      // Cell content
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      xPos = margin + 2;
      const cellY = yPosition + 8;
      
      // Date
      const formattedDate = new Date(entry.date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      addText(formattedDate, xPos, cellY);
      
      // Type/Participant
      xPos += colWidths.date;
      if (entry.type === 'participant') {
        addText(entry.teilnehmer_name || 'Unbekannt', xPos, cellY);
      } else {
        doc.setFont('helvetica', 'italic');
        addText('Sonstige Taetigkeit', xPos, cellY);
        doc.setFont('helvetica', 'normal');
      }
      
      // Hours
      xPos += colWidths.type;
      doc.setFont('helvetica', 'bold');
      addText(`${entry.hours}h`, xPos, cellY);
      doc.setFont('helvetica', 'normal');
      
      // Rechtsgebiet
      xPos += colWidths.hours;
      if (entry.type === 'participant' && entry.legal_area) {
        doc.setFontSize(8);
        addText(entry.legal_area, xPos, cellY);
        doc.setFontSize(9);
      } else if (entry.type === 'dozent') {
        doc.setFont('helvetica', 'italic');
        addText('-', xPos, cellY);
        doc.setFont('helvetica', 'normal');
      }
      
      // Description
      xPos += colWidths.rechtsgebiet;
      if (entry.description) {
        const maxDescWidth = colWidths.description - 4;
        const lines = doc.splitTextToSize(entry.description, maxDescWidth);
        const maxLines = 1; // Limit to 1 line per row due to reduced height
        const displayLines = lines.slice(0, maxLines);
        
        addText(displayLines[0] || '', xPos, cellY);
        
        if (lines.length > maxLines) {
          addText('...', xPos + doc.getTextWidth(displayLines[maxLines - 1]) + 2, cellY + ((maxLines - 1) * 4));
        }
      }
      
      yPosition += rowHeight;
    });
    
    // Total sum row at end of table
    checkPageBreak(16);
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPosition, contentWidth, 12, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition, contentWidth, 12);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Position "GESAMT:" and total hours in the right bottom corner
    const totalText = `GESAMT: ${data.totalHours}h`;
    const totalTextWidth = doc.getTextWidth(totalText);
    const totalTextX = margin + contentWidth - totalTextWidth - 5;
    addText(totalText, totalTextX, yPosition + 8);
    
    yPosition += 12;
  }
  
  // Footer on every page
  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Company info
    addText('Akademie Kraatz GmbH | Wilmersdorfer Str. 145/146 - 10585 Berlin', pageWidth / 2, footerY - 8, { align: 'center' });
    addText('Tel: 030 756 573 97 | E-Mail: info@kraatz-group.de | Web: www.kraatz-group.de', pageWidth / 2, footerY - 3, { align: 'center' });
    
    // Page number
    addText(`Seite ${pageNum} von ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  };
  
  // Add footer to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }
  
  // Generate filename
  const filename = `Taetigkeitsbericht_${monthName}_${data.selectedYear}_${data.dozentName.replace(/\s+/g, '_')}.pdf`;
  
  // Save the PDF
  doc.save(filename);
};

interface TeilnehmerHours {
  id: string;
  hours: number;
  date: string;
  description: string;
  legal_area: string;
  created_at: string;
  dozent_name: string;
  dozent_email: string;
}

interface TeilnehmerPDFData {
  teilnehmerName: string;
  hours: TeilnehmerHours[];
  totalHours: number;
  uniqueDozenten: string[];
}

export const generateTeilnehmerStundenPDF = async (data: TeilnehmerPDFData) => {
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  
  let yPosition = margin;
  
  // Helper function to check if we need a new page
  const checkPageBreak = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin - 30) { // Leave space for footer
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };
  
  // Helper function to add text with proper encoding
  const addText = (text: string, x: number, y: number, options?: any) => {
    // Clean text to avoid encoding issues
    const cleanText = text.replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F]/g, '');
    doc.text(cleanText, x, y, options);
  };
  
  // Header
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  addText('Stundenübersicht', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;
  
  // Teilnehmer info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  addText(`Teilnehmer: ${data.teilnehmerName}`, margin, yPosition);
  yPosition += 10;
  
  // Generation date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  addText(`Erstellt am: ${new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, margin, yPosition);
  yPosition += 20;
  
  // Summary section
  checkPageBreak(40);
  doc.setFillColor(240, 248, 255);
  doc.rect(margin, yPosition, contentWidth, 35, 'F');
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition, contentWidth, 35);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  addText('Zusammenfassung', margin + 5, yPosition + 10);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  addText(`Gesamtstunden: ${data.totalHours.toFixed(2)}h`, margin + 5, yPosition + 20);
  addText(`Anzahl Einträge: ${data.hours.length}`, margin + 5, yPosition + 28);
  addText(`Anzahl Dozenten: ${data.uniqueDozenten.length}`, margin + 100, yPosition + 20);
  
  // List dozenten with proper text wrapping
  const dozentenText = data.uniqueDozenten.join(', ');
  const maxDozentenWidth = contentWidth - 105;
  const dozentenLines = doc.splitTextToSize(`Dozenten: ${dozentenText}`, maxDozentenWidth);
  
  // Display all lines of dozenten names
  dozentenLines.forEach((line, index) => {
    addText(line, margin + 100, yPosition + 28 + (index * 6));
  });
  
  // Adjust yPosition based on number of lines used
  const extraLines = Math.max(0, dozentenLines.length - 1);
  yPosition += extraLines * 6;
  
  yPosition += 45;
  
  // Hours entries header
  checkPageBreak(20);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  addText('Alle Stundeneinträge (chronologisch)', margin, yPosition);
  yPosition += 15;
  
  if (data.hours.length === 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'italic');
    addText('Keine Stundeneinträge vorhanden.', margin, yPosition);
  } else {
    // Table setup
    const colWidths = {
      date: 22,
      dozent: 35,
      hours: 18,
      rechtsgebiet: 30,
      description: contentWidth - 105
    };
    
    // Table header
    checkPageBreak(12);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPosition, contentWidth, 10, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition, contentWidth, 10);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60, 60, 60);
    
    let xPos = margin + 2;
    addText('Datum', xPos, yPosition + 7);
    xPos += colWidths.date;
    addText('Dozent', xPos, yPosition + 7);
    xPos += colWidths.dozent;
    addText('Stunden', xPos, yPosition + 7);
    xPos += colWidths.hours;
    addText('Rechtsgebiet', xPos, yPosition + 7);
    xPos += colWidths.rechtsgebiet;
    addText('Beschreibung', xPos, yPosition + 7);
    
    yPosition += 10;
    
    // Table rows
    data.hours.forEach((entry, index) => {
      const rowHeight = 12;
      checkPageBreak(rowHeight);
      
      // Alternating row colors
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition, contentWidth, rowHeight, 'F');
      }
      
      // Row border
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.rect(margin, yPosition, contentWidth, rowHeight);
      
      // Cell content
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      
      xPos = margin + 2;
      const cellY = yPosition + 8;
      
      // Date
      const formattedDate = new Date(entry.date).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      addText(formattedDate, xPos, cellY);
      
      // Dozent
      xPos += colWidths.date;
      addText(entry.dozent_name, xPos, cellY);
      
      // Hours
      xPos += colWidths.dozent;
      doc.setFont('helvetica', 'bold');
      addText(`${entry.hours}h`, xPos, cellY);
      doc.setFont('helvetica', 'normal');
      
      // Rechtsgebiet
      xPos += colWidths.hours;
      if (entry.legal_area) {
        doc.setFontSize(8);
        addText(entry.legal_area, xPos, cellY);
        doc.setFontSize(9);
      } else {
        doc.setFont('helvetica', 'italic');
        addText('-', xPos, cellY);
        doc.setFont('helvetica', 'normal');
      }
      
      // Description
      xPos += colWidths.rechtsgebiet;
      if (entry.description) {
        const maxDescWidth = colWidths.description - 4;
        const lines = doc.splitTextToSize(entry.description, maxDescWidth);
        const maxLines = 1; // Limit to 1 line per row
        const displayLines = lines.slice(0, maxLines);
        
        addText(displayLines[0] || '', xPos, cellY);
        
        if (lines.length > maxLines) {
          addText('...', xPos + doc.getTextWidth(displayLines[0]) + 2, cellY);
        }
      }
      
      yPosition += rowHeight;
    });
    
    // Total sum row at end of table
    checkPageBreak(16);
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, yPosition, contentWidth, 12, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPosition, contentWidth, 12);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    
    // Position total in the right bottom corner
    const totalText = `GESAMT: ${data.totalHours.toFixed(2)}h`;
    const totalTextWidth = doc.getTextWidth(totalText);
    const totalTextX = margin + contentWidth - totalTextWidth - 5;
    addText(totalText, totalTextX, yPosition + 8);
    
    yPosition += 12;
  }
  
  // Footer on every page
  const addFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Company info
    addText('Akademie Kraatz GmbH | Wilmersdorfer Str. 145/146 - 10585 Berlin', pageWidth / 2, footerY - 8, { align: 'center' });
    addText('Tel: 030 756 573 97 | E-Mail: info@kraatz-group.de | Web: www.kraatz-group.de', pageWidth / 2, footerY - 3, { align: 'center' });
    
    // Page number
    addText(`Seite ${pageNum} von ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  };
  
  // Add footer to all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addFooter(i, pageCount);
  }
  
  // Generate filename
  const filename = `Stundenübersicht_${data.teilnehmerName.replace(/\s+/g, '_')}_Gesamt.pdf`;
  
  // Save the PDF
  doc.save(filename);
};