import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Upload, FileText, Download, Eye, Settings, Save, Trash2, Plus, Minus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';

interface ContractData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  study_goal: string;
  exam_date: string;
  state_law: string;
  legal_areas: string[];
  booked_hours: number | null;
}

interface PlaceholderMapping {
  placeholder: string;
  field: keyof ContractData | 'full_name' | 'full_address' | 'legal_areas_text' | 'current_date';
  label: string;
}

const DEFAULT_PLACEHOLDERS: PlaceholderMapping[] = [
  { placeholder: '{{VORNAME}}', field: 'first_name', label: 'Vorname' },
  { placeholder: '{{NACHNAME}}', field: 'last_name', label: 'Nachname' },
  { placeholder: '{{VOLLSTÄNDIGER_NAME}}', field: 'full_name', label: 'Vollständiger Name' },
  { placeholder: '{{EMAIL}}', field: 'email', label: 'E-Mail' },
  { placeholder: '{{TELEFON}}', field: 'phone', label: 'Telefon' },
  { placeholder: '{{STRASSE}}', field: 'street', label: 'Straße' },
  { placeholder: '{{HAUSNUMMER}}', field: 'house_number', label: 'Hausnummer' },
  { placeholder: '{{PLZ}}', field: 'postal_code', label: 'PLZ' },
  { placeholder: '{{STADT}}', field: 'city', label: 'Stadt' },
  { placeholder: '{{VOLLSTÄNDIGE_ADRESSE}}', field: 'full_address', label: 'Vollständige Adresse' },
  { placeholder: '{{STUDIENZIEL}}', field: 'study_goal', label: 'Studienziel' },
  { placeholder: '{{PRÜFUNGSTERMIN}}', field: 'exam_date', label: 'Prüfungstermin' },
  { placeholder: '{{LANDESRECHT}}', field: 'state_law', label: 'Landesrecht' },
  { placeholder: '{{RECHTSGEBIETE}}', field: 'legal_areas_text', label: 'Rechtsgebiete' },
  { placeholder: '{{STUNDEN}}', field: 'booked_hours', label: 'Gebuchte Stunden' },
  { placeholder: '{{AKTUELLES_DATUM}}', field: 'current_date', label: 'Aktuelles Datum' },
];

interface ContractTemplateEditorProps {
  contractData?: ContractData;
  onClose: () => void;
  onGenerate?: (pdfBlob: Blob) => void;
}

interface SavedTemplate {
  id: string;
  name: string;
  file_path: string;
  placeholders?: PlaceholderPosition[];
  created_at: string;
}

interface PlaceholderPosition {
  id: string;
  field: PlaceholderMapping['field'];
  label: string;
  x: number; // absolute PDF coordinate from left (in points)
  y: number; // absolute PDF coordinate from bottom (in points)
  page: number;
  fontSize: number;
}

