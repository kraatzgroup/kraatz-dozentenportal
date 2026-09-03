import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { renderFirstPageToDataUrl, renderPdfPages } from '../../lib/pdfjs';
import { FileText, X, ChevronLeft, ChevronRight, Sparkles, Eye, CheckCircle, Tag } from 'lucide-react';

// ---- Types (mirrors from VbKorrekturDashboard) ----

export interface SuggestedMaterial {
  id: string;
  title: string;
  file_url: string;
  file_name: string;
  folder_id: string | null;
}

export interface SuggestedFolder {
  id: string;
  name: string;
  parent_id: string | null;
  schwerpunkt_tags?: string[] | null;
}

export interface SuggestedCaseInfo {
  legal_area: string;
  sub_area: string;
  focus_area: string | null;
  study_phase: string | null;
}

interface ScoredMaterial {
  material: SuggestedMaterial;
  score: number;
  matchedTags: string[];
  folderName: string;
  folderPath: string[];
}

// ---- Matching / Scoring ----

/**
 * Collect the ancestor chain (root → ... → folder) for a given folder.
 */
function getAncestorChain(folderId: string, folders: SuggestedFolder[]): SuggestedFolder[] {
  const chain: SuggestedFolder[] = [];
  const map = new Map(folders.map(f => [f.id, f]));
  let currentId: string | null = folderId;
  while (currentId) {
    const f = map.get(currentId);
    if (!f) break;
    chain.unshift(f);
    currentId = f.parent_id;
  }
  return chain;
}

/**
 * Collect all schwerpunkt_tags from a folder and its ancestors.
 */
function collectTags(folderId: string, folders: SuggestedFolder[]): string[] {
  const chain = getAncestorChain(folderId, folders);
  const tags: string[] = [];
  for (const f of chain) {
    if (f.schwerpunkt_tags) {
      tags.push(...f.schwerpunkt_tags);
    }
  }
  return Array.from(new Set(tags));
}

// Folder/file name keywords that indicate non-Sachverhalt materials
const EXCLUDE_KEYWORDS = ['lösung', 'loesung', 'punkteschema', 'zusatzmaterial', 'korrektur', 'musterlösung', 'musterloesung', 'lösungsskizze', 'loesungsskizze'];

/**
 * Returns true if the material is a Sachverhalt (not a Lösung, Punkteschema, etc.).
 * Checks both the folder path and the file/title name.
 */
function isSachverhaltMaterial(
  material: SuggestedMaterial,
  folders: SuggestedFolder[]
): boolean {
  const folder = material.folder_id ? folders.find(f => f.id === material.folder_id) : null;
  const chain = folder ? getAncestorChain(folder.id, folders) : [];
  const ancestorNames = chain.map(f => f.name.toLowerCase());
  const titleLower = material.title.toLowerCase();
  const fileNameLower = (material.file_name || '').toLowerCase();

  // If any ancestor folder name contains an exclude keyword, skip it
  for (const name of ancestorNames) {
    for (const kw of EXCLUDE_KEYWORDS) {
      if (name.includes(kw)) return false;
    }
  }

  // If the title or file name contains an exclude keyword, skip it
  for (const kw of EXCLUDE_KEYWORDS) {
    if (titleLower.includes(kw) || fileNameLower.includes(kw)) return false;
  }

  return true;
}

/**
 * Score a teaching material against the participant's case info.
 * Higher score = better match.
 */
