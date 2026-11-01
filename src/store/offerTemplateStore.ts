import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface OfferEmailTemplate {
  id: string;
  title: string;
  icon?: string | null;
  description?: string | null;
  subject: string;
  body: string;
  category?: string | null;
  is_html?: boolean | null;
}

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface OfferTemplateState {
  templates: Record<string, OfferEmailTemplate[]>;
  status: Record<string, LoadStatus>;
  /** Lädt die Vorlagen einer Kategorie. Zwischengespeicherte Vorlagen werden sofort genutzt und im Hintergrund aktualisiert. */
  fetchTemplates: (category: string, options?: { force?: boolean }) => Promise<void>;
}

const CACHE_KEY = (category: string) => `offer-templates:v1:${category}`;
const COLUMNS = 'id, title, icon, description, subject, body, category, is_html';

const readCache = (category: string): OfferEmailTemplate[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY(category));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows?: OfferEmailTemplate[] };
    return Array.isArray(parsed.rows) && parsed.rows.length > 0 ? parsed.rows : null;
  } catch {
    return null;
  }
};

const writeCache = (category: string, rows: OfferEmailTemplate[]) => {
  try {
    localStorage.setItem(CACHE_KEY(category), JSON.stringify({ at: Date.now(), rows }));
  } catch {
    /* Speicher voll oder nicht verfügbar – Cache ist optional */
  }
};

/** Synchroner Zugriff auf bereits geladene bzw. lokal zwischengespeicherte Vorlagen (ohne Store-Update). */
export const readCachedOfferTemplates = (category: string): OfferEmailTemplate[] | null =>
  useOfferTemplateStore.getState().templates[category] ?? readCache(category);

// Laufende Requests je Kategorie, damit parallele Aufrufe denselben Request teilen
const inflight = new Map<string, Promise<void>>();
// Kategorien, die in dieser Sitzung bereits frisch vom Server geladen wurden
const fresh = new Set<string>();

export const useOfferTemplateStore = create<OfferTemplateState>((set, get) => ({
  templates: {},
  status: {},

  fetchTemplates: (category, options) => {
    // Sofort aus dem lokalen Cache befüllen, damit das Modal ohne Netzwerk rendert
    if (!get().templates[category]) {
      const cached = readCache(category);
      if (cached) set(s => ({ templates: { ...s.templates, [category]: cached }, status: { ...s.status, [category]: 'ready' } }));
    }
    if (!options?.force && fresh.has(category)) return Promise.resolve();
    const running = inflight.get(category);
    if (running) return running;

    if (!get().templates[category]) set(s => ({ status: { ...s.status, [category]: 'loading' } }));
    const startedAt = performance.now();
    const request = (async () => {
      try {
        const { data, error } = await supabase
          .from('email_templates')
          .select(COLUMNS)
          .eq('category', category)
          .order('id');
        if (error) throw error;
        let rows = (data || []) as OfferEmailTemplate[];
        // Fallback wie bisher: ohne Vorlagen der Kategorie alle Vorlagen anbieten
        if (rows.length === 0) {
          const { data: all, error: allError } = await supabase.from('email_templates').select(COLUMNS).order('id');
          if (allError) throw allError;
          rows = (all || []) as OfferEmailTemplate[];
        }
        if (import.meta.env.DEV) {
          console.debug(`[offer-templates] ${category}: ${rows.length} Vorlagen in ${Math.round(performance.now() - startedAt)} ms`);
        }
        writeCache(category, rows);
        fresh.add(category);
        set(s => ({ templates: { ...s.templates, [category]: rows }, status: { ...s.status, [category]: 'ready' } }));
      } catch (error) {
        console.error(`[offer-templates] Laden fehlgeschlagen (${category}):`, error);
        // Vorhandene (gecachte) Vorlagen behalten; nur ohne Daten als Fehler markieren
        if (!get().templates[category]) set(s => ({ status: { ...s.status, [category]: 'error' } }));
      } finally {
        inflight.delete(category);
      }
    })();
    inflight.set(category, request);
    return request;
  },
}));