export function ContractTemplateEditor({ contractData, onClose, onGenerate }: ContractTemplateEditorProps) {
  const { addToast } = useToastStore();
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePdfBytes, setTemplatePdfBytes] = useState<Uint8Array | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'saved'>('saved');
  const [editMode, setEditMode] = useState(false);
  const [placedPlaceholders, setPlacedPlaceholders] = useState<PlaceholderPosition[]>([]);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<PlaceholderMapping | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [pdfPageSize, setPdfPageSize] = useState<{ width: number; height: number } | null>(null);
  const [manualCoords, setManualCoords] = useState<{ x: string; y: string }>({ x: '200', y: '650' });
  // Template positions: predefined positions for each field type (saved with template)
  const [templatePositions, setTemplatePositions] = useState<Record<string, { x: number; y: number; fontSize: number }>>({});
  const [positionEditMode, setPositionEditMode] = useState(false); // Mode to define positions in template

  // Fetch saved templates
  useEffect(() => {
    fetchSavedTemplates();
  }, []);

  const fetchSavedTemplates = async () => {
    const { data, error } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSavedTemplates(data);
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setTemplateFile(file);
      setTemplateName(file.name.replace('.pdf', ''));
      
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      setTemplatePdfBytes(pdfBytes);
      
      // Extract PDF page size
      try {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const firstPage = pdfDoc.getPages()[0];
        const { width, height } = firstPage.getSize();
        setPdfPageSize({ width, height });
      } catch (e) {
        console.error('Error reading PDF size:', e);
      }
      
      // Create preview URL
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      setPreviewUrl(URL.createObjectURL(blob));
      
      addToast('PDF-Vorlage geladen', 'success');
    } else {
      addToast('Bitte nur PDF-Dateien hochladen', 'error');
    }
  }, [addToast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  const loadSavedTemplate = async (template: SavedTemplate) => {
    try {
      const { data, error } = await supabase.storage
        .from('contract-templates')
        .download(template.file_path);
      
      if (error) throw error;
      
      const arrayBuffer = await data.arrayBuffer();
      const pdfBytes = new Uint8Array(arrayBuffer);
      setTemplatePdfBytes(pdfBytes);
      setSelectedTemplateId(template.id);
      setTemplateName(template.name);
      
      // Load saved placeholders and extract template positions
      const savedPlaceholders = template.placeholders || [];
      setPlacedPlaceholders([]);
      
      // Build template positions from saved placeholders
      const positions: Record<string, { x: number; y: number; fontSize: number }> = {};
      savedPlaceholders.forEach(p => {
        positions[p.field] = { x: p.x, y: p.y, fontSize: p.fontSize };
      });
      setTemplatePositions(positions);
      
      // Extract PDF page size
      try {
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const firstPage = pdfDoc.getPages()[0];
        const { width, height } = firstPage.getSize();
        setPdfPageSize({ width, height });
      } catch (e) {
        console.error('Error reading PDF size:', e);
      }
      
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      setPreviewUrl(URL.createObjectURL(blob));
      
      addToast(`Vorlage "${template.name}" geladen`, 'success');
    } catch (error) {
      console.error('Error loading template:', error);
      addToast('Fehler beim Laden der Vorlage', 'error');
    }
  };

  // Handle click on PDF preview to add placeholder or define position
  const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedPlaceholder || !pdfPageSize) return;
    
    const container = previewContainerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    // Calculate percentage position in the preview container
    const percentX = (e.clientX - rect.left) / rect.width;
    const percentY = (e.clientY - rect.top) / rect.height;
    
    // Convert to absolute PDF coordinates
    // X: percentage * page width
    // Y: PDF coordinates are from bottom, so we invert: (1 - percentY) * page height
    const pdfX = Math.round(percentX * pdfPageSize.width);
    const pdfY = Math.round((1 - percentY) * pdfPageSize.height);
    
    if (positionEditMode) {
      // In position edit mode: save position for this field type in template
      setTemplatePositions(prev => ({
        ...prev,
        [selectedPlaceholder.field]: { x: pdfX, y: pdfY, fontSize: 12 }
      }));
      addToast(`Position für "${selectedPlaceholder.label}" festgelegt: (${pdfX}, ${pdfY})`, 'success');
      setSelectedPlaceholder(null);
    } else if (editMode) {
      // In edit mode: add placeholder directly
      const newPlaceholder: PlaceholderPosition = {
        id: `ph_${Date.now()}`,
        field: selectedPlaceholder.field,
        label: selectedPlaceholder.label,
        x: pdfX,
        y: pdfY,
        page: 0,
        fontSize: 12
      };
      
      setPlacedPlaceholders(prev => [...prev, newPlaceholder]);
      addToast(`Platzhalter "${selectedPlaceholder.label}" bei (${pdfX}, ${pdfY}) hinzugefügt`, 'success');
    }
  };

  // Remove a placed placeholder
  const removePlaceholder = (id: string) => {
    setPlacedPlaceholders(prev => prev.filter(p => p.id !== id));
  };

  // Update placeholder position via drag
  const handlePlaceholderDrag = (id: string, e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setDraggingId(id);
    
    const container = previewContainerRef.current;
    if (!container) return;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((moveEvent.clientY - rect.top) / rect.height) * 100));
      
      setPlacedPlaceholders(prev => prev.map(p => 
        p.id === id ? { ...p, x, y } : p
      ));
    };
    
    const handleMouseUp = () => {
      setDraggingId(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Update placeholder font size
  const updatePlaceholderFontSize = (id: string, delta: number) => {
    setPlacedPlaceholders(prev => prev.map(p => 
      p.id === id ? { ...p, fontSize: Math.max(6, Math.min(24, p.fontSize + delta)) } : p
    ));
  };

  // Save template with placeholders (from templatePositions)
  const saveTemplateWithPlaceholders = async () => {
    if (!selectedTemplateId) {
      addToast('Bitte zuerst eine Vorlage speichern', 'error');
      return;
    }
    
    // Convert templatePositions to PlaceholderPosition array for storage
    const positionsToSave: PlaceholderPosition[] = Object.entries(templatePositions).map(([field, pos]) => {
      const mapping = DEFAULT_PLACEHOLDERS.find(p => p.field === field);
      return {
        id: `pos_${field}`,
        field: field as PlaceholderMapping['field'],
        label: mapping?.label || field,
        x: pos.x,
        y: pos.y,
        page: 0,
        fontSize: pos.fontSize
      };
    });
    
    try {
      const { error } = await supabase
        .from('contract_templates')
        .update({ placeholders: positionsToSave })
        .eq('id', selectedTemplateId);
      
      if (error) throw error;
      
      addToast('Positionen gespeichert', 'success');
      fetchSavedTemplates();
      setPositionEditMode(false);
    } catch (error) {
      console.error('Error saving placeholders:', error);
      addToast('Fehler beim Speichern der Positionen', 'error');
    }
  };

  const saveTemplate = async () => {
    if (!templatePdfBytes || !templateName.trim()) {
      addToast('Bitte Vorlage und Namen angeben', 'error');
      return;
    }

    try {
      const fileName = `${Date.now()}_${templateName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      
      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('contract-templates')
        .upload(fileName, templatePdfBytes, {
          contentType: 'application/pdf'
        });
      
      if (uploadError) throw uploadError;
      
      // Save reference in database
      const { error: dbError } = await supabase
        .from('contract_templates')
        .insert({
          name: templateName.trim(),
          file_path: fileName
        });
      
      if (dbError) throw dbError;
      
      addToast('Vorlage gespeichert', 'success');
      fetchSavedTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      addToast('Fehler beim Speichern der Vorlage', 'error');
    }
  };

  const deleteTemplate = async (template: SavedTemplate) => {
    if (!confirm(`Vorlage "${template.name}" wirklich löschen?`)) return;
    
    try {
      // Delete from storage
      await supabase.storage
        .from('contract-templates')
        .remove([template.file_path]);
      
      // Delete from database
      await supabase
        .from('contract_templates')
        .delete()
        .eq('id', template.id);
      
      addToast('Vorlage gelöscht', 'success');
      fetchSavedTemplates();
      
      if (selectedTemplateId === template.id) {
        setTemplatePdfBytes(null);
        setPreviewUrl(null);
        setSelectedTemplateId(null);
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      addToast('Fehler beim Löschen der Vorlage', 'error');
    }
  };

  const getFieldValue = (field: PlaceholderMapping['field']): string => {
    if (!contractData) return `[${field}]`;
    
    switch (field) {
      case 'full_name':
        return `${contractData.first_name} ${contractData.last_name}`.trim();
      case 'full_address': {
        const parts = [
          contractData.street && contractData.house_number 
            ? `${contractData.street} ${contractData.house_number}` 
            : contractData.street,
          contractData.postal_code && contractData.city 
            ? `${contractData.postal_code} ${contractData.city}` 
            : contractData.city
        ].filter(Boolean);
        return parts.join(', ');
      }
      case 'legal_areas_text':
        return contractData.legal_areas?.join(', ') || '';
      case 'current_date':
        return new Date().toLocaleDateString('de-DE');
      case 'exam_date':
        return contractData.exam_date 
          ? new Date(contractData.exam_date).toLocaleDateString('de-DE') 
          : '';
      case 'booked_hours':
        return contractData.booked_hours?.toString() || '';
      default:
        return (contractData[field as keyof ContractData] as string) || '';
    }
  };

  const generateContract = async () => {
    if (!templatePdfBytes) {
      addToast('Bitte zuerst eine Vorlage laden', 'error');
      return;
    }

    // Check if we have placeholders
    if (placedPlaceholders.length === 0) {
      addToast('Bitte zuerst Platzhalter im Bearbeitungsmodus positionieren', 'error');
      return;
    }

    // Debug: Show placeholders before generating
    console.log('=== GENERATING CONTRACT ===');
    console.log('Number of placeholders:', placedPlaceholders.length);
    placedPlaceholders.forEach((p, i) => {
      console.log(`Placeholder ${i + 1}: ${p.label} at X=${p.x}, Y=${p.y}`);
    });

    setIsGenerating(true);

    try {
      // Load the PDF
      const pdfDoc = await PDFDocument.load(templatePdfBytes);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Get all pages
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      
      // Get page size for coordinate validation
      const pageSize = firstPage.getSize();
      console.log('PDF Page size:', pageSize);
      
      // Place all placeholders at their defined positions (using absolute PDF coordinates)
      console.log('Placing placeholders:', placedPlaceholders);
      console.log('Page size:', pageSize.width, 'x', pageSize.height);
      
      placedPlaceholders.forEach(placeholder => {
        const value = getFieldValue(placeholder.field);
        
        if (value) {
          const page = pages[placeholder.page] || firstPage;
          
          // Calculate text width to center the text horizontally
          const textWidth = helveticaFont.widthOfTextAtSize(value, placeholder.fontSize);
          
          // Center horizontally only - Y stays as specified (from bottom)
          const centeredX = placeholder.x - (textWidth / 2);
          const y = placeholder.y;
          
          console.log(`Placeholder ${placeholder.label}: x=${centeredX}, y=${y}, value=${value}`);
          
          page.drawText(value, {
            x: centeredX,
            y: y,
            size: placeholder.fontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          });
        }
      });
      
      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: 'application/pdf' });
      
      // Create download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Vertrag_${contractData?.first_name || 'Teilnehmer'}_${contractData?.last_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      addToast('Vertrag wurde generiert und heruntergeladen', 'success');
      
      if (onGenerate) {
        onGenerate(blob);
      }
    } catch (error) {
      console.error('Error generating contract:', error);
      addToast('Fehler beim Generieren des Vertrags', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-primary mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Vertrag generieren</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Template Selection */}
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'saved'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Gespeicherte Vorlagen
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'upload'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Neue Vorlage hochladen
                </button>
              </div>

              {activeTab === 'upload' && (
                <div className="space-y-4">
                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-300 hover:border-primary'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                    {isDragActive ? (
                      <p className="text-primary">PDF hier ablegen...</p>
                    ) : (
                      <>
                        <p className="text-gray-600 mb-1">PDF-Vorlage hierher ziehen</p>
                        <p className="text-sm text-gray-400">oder klicken zum Auswählen</p>
                      </>
                    )}
                  </div>

                  {templateFile && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={templateName}
                          onChange={(e) => setTemplateName(e.target.value)}
                          placeholder="Vorlagenname"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={saveTemplate}
                          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 flex items-center"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Speichern
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'saved' && (
                <div className="space-y-2">
                  {savedTemplates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p>Keine Vorlagen gespeichert</p>
                      <button
                        onClick={() => setActiveTab('upload')}
                        className="mt-2 text-primary hover:underline text-sm"
                      >
                        Erste Vorlage hochladen
                      </button>
                    </div>
                  ) : (
                    savedTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                          selectedTemplateId === template.id
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => loadSavedTemplate(template)}
                      >
                        <div className="flex items-center">
                          <FileText className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <p className="font-medium text-gray-900">{template.name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(template.created_at).toLocaleDateString('de-DE')}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(template);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Stammdaten des Teilnehmers - Klickbar zum Einfügen */}
              {contractData && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <Eye className="h-4 w-4 mr-2" />
                    Stammdaten des Teilnehmers
                  </h4>
                  <p className="text-xs text-gray-500 mb-2">
                    {editMode ? 'Klicke auf ein Feld, um es als Platzhalter auszuwählen:' : 'Aktiviere den Bearbeitungsmodus, um Platzhalter einzufügen.'}
                  </p>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: 'Vorname', value: contractData.first_name, field: 'first_name' as const },
                      { label: 'Nachname', value: contractData.last_name, field: 'last_name' as const },
                      { label: 'Vollständiger Name', value: getFieldValue('full_name'), field: 'full_name' as const },
                      { label: 'E-Mail', value: contractData.email, field: 'email' as const },
                      { label: 'Telefon', value: contractData.phone, field: 'phone' as const },
                      { label: 'Straße', value: contractData.street, field: 'street' as const },
                      { label: 'Hausnummer', value: contractData.house_number, field: 'house_number' as const },
                      { label: 'PLZ', value: contractData.postal_code, field: 'postal_code' as const },
                      { label: 'Stadt', value: contractData.city, field: 'city' as const },
                      { label: 'Vollständige Adresse', value: getFieldValue('full_address'), field: 'full_address' as const },
                      { label: 'Studienziel', value: contractData.study_goal, field: 'study_goal' as const },
                      { label: 'Prüfungstermin', value: getFieldValue('exam_date'), field: 'exam_date' as const },
                      { label: 'Landesrecht', value: contractData.state_law, field: 'state_law' as const },
                      { label: 'Rechtsgebiete', value: getFieldValue('legal_areas_text'), field: 'legal_areas_text' as const },
                      { label: 'Gebuchte Stunden', value: contractData.booked_hours?.toString(), field: 'booked_hours' as const },
                      { label: 'Aktuelles Datum', value: getFieldValue('current_date'), field: 'current_date' as const },
                    ].map((item) => {
                      const placeholder = DEFAULT_PLACEHOLDERS.find(p => p.field === item.field);
                      const isSelected = selectedPlaceholder?.field === item.field;
                      const hasPosition = templatePositions[item.field] !== undefined;
                      const isPlaced = placedPlaceholders.some(p => p.field === item.field);
                      
                      return (
                        <div
                          key={item.field}
                          onClick={() => {
                            if (!placeholder) return;
                            
                            if (positionEditMode) {
                              // In position edit mode: select field to define its position
                              setSelectedPlaceholder(isSelected ? null : placeholder);
                            } else if (hasPosition && !isPlaced) {
                              // Has predefined position: add placeholder at that position
                              const pos = templatePositions[item.field];
                              const newPlaceholder: PlaceholderPosition = {
                                id: `ph_${Date.now()}`,
                                field: item.field,
                                label: item.label,
                                x: pos.x,
                                y: pos.y,
                                page: 0,
                                fontSize: pos.fontSize
                              };
                              setPlacedPlaceholders(prev => [...prev, newPlaceholder]);
                              addToast(`${item.label} hinzugefügt`, 'success');
                            } else if (isPlaced) {
                              // Already placed: remove it
                              setPlacedPlaceholders(prev => prev.filter(p => p.field !== item.field));
                              addToast(`${item.label} entfernt`, 'success');
                            } else if (editMode) {
                              // No position defined, in edit mode: select for manual positioning
                              setSelectedPlaceholder(isSelected ? null : placeholder);
                            }
                          }}
                          className={`flex justify-between items-center p-2 rounded-lg border transition-colors cursor-pointer ${
                            isPlaced
                              ? 'border-green-500 bg-green-50'
                              : isSelected
                                ? 'border-primary bg-primary/10'
                                : hasPosition
                                  ? 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                                  : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            {isPlaced && <span className="text-green-600">✓</span>}
                            {hasPosition && !isPlaced && <span className="text-blue-500 text-xs">●</span>}
                            <span className="text-gray-500 text-xs">{item.label}:</span>
                          </div>
                          <span className={`font-medium text-right ${isPlaced ? 'text-green-700' : isSelected ? 'text-primary' : ''}`}>
                            {item.value || '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mode Toggle */}
              <div className="border-t pt-4 space-y-3">
                {previewUrl && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setPositionEditMode(!positionEditMode); setEditMode(false); }}
                        className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          positionEditMode 
                            ? 'bg-orange-500 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        {positionEditMode ? 'Positionen definieren' : 'Positionen festlegen'}
                      </button>
                      {positionEditMode && Object.keys(templatePositions).length > 0 && (
                        <button
                          onClick={saveTemplateWithPlaceholders}
                          className="flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Speichern
                        </button>
                      )}
                    </div>
                    
                    {positionEditMode && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs text-orange-700 space-y-2">
                        <p className="font-medium">Positions-Modus aktiv</p>
                        <p>Wähle ein Feld links aus und gib die Koordinaten ein:</p>
                        {pdfPageSize && (
                          <div className="text-gray-500 space-y-1">
                            <p>PDF-Größe: {Math.round(pdfPageSize.width)} × {Math.round(pdfPageSize.height)} Punkte</p>
                            <p className="text-xs">
                              <strong>Hinweis:</strong> Y=0 ist unten, Y={Math.round(pdfPageSize.height)} ist oben.
                            </p>
                            <div className="text-xs bg-white p-1 rounded border">
                              <p>Typische Positionen für A4:</p>
                              <p>• Nach "TN": X≈297, Y≈720</p>
                              <p>• Nach "und": X≈297, Y≈620</p>
                              <p>• Mitte Seite: X≈297, Y≈421</p>
                            </div>
                          </div>
                        )}
                        
                        {selectedPlaceholder && (
                          <div className="bg-white border border-orange-300 rounded p-2 space-y-2">
                            <p className="font-medium text-orange-800">{selectedPlaceholder.label}</p>
                            <div className="flex gap-2 items-end">
                              <div>
                                <label className="text-xs text-gray-600">X:</label>
                                <input
                                  type="number"
                                  value={manualCoords.x}
                                  onChange={(e) => setManualCoords(prev => ({ ...prev, x: e.target.value }))}
                                  className="w-16 px-2 py-1 text-sm border rounded"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-600">Y:</label>
                                <input
                                  type="number"
                                  value={manualCoords.y}
                                  onChange={(e) => setManualCoords(prev => ({ ...prev, y: e.target.value }))}
                                  className="w-16 px-2 py-1 text-sm border rounded"
                                />
                              </div>
                              <button
                                onClick={() => {
                                  const x = parseFloat(manualCoords.x) || 297;
                                  const y = parseFloat(manualCoords.y) || 600;
                                  setTemplatePositions(prev => ({
                                    ...prev,
                                    [selectedPlaceholder.field]: { x, y, fontSize: 12 }
                                  }));
                                  addToast(`Position für "${selectedPlaceholder.label}" gesetzt: (${x}, ${y})`, 'success');
                                  setSelectedPlaceholder(null);
                                }}
                                className="px-2 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
                              >
                                Setzen
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {Object.keys(templatePositions).length > 0 && (
                          <div className="space-y-1 mt-2">
                            <p className="font-medium text-orange-800">Definierte Positionen:</p>
                            {Object.entries(templatePositions).map(([field, pos]) => {
                              const mapping = DEFAULT_PLACEHOLDERS.find(p => p.field === field);
                              return (
                                <div key={field} className="flex items-center justify-between bg-white px-2 py-1 rounded border">
                                  <span className="text-gray-700">{mapping?.label || field}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">X:{pos.x} Y:{pos.y}</span>
                                    <button
                                      onClick={() => {
                                        setManualCoords({ x: pos.x.toString(), y: pos.y.toString() });
                                        const placeholder = DEFAULT_PLACEHOLDERS.find(p => p.field === field);
                                        if (placeholder) setSelectedPlaceholder(placeholder);
                                      }}
                                      className="text-blue-500 hover:text-blue-700 text-xs"
                                    >
                                      Bearbeiten
                                    </button>
                                    <button
                                      onClick={() => {
                                        setTemplatePositions(prev => {
                                          const newPos = { ...prev };
                                          delete newPos[field];
                                          return newPos;
                                        });
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!positionEditMode && Object.keys(templatePositions).length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-xs text-green-700">
                        <p className="font-medium">✓ {Object.keys(templatePositions).length} Positionen definiert</p>
                        <p>Klicke auf die Stammdaten links, um sie einzufügen.</p>
                      </div>
                    )}
                  </div>
                )}

                {editMode && selectedPlaceholder && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-blue-700 font-medium">
                      Ausgewählt: <span className="font-bold">{selectedPlaceholder.label}</span>
                    </p>
                    <p className="text-xs text-blue-600">
                      Gib die PDF-Koordinaten ein (X von links, Y von unten in Punkten):
                    </p>
                    {pdfPageSize && (
                      <p className="text-xs text-gray-500">
                        PDF-Größe: {Math.round(pdfPageSize.width)} × {Math.round(pdfPageSize.height)} Punkte
                      </p>
                    )}
                    <div className="flex gap-2 items-end">
                      <div>
                        <label className="text-xs text-gray-600">X:</label>
                        <input
                          type="number"
                          value={manualCoords.x}
                          onChange={(e) => setManualCoords(prev => ({ ...prev, x: e.target.value }))}
                          className="w-20 px-2 py-1 text-sm border rounded"
                          placeholder="50"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Y:</label>
                        <input
                          type="number"
                          value={manualCoords.y}
                          onChange={(e) => setManualCoords(prev => ({ ...prev, y: e.target.value }))}
                          className="w-20 px-2 py-1 text-sm border rounded"
                          placeholder="700"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const x = parseFloat(manualCoords.x) || 50;
                          const y = parseFloat(manualCoords.y) || 700;
                          const newPlaceholder: PlaceholderPosition = {
                            id: `ph_${Date.now()}`,
                            field: selectedPlaceholder.field,
                            label: selectedPlaceholder.label,
                            x,
                            y,
                            page: 0,
                            fontSize: 12
                          };
                          setPlacedPlaceholders(prev => [...prev, newPlaceholder]);
                          addToast(`Platzhalter "${selectedPlaceholder.label}" bei (${x}, ${y}) hinzugefügt`, 'success');
                        }}
                        className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
                      >
                        Hinzufügen
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setShowPlaceholders(!showPlaceholders)}
                  className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Platzhalter-Referenz {showPlaceholders ? 'ausblenden' : 'anzeigen'}
                </button>
                
                {showPlaceholders && (
                  <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1 max-h-48 overflow-y-auto">
                    <p className="font-medium text-gray-700 mb-2">
                      Verfügbare Platzhalter:
                    </p>
                    {DEFAULT_PLACEHOLDERS.map((p) => (
                      <div key={p.placeholder} className="flex justify-between">
                        <code className="bg-gray-200 px-1 rounded">{p.placeholder}</code>
                        <span className="text-gray-500">{p.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-4">
              {/* PDF Preview with Placeholder Overlay */}
              {previewUrl && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 flex items-center justify-between">
                    <span>Vorschau: {templateName}</span>
                    <div className="flex items-center gap-2">
                      {positionEditMode && selectedPlaceholder && (
                        <span className="text-xs text-orange-600 bg-orange-100 px-2 py-0.5 rounded">
                          Klicke für Position: {selectedPlaceholder.label}
                        </span>
                      )}
                      {!positionEditMode && Object.keys(templatePositions).length > 0 && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                          {Object.keys(templatePositions).length} Positionen
                        </span>
                      )}
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        In neuem Tab öffnen
                      </a>
                    </div>
                  </div>
                  <div 
                    ref={previewContainerRef}
                    className={`relative ${(positionEditMode || editMode) && selectedPlaceholder ? 'cursor-crosshair' : ''}`}
                    onClick={handlePreviewClick}
                    style={{ height: '500px' }}
                  >
                    <iframe
                      src={previewUrl}
                      className="w-full h-full border-0 pointer-events-none"
                      title="PDF Preview"
                    />
                    
                    {/* Template Positions Overlay - Show defined positions (blue/dashed) - Draggable */}
                    {pdfPageSize && Object.entries(templatePositions).map(([field, pos]) => {
                      const leftPercent = (pos.x / pdfPageSize.width) * 100;
                      const topPercent = (1 - (pos.y / pdfPageSize.height)) * 100;
                      const mapping = DEFAULT_PLACEHOLDERS.find(p => p.field === field);
                      const isPlaced = placedPlaceholders.some(p => p.field === field);
                      
                      // Don't show if already placed (will show as green instead)
                      if (isPlaced) return null;
                      
                      const handleTemplateDrag = (e: React.MouseEvent) => {
                        if (!positionEditMode) return;
                        e.stopPropagation();
                        
                        const container = previewContainerRef.current;
                        if (!container || !pdfPageSize) return;
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const rect = container.getBoundingClientRect();
                          const percentX = (moveEvent.clientX - rect.left) / rect.width;
                          const percentY = (moveEvent.clientY - rect.top) / rect.height;
                          
                          const pdfX = Math.round(percentX * pdfPageSize.width);
                          const pdfY = Math.round((1 - percentY) * pdfPageSize.height);
                          
                          setTemplatePositions(prev => ({
                            ...prev,
                            [field]: { ...prev[field], x: pdfX, y: pdfY }
                          }));
                        };
                        
                        const handleMouseUp = () => {
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      };
                      
                      return (
                        <div
                          key={`template_${field}`}
                          className={`absolute bg-blue-100/80 border-2 border-dashed border-blue-400 px-1 py-0.5 rounded text-xs select-none whitespace-nowrap ${
                            positionEditMode ? 'cursor-move hover:bg-blue-200/90 hover:border-blue-500' : ''
                          }`}
                          style={{
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`,
                            transform: 'translate(-50%, -50%)',
                            fontSize: `${Math.max(8, pos.fontSize * 0.8)}px`
                          }}
                          onMouseDown={handleTemplateDrag}
                        >
                          <span className="text-blue-600 font-medium">[{mapping?.label || field}]</span>
                          {positionEditMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTemplatePositions(prev => {
                                  const newPositions = { ...prev };
                                  delete newPositions[field];
                                  return newPositions;
                                });
                                addToast(`Position für "${mapping?.label || field}" entfernt`, 'success');
                              }}
                              className="ml-1 text-red-500 hover:text-red-700"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* Placed Placeholders Overlay - Show actual values (yellow/solid) */}
                    {pdfPageSize && placedPlaceholders.map((placeholder) => {
                      const leftPercent = (placeholder.x / pdfPageSize.width) * 100;
                      const topPercent = (1 - (placeholder.y / pdfPageSize.height)) * 100;
                      const displayValue = getFieldValue(placeholder.field) || placeholder.label;
                      
                      return (
                        <div
                          key={placeholder.id}
                          className={`absolute bg-green-200/90 border-2 border-green-600 px-1 py-0.5 rounded text-xs cursor-move select-none group whitespace-nowrap ${
                            draggingId === placeholder.id ? 'opacity-70' : ''
                          }`}
                          style={{
                            left: `${leftPercent}%`,
                            top: `${topPercent}%`,
                            transform: 'translate(-50%, -50%)',
                            fontSize: `${Math.max(8, placeholder.fontSize * 0.8)}px`
                          }}
                          onMouseDown={(e) => editMode && handlePlaceholderDrag(placeholder.id, e)}
                        >
                          <span className="font-medium text-yellow-900">{displayValue}</span>
                          {editMode && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-white shadow-lg rounded px-1 py-0.5 border z-10">
                              <button
                                onClick={(e) => { e.stopPropagation(); updatePlaceholderFontSize(placeholder.id, -1); }}
                                className="p-0.5 hover:bg-gray-100 rounded"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-xs">{placeholder.fontSize}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); updatePlaceholderFontSize(placeholder.id, 1); }}
                                className="p-0.5 hover:bg-gray-100 rounded"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); removePlaceholder(placeholder.id); }}
                                className="p-0.5 hover:bg-red-100 text-red-500 rounded ml-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Placed Placeholders List */}
                  {placedPlaceholders.length > 0 && (
                    <div className="bg-yellow-50 px-3 py-2 border-t border-yellow-200">
                      <p className="text-xs font-medium text-yellow-800 mb-1">
                        Platzierte Felder ({placedPlaceholders.length}):
                      </p>
                      <div className="space-y-1">
                        {placedPlaceholders.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between px-2 py-1 bg-yellow-200 text-yellow-800 text-xs rounded"
                          >
                            <span>
                              <strong>{p.label}</strong> @ X:{p.x}, Y:{p.y} (Größe: {p.fontSize}pt)
                            </span>
                            {editMode && (
                              <button
                                onClick={() => removePlaceholder(p.id)}
                                className="ml-2 hover:text-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!previewUrl && !contractData && (
                <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg text-gray-500">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Wählen Sie eine Vorlage aus</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={generateContract}
            disabled={!templatePdfBytes || isGenerating}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center"
          >
            {isGenerating ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Vertrag generieren & herunterladen
          </button>
        </div>
      </div>
    </div>
  );
}