export function scoreMaterial(
  material: SuggestedMaterial,
  folders: SuggestedFolder[],
  caseInfo: SuggestedCaseInfo
): { score: number; matchedTags: string[]; folderName: string; folderPath: string[] } {
  const folder = material.folder_id ? folders.find(f => f.id === material.folder_id) : null;
  if (!folder) {
    return { score: 0, matchedTags: [], folderName: '', folderPath: [] };
  }

  // Only suggest Sachverhalte, not Lösungen/Punkteschema/Zusatzmaterial
  if (!isSachverhaltMaterial(material, folders)) {
    return { score: 0, matchedTags: [], folderName: '', folderPath: [] };
  }

  const chain = getAncestorChain(folder.id, folders);
  const ancestorNames = chain.map(f => f.name.toLowerCase());
  const folderPath = chain.map(f => f.name);

  let score = 0;
  const matchedTags: string[] = [];

  // 1) Legal area match (top-level folder name should match legal_area)
  if (ancestorNames.includes(caseInfo.legal_area.toLowerCase())) {
    score += 30;
    if (!matchedTags.includes(caseInfo.legal_area)) {
      matchedTags.push(caseInfo.legal_area);
    }
  }

  // 2) Sub-area match (a folder in the hierarchy should match sub_area)
  if (caseInfo.sub_area && caseInfo.sub_area !== 'Beliebig' && caseInfo.sub_area !== 'Crashkurs') {
    if (ancestorNames.includes(caseInfo.sub_area.toLowerCase())) {
      score += 25;
      if (!matchedTags.includes(caseInfo.sub_area)) {
        matchedTags.push(caseInfo.sub_area);
      }
    }
  }

  // 3) Focus area tag matching
  if (caseInfo.focus_area && caseInfo.focus_area.trim()) {
    const focusText = caseInfo.focus_area.toLowerCase();
    // Split by comma/semicolon for multi-term focus areas
    const focusTerms = focusText
      .split(/[,;]/)
      .map(t => t.trim())
      .filter(t => t.length > 2);
    // Individual significant words
    const focusWords = focusText
      .split(/[\s,;]+/)
      .map(w => w.trim())
      .filter(w => w.length > 3);

    const allTags = collectTags(folder.id, folders);

    for (const tag of allTags) {
      const tagLower = tag.toLowerCase();
      let matched = false;

      // Full term matching (highest weight)
      for (const term of focusTerms) {
        if (tagLower.includes(term) || term.includes(tagLower)) {
          score += 15;
          matched = true;
          break;
        }
      }
      // Word-level matching (lower weight)
      if (!matched) {
        for (const word of focusWords) {
          if (tagLower.includes(word) || word.includes(tagLower)) {
            score += 8;
            matched = true;
            break;
          }
        }
      }

      if (matched && !matchedTags.includes(tag)) {
        matchedTags.push(tag);
      }
    }
  }

  // 4) Title-based matching (bonus if focus terms appear in the material title)
  if (caseInfo.focus_area && caseInfo.focus_area.trim()) {
    const titleLower = material.title.toLowerCase();
    const focusWords = caseInfo.focus_area
      .toLowerCase()
      .split(/[\s,;]+/)
      .map(w => w.trim())
      .filter(w => w.length > 3);
    for (const word of focusWords) {
      if (titleLower.includes(word)) {
        score += 5;
        break;
      }
    }
  }

  return { score, matchedTags, folderName: folder.name, folderPath };
}

/**
 * Rank materials by score and return the top N suggestions.
 */
