import React, { useState, useRef, useEffect } from 'react';
import { Tag, X, Info, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SchwerpunktTagsInputProps {
  caseStudyId: string;
  caseStudyNumber: number;
  tags: string[];
  onTagsChanged?: (tags: string[]) => void;
  compact?: boolean;
  /**
   * Optional custom save handler. If provided, this is used instead of the
   * default save to vb_case_study_requests.admin_focus_tags.
   * Use this when embedding the component for other tables (e.g. material_folders).
   */
  onSave?: (newTags: string[]) => Promise<void>;
  /** Label shown in the tooltip header. Defaults to "Klausur #<n>". */
  tooltipTitle?: string;
}

/**
 * Tag-Input für den Klausur-Schwerpunkt.
 * Erlaubt Admin- und Material-Rollen, eine Klausur mit mehreren
 * Schwerpunkt-Tags zu versehen, um sie besser zu beschreiben.
 */
export const SchwerpunktTagsInput: React.FC<SchwerpunktTagsInputProps> = ({
  caseStudyId,
  caseStudyNumber,
  tags,
  onTagsChanged,
  compact = false,
  onSave,
  tooltipTitle,
}) => {
  const [localTags, setLocalTags] = useState<string[]>(tags || []);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTags(tags || []);
  }, [tags]);

  const saveTags = async (newTags: string[]) => {
    setSaving(true);
    try {
      if (onSave) {
        await onSave(newTags);
      } else {
        const { error } = await supabase
          .from('vb_case_study_requests')
          .update({ admin_focus_tags: newTags })
          .eq('id', caseStudyId);
        if (error) throw error;
      }
      onTagsChanged?.(newTags);
    } catch (err) {
      console.error('Error saving schwerpunkt tags:', err);
      alert('Fehler beim Speichern der Schwerpunkt-Tags.');
      setLocalTags(tags || []);
    } finally {
      setSaving(false);
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (localTags.includes(trimmed)) return;
    const newTags = [...localTags, trimmed];
    setLocalTags(newTags);
    setInputValue('');
    saveTags(newTags);
  };

  const removeTag = (tag: string) => {
    const newTags = localTags.filter(t => t !== tag);
    setLocalTags(newTags);
    saveTags(newTags);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && localTags.length > 0) {
      removeTag(localTags[localTags.length - 1]);
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {localTags.length > 0 ? (
          localTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
            >
              {tag}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-400">Keine Tags</span>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
      <div className="flex items-center gap-2 mb-2">
        <Tag className="w-4 h-4 text-indigo-600 flex-shrink-0" />
        <label className="text-sm font-medium text-gray-700">
          Schwerpunkt-Tags
        </label>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(s => !s)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Info zu Schwerpunkt-Tags"
          >
            <Info className="w-4 h-4" />
          </button>
          {showTooltip && (
            <div className="absolute z-20 left-1/2 -translate-x-1/2 top-6 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
              <p className="font-medium mb-1">{tooltipTitle || `Schwerpunkt-Tags für Klausur #${caseStudyNumber}`}</p>
              <p className="text-gray-300 leading-relaxed">
                Hier kannst du mehrere Tags vergeben, um den inhaltlichen Schwerpunkt
                der Klausur genauer zu beschreiben (z.&nbsp;B. „Vertreter ohne Vertretungsmacht&ldquo;,
                „Rücktritt wegen Nichterfüllung&ldquo;). Tags helfen Dozenten und der
                Materialüberarbeitung, passende Klausuren schneller zu finden.
              </p>
              <p className="text-gray-400 mt-1">Tipp: Enter oder Komma fügt ein Tag hinzu.</p>
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          )}
        </div>
        {saving && (
          <span className="text-xs text-gray-400 ml-auto">Speichern…</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 min-h-[2.25rem] p-2 bg-white border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-indigo-400">
        {localTags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-indigo-400 hover:text-indigo-700 transition-colors"
              aria-label={`Tag "${tag}" entfernen`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => inputValue.trim() && addTag(inputValue)}
          placeholder={localTags.length === 0 ? 'Tag eingeben und Enter drücken…' : ''}
          className="flex-1 min-w-[120px] text-sm border-none outline-none bg-transparent"
          disabled={saving}
        />
      </div>

      {localTags.length === 0 && (
        <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
          <Plus className="w-3 h-3" />
          Noch keine Tags gesetzt – jetzt hinzufügen
        </p>
      )}
    </div>
  );
};