export function suggestKlausuren(
  materials: SuggestedMaterial[],
  folders: SuggestedFolder[],
  caseInfo: SuggestedCaseInfo,
  assignedUrls: Set<string>,
  topN = 3
): ScoredMaterial[] {
  // Filter out already-assigned materials
  const candidates = materials.filter(m => !assignedUrls.has(m.file_url));

  const scored = candidates
    .map(m => {
      const result = scoreMaterial(m, folders, caseInfo);
      return { material: m, ...result };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topN);
}

// ---- PDF Thumbnail Hook ----

const thumbnailCache = new Map<string, string>();

/**
 * Loads and caches a PDF first-page thumbnail for a given file URL.
 */
function usePdfThumbnail(fileUrl: string | null): { thumbnail: string | null; loading: boolean } {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fileUrl) {
      setThumbnail(null);
      return;
    }

    // Return cached thumbnail immediately
    if (thumbnailCache.has(fileUrl)) {
      setThumbnail(thumbnailCache.get(fileUrl)!);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const loadThumbnail = async () => {
      try {
        // Determine bucket from URL
        let bucket = 'case-studies';
        if (fileUrl.includes('/masterclass/')) {
          bucket = 'masterclass';
        }

        // Extract storage path
        let path: string | null = null;
        const marker = `/object/public/${bucket}/`;
        const idx = fileUrl.indexOf(marker);
        if (idx >= 0) {
          path = fileUrl.slice(idx + marker.length);
        }

        let arrayBuffer: ArrayBuffer;
        if (path) {
          const { data, error } = await supabase.storage.from(bucket).download(path);
          if (error || !data) throw error || new Error('Download failed');
          arrayBuffer = await data.arrayBuffer();
        } else {
          const response = await fetch(fileUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          arrayBuffer = await response.arrayBuffer();
        }

        const result = await renderFirstPageToDataUrl(new Uint8Array(arrayBuffer), 1.5);
        if (!cancelled) {
          thumbnailCache.set(fileUrl, result.dataUrl);
          setThumbnail(result.dataUrl);
        }
      } catch (err) {
        console.error('Error generating PDF thumbnail:', err);
        if (!cancelled) {
          setThumbnail(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadThumbnail();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return { thumbnail, loading };
}

// ---- PDF Preview Modal ----

interface PdfPreviewModalProps {
  material: SuggestedMaterial | null;
  onClose: () => void;
  onAssign?: (material: SuggestedMaterial) => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({ material, onClose, onAssign }) => {
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lock background scroll while the PDF preview is open.
  // Both <html> and <body> must be locked (see VbKorrekturDashboard for details).
  useEffect(() => {
    if (!material) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [material]);

  useEffect(() => {
    if (!material) {
      setPages([]);
      setCurrentPage(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setPages([]);
    setCurrentPage(0);

    const loadPdf = async () => {
      try {
        let bucket = 'case-studies';
        if (material.file_url.includes('/masterclass/')) {
          bucket = 'masterclass';
        }

        let path: string | null = null;
        const marker = `/object/public/${bucket}/`;
        const idx = material.file_url.indexOf(marker);
        if (idx >= 0) {
          path = material.file_url.slice(idx + marker.length);
        }

        let arrayBuffer: ArrayBuffer;
        if (path) {
          const { data, error } = await supabase.storage.from(bucket).download(path);
          if (error || !data) throw error || new Error('Download failed');
          arrayBuffer = await data.arrayBuffer();
        } else {
          const response = await fetch(material.file_url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          arrayBuffer = await response.arrayBuffer();
        }

        const renderedPages = await renderPdfPages(new Uint8Array(arrayBuffer), 1.5);
        if (!cancelled) {
          setPages(renderedPages.map(p => p.dataUrl));
        }
      } catch (err) {
        console.error('Error loading PDF preview:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [material]);

  if (!material) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold truncate">{material.title}</h3>
              <p className="text-xs text-gray-500 truncate">{material.file_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onAssign && (
              <button
                onClick={() => onAssign(material)}
                className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2 text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Zuweisen
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gray-100 p-4 flex flex-col items-center">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
              <p className="text-gray-500 text-sm">PDF wird geladen…</p>
            </div>
          ) : pages.length > 0 ? (
            <div className="space-y-4">
              {pages.map((dataUrl, idx) => (
                <img
                  key={idx}
                  src={dataUrl}
                  alt={`Seite ${idx + 1}`}
                  className="max-w-full shadow-lg rounded bg-white"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <FileText className="w-12 h-12 mb-3" />
              <p className="text-sm">PDF konnte nicht geladen werden</p>
            </div>
          )}
        </div>

        {/* Page navigation footer */}
        {pages.length > 1 && (
          <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between bg-white">
            <button
              onClick={() => {
                setCurrentPage(p => Math.max(0, p - 1));
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
              Zurück
            </button>
            <span className="text-sm text-gray-600">
              Seite {currentPage + 1} von {pages.length}
            </span>
            <button
              onClick={() => {
                setCurrentPage(p => Math.min(pages.length - 1, p + 1));
                scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={currentPage >= pages.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Weiter
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Page Stack Card ----

interface PageStackCardProps {
  material: ScoredMaterial;
  rank: number;
  onSelect: (material: SuggestedMaterial) => void;
  onAssign: (material: SuggestedMaterial) => void;
}

const PageStackCard: React.FC<PageStackCardProps> = ({ material, rank, onSelect, onAssign }) => {
  const { thumbnail, loading } = usePdfThumbnail(material.material.file_url);

  return (
    <div
      className="group relative cursor-pointer transition-all duration-300 hover:scale-105 hover:z-20 h-full"
      onClick={() => onSelect(material.material)}
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden w-full h-full flex flex-col hover:shadow-xl transition-shadow">
        {/* Thumbnail */}
        <div className="relative h-48 bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          ) : thumbnail ? (
            <img
              src={thumbnail}
              alt={material.material.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <FileText className="w-12 h-12 text-gray-300" />
          )}
          {/* Rank badge */}
          <div className="absolute top-2 left-2 bg-primary text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow">
            {rank}
          </div>
          {/* Preview overlay on hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2 shadow-lg">
              <Eye className="w-5 h-5 text-primary" />
            </div>
          </div>
        </div>
        {/* Info - flex-1 fills remaining space so all cards are same height */}
        <div className="p-3 flex-1 flex flex-col">
          <p className="text-sm font-medium text-gray-900 truncate">
            {(() => {
              const raw = material.folderPath.length > 0 ? material.folderPath[material.folderPath.length - 1] : material.material.title;
              // Strip leading numbering/abbreviation prefixes like "StrR GS 06 - ", "Klausur 13 - ", "StrR AT II - GS 02 - "
              const parts = raw.split(/\s+[-–—]\s+/);
              return parts[parts.length - 1].trim() || raw;
            })()}
          </p>
          {material.folderPath.length > 1 && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {material.folderPath.slice(0, -1).join(' › ')}
            </p>
          )}
          {/* Tags area - always 3 tag slots so cards align */}
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from({ length: 3 }).map((_, i) => {
              const validTags = material.matchedTags.filter(t => t.trim().length > 1);
              const tag = validTags[i];
              if (tag) {
                const display = tag.length > 22 ? tag.slice(0, 20) + '…' : tag;
                return (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700 max-w-full truncate"
                    title={tag}
                  >
                    <Tag className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{display}</span>
                  </span>
                );
              }
              // Empty placeholder slot to keep height consistent
              return (
                <span
                  key={`empty-${i}`}
                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-300"
                >
                  &mdash;
                </span>
              );
            })}
          </div>
          {/* Quick assign button - pinned to bottom */}
          <div className="mt-auto pt-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAssign(material.material);
            }}
            className="w-full text-xs bg-primary/10 text-primary hover:bg-primary hover:text-white py-1.5 rounded-md transition-colors font-medium flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Zuweisen
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---- Main SuggestedKlausuren Component ----

interface SuggestedKlausurenProps {
  materials: SuggestedMaterial[];
  folders: SuggestedFolder[];
  caseInfo: SuggestedCaseInfo | null;
  assignedUrls: Set<string>;
  onAssign: (material: SuggestedMaterial) => void;
}

export const SuggestedKlausuren: React.FC<SuggestedKlausurenProps> = ({
  materials,
  folders,
  caseInfo,
  assignedUrls,
  onAssign,
}) => {
  const [previewMaterial, setPreviewMaterial] = useState<SuggestedMaterial | null>(null);

  const suggestions = React.useMemo(() => {
    if (!caseInfo) return [];
    return suggestKlausuren(materials, folders, caseInfo, assignedUrls, 3);
  }, [materials, folders, caseInfo, assignedUrls]);

  if (!caseInfo || suggestions.length === 0) return null;

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h4 className="text-sm font-semibold text-gray-900">Vorgeschlagene Klausuren</h4>
          <span className="text-xs text-gray-500">
            basierend auf {caseInfo.legal_area}
            {caseInfo.sub_area && caseInfo.sub_area !== 'Beliebig' ? ` / ${caseInfo.sub_area}` : ''}
            {caseInfo.focus_area ? ' + Schwerpunkt' : ''}
          </span>
        </div>

        {/* Equal grid */}
        <div className="grid grid-cols-3 gap-3 py-4 px-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl border border-blue-100">
          {suggestions.map((s, idx) => (
            <PageStackCard
              key={s.material.id}
              material={s}
              rank={suggestions.length - idx}
              onSelect={setPreviewMaterial}
              onAssign={onAssign}
            />
          ))}
        </div>

        <p className="text-xs text-gray-400 mt-2 text-center">
          Klicke auf eine Klausur für eine PDF-Vorschau · Unten kannst du alle Klausuren durchsuchen
        </p>
      </div>

      {/* PDF Preview Modal */}
      <PdfPreviewModal
        material={previewMaterial}
        onClose={() => setPreviewMaterial(null)}
        onAssign={(m) => {
          setPreviewMaterial(null);
          onAssign(m);
        }}
      />
    </>
  );
};
