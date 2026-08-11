import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Type, PenTool, Stamp, Trash2, Loader2, Plus, Minus, Save, Globe, Star } from 'lucide-react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { renderPdfPages, renderFirstPageToDataUrl, RenderedPage } from '../../lib/pdfjs';

export interface SignedDocumentRow {
  id: string;
  title: string;
  original_file_path: string;
  signed_file_path: string | null;
  status: string;
  contract_id?: string | null;
  teilnehmer_id?: string | null;
  contract?: { contract_number: string } | null;
  teilnehmer?: { name: string; tn_nummer: string | null } | null;
}

type AnnKind = 'text' | 'signature' | 'stamp';

interface Annotation {
  id: string;
  kind: AnnKind;
  page: number; // 0-based
  xPct: number; // top-left x fraction of page width
  yPct: number; // top-left y fraction of page height
  wPct: number; // width fraction of page width (graphics only)
  aspect: number; // width / height of the graphic
  // text
  text?: string;
  fontSize?: number; // PDF points
  fontFamily?: 'Arial' | 'Times New Roman';
  // graphics
  previewUrl?: string;
  pngBytes?: Uint8Array; // signature
  pdfBytes?: Uint8Array; // stamp
  storagePath?: string;
}

// Serializable subset of an Annotation (no bytes / blob URLs) used for persistence
type SavedAnnotation = Pick<
  Annotation,
  'id' | 'kind' | 'page' | 'xPct' | 'yPct' | 'wPct' | 'aspect' | 'text' | 'fontSize' | 'fontFamily' | 'storagePath'
>;

interface RecentAsset {
  id: string;
  file_path: string;
  url: string;
  isGlobal?: boolean;
  userId?: string;
}

interface Props {
  document: SignedDocumentRow;
  onClose: () => void;
  onSigned: () => void;
}

const todayDe = () =>
  new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function ContractSignEditor({ document: doc, onClose, onSigned }: Props) {
  const { addToast } = useToastStore();
  const { user, isAdmin } = useAuthStore();

  const [originalBytes, setOriginalBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [recentSignatures, setRecentSignatures] = useState<RecentAsset[]>([]);
  const [recentStamps, setRecentStamps] = useState<RecentAsset[]>([]);

  const [visiblePage, setVisiblePage] = useState(0);
  // Displayed width (px) of the page column, used to render text sizes
  // responsively (text size is stored in PDF points, independent of screen).
  const [pageBoxWidth, setPageBoxWidth] = useState(0);

  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pagesWrapperRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<
    | { id: string; mode: 'move'; offsetX: number; offsetY: number }
    | {
        id: string;
        mode: 'resize';
        corner: 'nw' | 'ne' | 'sw' | 'se';
        fixedX: number;
        fixedY: number;
        aspect: number;
        isText: boolean;
        startFont: number;
        startHeightPx: number;
      }
    | null
  >(null);

  // Determine which page is currently most visible in the scroll viewport
  const updateVisiblePage = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const viewportCenter = container.scrollTop + container.clientHeight / 2;
    let bestIndex = 0;
    let bestDistance = Infinity;
    pageRefs.current.forEach((el, index) => {
      if (!el) return;
      const center = el.offsetTop + el.offsetHeight / 2;
      const distance = Math.abs(center - viewportCenter);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    setVisiblePage(bestIndex);
  }, []);

  // Track the displayed page column width so text (stored in PDF points) can be
  // rendered at the correct on-screen size on any window size / resolution.
  useEffect(() => {
    const el = pagesWrapperRef.current;
    if (!el) return;
    const update = () => setPageBoxWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, pages.length]);

  // Load original PDF + render pages
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from('signed-documents')
          .download(doc.original_file_path);
        if (error || !data) throw error || new Error('Download fehlgeschlagen');
        const buf = new Uint8Array(await data.arrayBuffer());
        setOriginalBytes(buf);
        const rendered = await renderPdfPages(buf, 1.5);
        setPages(rendered);

        // Restore previously saved element positions (draft layout)
        const { data: row } = await supabase
          .from('signed_documents')
          .select('layout')
          .eq('id', doc.id)
          .single();
        const saved = (row?.layout as SavedAnnotation[] | null) || null;
        if (saved && saved.length) {
          const restored = await rehydrateLayout(saved);
          setAnnotations(restored);
        }
      } catch (e) {
        console.error(e);
        addToast('Fehler beim Laden des PDF', 'error');
      } finally {
        setLoading(false);
        // Enable auto-save only after the initial layout has been restored
        hydratedRef.current = true;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.original_file_path, doc.id, addToast]);

  // Rebuild live annotations (bytes + preview URLs) from a saved layout
  const rehydrateLayout = async (saved: SavedAnnotation[]): Promise<Annotation[]> => {
    const out: Annotation[] = [];
    for (const s of saved) {
      if (s.kind === 'text') {
        out.push({ ...s, previewUrl: undefined, pngBytes: undefined, pdfBytes: undefined });
        continue;
      }
      const bucket = s.kind === 'signature' ? 'signatures' : 'stamps';
      if (!s.storagePath) continue;
      const { data } = await supabase.storage.from(bucket).download(s.storagePath);
      if (!data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());
      const isPdf = s.storagePath.toLowerCase().endsWith('.pdf');
      if (s.kind === 'stamp' && isPdf) {
        const { dataUrl } = await renderFirstPageToDataUrl(bytes, 2);
        out.push({ ...s, previewUrl: dataUrl, pdfBytes: bytes });
      } else {
        out.push({ ...s, previewUrl: URL.createObjectURL(data), pngBytes: bytes });
      }
    }
    return out;
  };

  // Load recent signatures + stamps (eigene + globale Defaults)
  const loadRecents = useCallback(async () => {
    if (!user) return;
    const [{ data: sigs }, { data: stamps }] = await Promise.all([
      supabase
        .from('saved_signatures')
        .select('id, file_path, is_global, user_id')
        .or(`user_id.eq.${user.id},is_global.eq.true`)
        .order('is_global', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(24),
      supabase
        .from('saved_stamps')
        .select('id, file_path, is_global, user_id')
        .or(`user_id.eq.${user.id},is_global.eq.true`)
        .order('is_global', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(24),
    ]);

    // isPdf=true always renders first page; 'auto' detects by file extension
    const toAssets = async (
      rows: any[] | null,
      bucket: string,
      mode: 'image' | 'pdf' | 'auto'
    ): Promise<RecentAsset[]> => {
      if (!rows) return [];
      const out: RecentAsset[] = [];
      for (const r of rows) {
        const { data } = await supabase.storage.from(bucket).download(r.file_path);
        if (!data) continue;
        const isPdf = mode === 'pdf' || (mode === 'auto' && r.file_path.toLowerCase().endsWith('.pdf'));
        if (isPdf) {
          const buf = new Uint8Array(await data.arrayBuffer());
          const { dataUrl } = await renderFirstPageToDataUrl(buf, 2);
          out.push({ id: r.id, file_path: r.file_path, url: dataUrl, isGlobal: !!r.is_global, userId: r.user_id });
        } else {
          out.push({ id: r.id, file_path: r.file_path, url: URL.createObjectURL(data), isGlobal: !!r.is_global, userId: r.user_id });
        }
      }
      return out;
    };

    setRecentSignatures(await toAssets(sigs, 'signatures', 'image'));
    setRecentStamps(await toAssets(stamps, 'stamps', 'auto'));
  }, [user]);

  useEffect(() => {
    loadRecents();
  }, [loadRecents]);

  const addAnnotation = (a: Annotation) => {
    setAnnotations((prev) => [...prev, a]);
    setSelectedId(a.id);
  };

  // ---- Add Ort/Datum text ----
  const addDateText = () => {
    // Place on the currently visible page, in the lower area
    addAnnotation({
      id: `ann_${Date.now()}`,
      kind: 'text',
      page: visiblePage,
      xPct: 0.1,
      yPct: 0.85,
      wPct: 0,
      aspect: 1,
      text: `Berlin, den ${todayDe()}`,
      fontSize: 12,
      fontFamily: 'Arial',
    });
    // Ensure the target page is scrolled into view so the new field is visible
    pageRefs.current[visiblePage]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // ---- Upload signature (PNG/JPEG/WebP/AVIF -> normalized to PNG) ----
  const handleSignatureUpload = async (file: File) => {
    if (!user) return;
    // Convert any supported image format to PNG (pdf-lib only embeds PNG/JPG;
    // this normalizes WebP/AVIF/JPEG and preserves transparency).
    let pngBytes: Uint8Array;
    let aspect: number;
    let previewUrl: string;
    try {
      const converted = await convertImageToPng(file);
      pngBytes = converted.pngBytes;
      aspect = converted.aspect;
      previewUrl = converted.dataUrl;
    } catch (e) {
      console.error(e);
      addToast('Bildformat konnte nicht verarbeitet werden', 'error');
      return;
    }

    // persist to bucket + saved_signatures (always as .png)
    const baseName = sanitize(file.name).replace(/\.(png|jpe?g|webp|avif)$/i, '');
    const path = `${user.id}/${Date.now()}_${baseName}.png`;
    const { error: upErr } = await supabase.storage
      .from('signatures')
      .upload(path, pngBytes, { contentType: 'image/png', upsert: true });
    if (!upErr) {
      await supabase.from('saved_signatures').insert({ user_id: user.id, file_path: path });
      loadRecents();
    }

    addAnnotation({
      id: `ann_${Date.now()}`,
      kind: 'signature',
      page: visiblePage,
      xPct: 0.55,
      yPct: 0.8,
      wPct: 0.25,
      aspect,
      previewUrl,
      pngBytes,
      storagePath: path,
    });
  };

  // ---- Upload stamp (PDF or image PNG/JPG/WebP/AVIF with transparency) ----
  const handleStampUpload = async (file: File) => {
    if (!user) return;
    const baseId = `ann_${Date.now()}`;

    if (file.type === 'application/pdf') {
      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const { dataUrl, width, height } = await renderFirstPageToDataUrl(pdfBytes, 3);

      const path = `${user.id}/${Date.now()}_${sanitize(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from('stamps')
        .upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });
      if (!upErr) {
        await supabase.from('saved_stamps').insert({ user_id: user.id, file_path: path });
        loadRecents();
      }

      addAnnotation({
        id: baseId,
        kind: 'stamp',
        page: visiblePage,
        xPct: 0.6,
        yPct: 0.75,
        wPct: 0.2,
        aspect: width / height,
        previewUrl: dataUrl,
        pdfBytes,
        storagePath: path,
      });
      return;
    }

    // Image stamp (normalized to PNG so transparency is preserved)
    let pngBytes: Uint8Array;
    let aspect: number;
    let previewUrl: string;
    try {
      const converted = await convertImageToPng(file);
      pngBytes = converted.pngBytes;
      aspect = converted.aspect;
      previewUrl = converted.dataUrl;
    } catch (e) {
      console.error(e);
      addToast('Bildformat konnte nicht verarbeitet werden', 'error');
      return;
    }

    const baseName = sanitize(file.name).replace(/\.(png|jpe?g|webp|avif)$/i, '');
    const path = `${user.id}/${Date.now()}_${baseName}.png`;
    const { error: upErr } = await supabase.storage
      .from('stamps')
      .upload(path, pngBytes, { contentType: 'image/png', upsert: true });
    if (!upErr) {
      await supabase.from('saved_stamps').insert({ user_id: user.id, file_path: path });
      loadRecents();
    }

    addAnnotation({
      id: baseId,
      kind: 'stamp',
      page: visiblePage,
      xPct: 0.6,
      yPct: 0.75,
      wPct: 0.2,
      aspect,
      previewUrl,
      pngBytes,
      storagePath: path,
    });
  };

  // ---- Add from recent ----
  const addRecentSignature = async (asset: RecentAsset) => {
    const { data } = await supabase.storage.from('signatures').download(asset.file_path);
    if (!data) return;
    const pngBytes = new Uint8Array(await data.arrayBuffer());
    const aspect = await getImageAspect(asset.url);
    addAnnotation({
      id: `ann_${Date.now()}`,
      kind: 'signature',
      page: visiblePage,
      xPct: 0.55,
      yPct: 0.8,
      wPct: 0.25,
      aspect,
      previewUrl: asset.url,
      pngBytes,
      storagePath: asset.file_path,
    });
  };

  const deleteRecentSignature = async (asset: RecentAsset) => {
    // Globale Einträge dürfen nur vom Admin oder vom Besitzer gelöscht werden
    if (asset.isGlobal && !isAdmin && asset.userId !== user?.id) {
      addToast('Globale Unterschrift kann nur von Admin gelöscht werden', 'error');
      return;
    }
    try {
      await supabase.storage.from('signatures').remove([asset.file_path]);
      await supabase.from('saved_signatures').delete().eq('id', asset.id);
      setRecentSignatures((prev) => prev.filter((s) => s.id !== asset.id));
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Löschen der Unterschrift', 'error');
    }
  };

  const toggleGlobalSignature = async (asset: RecentAsset) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('saved_signatures')
        .update({ is_global: !asset.isGlobal })
        .eq('id', asset.id);
      if (error) throw error;
      addToast(asset.isGlobal ? 'Unterschrift ist nicht mehr global' : 'Unterschrift ist jetzt global (Default für alle)', 'success');
      loadRecents();
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Umschalten des globalen Status', 'error');
    }
  };

  const addRecentStamp = async (asset: RecentAsset) => {
    const { data } = await supabase.storage.from('stamps').download(asset.file_path);
    if (!data) return;
    const bytes = new Uint8Array(await data.arrayBuffer());
    const isPdf = asset.file_path.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const { width, height } = await renderFirstPageToDataUrl(bytes, 2);
      addAnnotation({
        id: `ann_${Date.now()}`,
        kind: 'stamp',
        page: visiblePage,
        xPct: 0.6,
        yPct: 0.75,
        wPct: 0.2,
        aspect: width / height,
        previewUrl: asset.url,
        pdfBytes: bytes,
        storagePath: asset.file_path,
      });
    } else {
      const aspect = await getImageAspect(asset.url);
      addAnnotation({
        id: `ann_${Date.now()}`,
        kind: 'stamp',
        page: visiblePage,
        xPct: 0.6,
        yPct: 0.75,
        wPct: 0.2,
        aspect,
        previewUrl: asset.url,
        pngBytes: bytes,
        storagePath: asset.file_path,
      });
    }
  };

  const deleteRecentStamp = async (asset: RecentAsset) => {
    // Globale Einträge dürfen nur vom Admin oder vom Besitzer gelöscht werden
    if (asset.isGlobal && !isAdmin && asset.userId !== user?.id) {
      addToast('Globaler Stempel kann nur von Admin gelöscht werden', 'error');
      return;
    }
    try {
      await supabase.storage.from('stamps').remove([asset.file_path]);
      await supabase.from('saved_stamps').delete().eq('id', asset.id);
      setRecentStamps((prev) => prev.filter((s) => s.id !== asset.id));
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Löschen des Stempels', 'error');
    }
  };

  const toggleGlobalStamp = async (asset: RecentAsset) => {
    if (!isAdmin) return;
    try {
      const { error } = await supabase
        .from('saved_stamps')
        .update({ is_global: !asset.isGlobal })
        .eq('id', asset.id);
      if (error) throw error;
      addToast(asset.isGlobal ? 'Stempel ist nicht mehr global' : 'Stempel ist jetzt global (Default für alle)', 'success');
      loadRecents();
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Umschalten des globalen Status', 'error');
    }
  };

  // ---- Dragging ----
  const startMove = (e: React.MouseEvent, ann: Annotation) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(ann.id);

    // Remember where inside the element the user grabbed, so the element does
    // not jump its top-left corner to the cursor on the first mouse move.
    const elRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragState.current = {
      id: ann.id,
      mode: 'move',
      offsetX: e.clientX - elRect.left,
      offsetY: e.clientY - elRect.top,
    };
  };

  // ---- Resizing from a corner (opposite corner stays fixed) ----
  const startResize = (e: React.MouseEvent, ann: Annotation, corner: 'nw' | 'ne' | 'sw' | 'se') => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(ann.id);

    const pageEl = pageRefs.current[ann.page];
    const elEl = (e.currentTarget as HTMLElement).parentElement;
    if (!pageEl || !elEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const elRect = elEl.getBoundingClientRect();

    const left = elRect.left - pageRect.left;
    const top = elRect.top - pageRect.top;
    const right = left + elRect.width;
    const bottom = top + elRect.height;

    // The fixed point is the corner opposite to the one being dragged.
    const fixedX = corner === 'nw' || corner === 'sw' ? right : left;
    const fixedY = corner === 'nw' || corner === 'ne' ? bottom : top;

    dragState.current = {
      id: ann.id,
      mode: 'resize',
      corner,
      fixedX,
      fixedY,
      aspect: elRect.width / elRect.height || 1,
      isText: ann.kind === 'text',
      startFont: ann.fontSize || 12,
      startHeightPx: elRect.height || 1,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const ds = dragState.current;
      if (!ds) return;
      const ann = annotations.find((a) => a.id === ds.id);
      if (!ann) return;
      const container = pageRefs.current[ann.page];
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (ds.mode === 'move') {
        // Determine which page the cursor is currently over, so elements can be
        // dragged across page boundaries.
        let targetIndex = ann.page;
        let targetRect = rect;
        for (let i = 0; i < pageRefs.current.length; i++) {
          const el = pageRefs.current[i];
          if (!el) continue;
          const r = el.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            targetIndex = i;
            targetRect = r;
            break;
          }
        }
        // Subtract the grab offset so the element follows the cursor smoothly
        const leftPx = e.clientX - targetRect.left - ds.offsetX;
        const topPx = e.clientY - targetRect.top - ds.offsetY;
        const xPct = clamp(leftPx / targetRect.width, 0, 1);
        const yPct = clamp(topPx / targetRect.height, 0, 1);
        setAnnotations((prev) =>
          prev.map((a) => (a.id === ds.id ? { ...a, page: targetIndex, xPct, yPct } : a))
        );
      } else {
        // Corner resize with aspect lock; the opposite corner (fixedX/fixedY) stays put.
        const mx = e.clientX - rect.left;
        const newWidthPx = clamp(Math.abs(mx - ds.fixedX), 8, rect.width);
        const newHeightPx = newWidthPx / ds.aspect;
        const onLeft = ds.corner === 'nw' || ds.corner === 'sw';
        const onTop = ds.corner === 'nw' || ds.corner === 'ne';
        const leftPx = onLeft ? ds.fixedX - newWidthPx : ds.fixedX;
        const topPx = onTop ? ds.fixedY - newHeightPx : ds.fixedY;
        const xPct = clamp(leftPx / rect.width, 0, 1);
        const yPct = clamp(topPx / rect.height, 0, 1);

        if (ds.isText) {
          const fontSize = clamp(Math.round(ds.startFont * (newHeightPx / ds.startHeightPx)), 6, 200);
          setAnnotations((prev) =>
            prev.map((a) => (a.id === ds.id ? { ...a, xPct, yPct, fontSize } : a))
          );
        } else {
          const wPct = clamp(newWidthPx / rect.width, 0.03, 1);
          setAnnotations((prev) =>
            prev.map((a) => (a.id === ds.id ? { ...a, xPct, yPct, wPct } : a))
          );
        }
      }
    };
    const onUp = () => {
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [annotations]);

  const updateSelected = (patch: Partial<Annotation>) => {
    if (!selectedId) return;
    setAnnotations((prev) => prev.map((a) => (a.id === selectedId ? { ...a, ...patch } : a)));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
    setSelectedId(null);
  };

  const selected = annotations.find((a) => a.id === selectedId) || null;

  // Delete/Backspace removes the selected element (unless typing in a field)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (!selectedId || editingId) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      e.preventDefault();
      setAnnotations((prev) => prev.filter((a) => a.id !== selectedId));
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, editingId]);

  // ---- Save positions (draft layout) ----
  const writeLayout = useCallback(async () => {
    const layout: SavedAnnotation[] = annotations.map((a) => ({
      id: a.id,
      kind: a.kind,
      page: a.page,
      xPct: a.xPct,
      yPct: a.yPct,
      wPct: a.wPct,
      aspect: a.aspect,
      text: a.text,
      fontSize: a.fontSize,
      fontFamily: a.fontFamily,
      storagePath: a.storagePath,
    }));
    const { error } = await supabase.from('signed_documents').update({ layout }).eq('id', doc.id);
    if (error) throw error;
  }, [annotations, doc.id]);

  // Auto-save positions (debounced) after any change, once initial load is done
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      writeLayout().catch((e) => console.error('Auto-Speichern fehlgeschlagen', e));
    }, 800);
    return () => clearTimeout(t);
  }, [writeLayout]);

  // ---- Export / Sign ----
  const handleSign = async () => {
    if (!originalBytes || annotations.length === 0) {
      addToast('Bitte mindestens ein Element platzieren', 'error');
      return;
    }
    setSaving(true);
    try {
      const pdfDoc = await PDFDocument.load(originalBytes);
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      const pdfPages = pdfDoc.getPages();

      // Diagnostic: page geometry (helps verify WYSIWYG mapping)
      if (pdfPages[0]) {
        const mb = pdfPages[0].getMediaBox();
        const cb = pdfPages[0].getCropBox();
        console.log('[Verträge] Seite 0 geometry', {
          mediaBox: mb,
          cropBox: cb,
          rotation: pdfPages[0].getRotation().angle,
          rendered: pages[0] ? { pointWidth: pages[0].pointWidth, pointHeight: pages[0].pointHeight } : null,
        });
      }

      for (const ann of annotations) {
        const page = pdfPages[ann.page];
        const rp = pages[ann.page];
        if (!page || !rp) continue;
        // Point dimensions of the page as rendered by pdf.js.
        const pW = rp.pointWidth;
        const pH = rp.pointHeight;
        // Map a normalized (fraction) position in the RENDERED page (top-left
        // origin, y-down) to PDF user-space coordinates via pdf.js' exact
        // inverse transform (handles CropBox / MediaBox offset / rotation).
        const toPdf = (xFrac: number, yFrac: number) => rp.toPdfPoint(xFrac * pW, yFrac * pH);

        if (ann.kind === 'text') {
          const font = ann.fontFamily === 'Times New Roman' ? timesRoman : helvetica;
          const lines = (ann.text || '').split('\n');
          // Size is stored in PDF points → draw it directly (resolution-independent).
          const size = ann.fontSize || 12;
          const lineHeight = size * 1.2;
          // Baseline of the first line ≈ 1em below the box top (line-height 1.2).
          lines.forEach((line, i) => {
            // Baseline offset from the box top, in points, in rendered space.
            const baselineOffset = size + i * lineHeight;
            const [x, y] = toPdf(ann.xPct, ann.yPct + baselineOffset / pH);
            page.drawText(line, { x, y, size, font, color: rgb(0, 0, 0) });
          });
        } else if (ann.kind === 'signature' && ann.pngBytes) {
          const img = await pdfDoc.embedPng(ann.pngBytes);
          const w = ann.wPct * pW;
          const h = w / ann.aspect;
          // drawImage anchors at the bottom-left → convert the image's bottom edge.
          const [x, y] = toPdf(ann.xPct, ann.yPct + h / pH);
          page.drawImage(img, { x, y, width: w, height: h });
        } else if (ann.kind === 'stamp' && ann.pdfBytes) {
          const [emb] = await pdfDoc.embedPdf(ann.pdfBytes, [0]);
          const w = ann.wPct * pW;
          const h = w / ann.aspect;
          const [x, y] = toPdf(ann.xPct, ann.yPct + h / pH);
          page.drawPage(emb, { x, y, width: w, height: h });
        } else if (ann.kind === 'stamp' && ann.pngBytes) {
          const img = await pdfDoc.embedPng(ann.pngBytes);
          const w = ann.wPct * pW;
          const h = w / ann.aspect;
          const [x, y] = toPdf(ann.xPct, ann.yPct + h / pH);
          page.drawImage(img, { x, y, width: w, height: h });
        }
      }

      const outBytes = await pdfDoc.save();
      const signedPath = `${doc.id}/signiert_${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('signed-documents')
        .upload(signedPath, outBytes, { contentType: 'application/pdf', upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from('signed_documents')
        .update({ signed_file_path: signedPath, status: 'signed' })
        .eq('id', doc.id);
      if (dbErr) throw dbErr;

      addToast('Vertrag signiert und gespeichert', 'success');
      onSigned();
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Fehler beim Signieren', 'error');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-stretch">
      {/* Close (top-right) */}
      <button
        onClick={onClose}
        title="Schließen"
        className="absolute top-3 right-3 z-[70] p-2 rounded-full bg-white/90 text-gray-600 hover:text-gray-900 shadow-md"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <div className="w-80 bg-white flex flex-col border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 truncate">{doc.title}</h2>
        </div>

        <div className="p-4 space-y-3">
          <button
            onClick={addDateText}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            <Type className="w-4 h-4" /> Ort / Datum hinzufügen
          </button>

          <button
            onClick={() => signatureInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            <PenTool className="w-4 h-4" /> Unterschrift hochladen (PNG/JPG/WebP/AVIF)
          </button>
          <input
            ref={signatureInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleSignatureUpload(f);
              e.target.value = '';
            }}
          />

          <button
            onClick={() => stampInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
          >
            <Stamp className="w-4 h-4" /> Stempel hochladen (PDF/PNG/WebP/AVIF)
          </button>
          <input
            ref={stampInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleStampUpload(f);
              e.target.value = '';
            }}
          />
        </div>

        {/* Recent signatures */}
        {recentSignatures.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Zuletzt genutzte Unterschriften</p>
            <div className="grid grid-cols-3 gap-2">
              {recentSignatures.map((s) => (
                <div
                  key={s.id}
                  className={`relative group border rounded p-1 hover:border-primary bg-gray-50 ${
                    s.isGlobal ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  {s.isGlobal && (
                    <span
                      className="absolute -top-1.5 -left-1.5 p-0.5 rounded-full bg-blue-500 text-white shadow-sm z-10"
                      title="Globale Default-Unterschrift (für alle sichtbar)"
                    >
                      <Globe className="w-3 h-3" />
                    </span>
                  )}
                  <button
                    onClick={() => addRecentSignature(s)}
                    className="w-full"
                    title="Unterschrift einfügen"
                  >
                    <img src={s.url} alt="Unterschrift" className="h-10 w-full object-contain" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleGlobalSignature(s)}
                      title={s.isGlobal ? 'Als global deaktivieren' : 'Als global aktivieren (Default für alle)'}
                      className={`absolute -bottom-1.5 -left-1.5 p-1 rounded-full border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${
                        s.isGlobal
                          ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600'
                          : 'bg-white text-blue-500 border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  {(!s.isGlobal || isAdmin || s.userId === user?.id) && (
                    <button
                      onClick={() => deleteRecentSignature(s)}
                      title="Unterschrift löschen"
                      className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent stamps */}
        {recentStamps.length > 0 && (
          <div className="px-4 pb-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Zuletzt genutzte Stempel</p>
            <div className="grid grid-cols-3 gap-2">
              {recentStamps.map((s) => (
                <div
                  key={s.id}
                  className={`relative group border rounded p-1 hover:border-primary bg-gray-50 ${
                    s.isGlobal ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  {s.isGlobal && (
                    <span
                      className="absolute -top-1.5 -left-1.5 p-0.5 rounded-full bg-blue-500 text-white shadow-sm z-10"
                      title="Globaler Default-Stempel (für alle sichtbar)"
                    >
                      <Globe className="w-3 h-3" />
                    </span>
                  )}
                  <button
                    onClick={() => addRecentStamp(s)}
                    className="w-full"
                    title="Stempel einfügen"
                  >
                    <img src={s.url} alt="Stempel" className="h-10 w-full object-contain" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleGlobalStamp(s)}
                      title={s.isGlobal ? 'Als global deaktivieren' : 'Als global aktivieren (Default für alle)'}
                      className={`absolute -bottom-1.5 -left-1.5 p-1 rounded-full border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${
                        s.isGlobal
                          ? 'bg-blue-500 text-white border-blue-600 hover:bg-blue-600'
                          : 'bg-white text-blue-500 border-blue-300 hover:bg-blue-50'
                      }`}
                    >
                      <Star className="w-3 h-3" />
                    </button>
                  )}
                  {(!s.isGlobal || isAdmin || s.userId === user?.id) && (
                    <button
                      onClick={() => deleteRecentStamp(s)}
                      title="Stempel löschen"
                      className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-300 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected element controls */}
        {selected && (
          <div className="px-4 py-3 border-t border-gray-200 space-y-3">
            <p className="text-xs font-medium text-gray-500">Ausgewähltes Element</p>
            {selected.kind === 'text' && (
              <>
                <textarea
                  value={selected.text || ''}
                  onChange={(e) => updateSelected({ text: e.target.value })}
                  rows={2}
                  className="w-full text-sm border border-gray-300 rounded px-2 py-1"
                />
                <div>
                  <span className="text-xs text-gray-500">Schriftart</span>
                  <select
                    value={selected.fontFamily || 'Arial'}
                    onChange={(e) =>
                      updateSelected({ fontFamily: e.target.value as 'Arial' | 'Times New Roman' })
                    }
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 mt-1"
                  >
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Schriftgröße</span>
                  <button
                    onClick={() => updateSelected({ fontSize: Math.max(6, (selected.fontSize || 12) - 1) })}
                    className="p-1 border rounded"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-sm w-6 text-center">{selected.fontSize}</span>
                  <button
                    onClick={() => updateSelected({ fontSize: Math.min(48, (selected.fontSize || 12) + 1) })}
                    className="p-1 border rounded"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
            <button
              onClick={removeSelected}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-red-300 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" /> Entfernen
            </button>
          </div>
        )}

        <div className="mt-auto p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={handleSign}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Signieren & Speichern
          </button>
        </div>
      </div>

      {/* PDF viewport */}
      <div
        ref={scrollRef}
        onScroll={updateVisiblePage}
        className="flex-1 overflow-auto p-6"
        onMouseDown={() => {
          setSelectedId(null);
          setEditingId(null);
        }}
      >
        {loading ? (
          <div className="h-full flex items-center justify-center text-white">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div ref={pagesWrapperRef} className="max-w-3xl mx-auto space-y-6">
            {pages.map((p, pageIndex) => {
              // px-per-point for this page, so text (points) renders responsively
              const pageScale = pageBoxWidth && p.pointWidth ? pageBoxWidth / p.pointWidth : 1;
              return (
              <div
                key={p.pageNumber}
                ref={(el) => (pageRefs.current[pageIndex] = el)}
                className="relative bg-white shadow-lg mx-auto"
                style={{ width: '100%', aspectRatio: `${p.width} / ${p.height}` }}
                onMouseDown={() => {
                  // Clicking empty page area releases selection/focus
                  setSelectedId(null);
                  setEditingId(null);
                }}
              >
                <img src={p.dataUrl} alt={`Seite ${p.pageNumber}`} className="w-full h-full block select-none" draggable={false} />

                {annotations
                  .filter((a) => a.page === pageIndex)
                  .map((a) => (
                    <div
                      key={a.id}
                      data-ann-id={a.id}
                      onMouseDown={(e) => {
                        // Don't start a move while editing text
                        if (editingId === a.id) {
                          e.stopPropagation();
                          return;
                        }
                        startMove(e, a);
                      }}
                      className={`absolute ${editingId === a.id ? 'cursor-text' : 'cursor-move'} ${
                        editingId === a.id
                          ? ''
                          : selectedId === a.id
                          ? 'ring-2 ring-primary'
                          : 'hover:ring-1 hover:ring-primary/50'
                      }`}
                      style={{
                        left: `${a.xPct * 100}%`,
                        top: `${a.yPct * 100}%`,
                        width: a.kind === 'text' ? 'auto' : `${a.wPct * 100}%`,
                        whiteSpace: a.kind === 'text' ? 'pre' : undefined,
                      }}
                    >
                      {a.kind === 'text' ? (
                        editingId === a.id ? (
                          <span
                            ref={(el) => {
                              // Initialize content + caret once, before the element gets focus,
                              // so React re-renders don't reset the caret while typing.
                              if (el && document.activeElement !== el) {
                                el.textContent = a.text ?? '';
                                el.focus();
                                const range = document.createRange();
                                range.selectNodeContents(el);
                                range.collapse(false);
                                const sel = window.getSelection();
                                sel?.removeAllRanges();
                                sel?.addRange(range);
                              }
                            }}
                            contentEditable
                            suppressContentEditableWarning
                            onMouseDown={(e) => e.stopPropagation()}
                            onInput={(e) =>
                              setAnnotations((prev) =>
                                prev.map((x) =>
                                  x.id === a.id ? { ...x, text: e.currentTarget.textContent ?? '' } : x
                                )
                              )
                            }
                            onBlur={() => setEditingId(null)}
                            style={{
                              fontSize: `${(a.fontSize || 12) * pageScale}px`,
                              lineHeight: 1.2,
                              outline: 'none',
                              fontFamily: fontCss(a.fontFamily),
                            }}
                            className="text-black"
                          />
                        ) : (
                          <span
                            onClick={(e) => {
                              // Click into the text to edit it (caret + editable)
                              e.stopPropagation();
                              setSelectedId(a.id);
                              setEditingId(a.id);
                            }}
                            style={{
                              fontSize: `${(a.fontSize || 12) * pageScale}px`,
                              lineHeight: 1.2,
                              fontFamily: fontCss(a.fontFamily),
                            }}
                            className="text-black"
                          >
                            {a.text}
                          </span>
                        )
                      ) : (
                        <img src={a.previewUrl} alt={a.kind} className="w-full h-auto pointer-events-none" draggable={false} />
                      )}

                      {selectedId === a.id && editingId !== a.id &&
                        (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                          <div
                            key={corner}
                            onMouseDown={(e) => startResize(e, a, corner)}
                            className={`absolute w-3 h-3 bg-primary border border-white rounded-full ${
                              corner === 'nw'
                                ? '-top-1.5 -left-1.5 cursor-nwse-resize'
                                : corner === 'ne'
                                ? '-top-1.5 -right-1.5 cursor-nesw-resize'
                                : corner === 'sw'
                                ? '-bottom-1.5 -left-1.5 cursor-nesw-resize'
                                : '-bottom-1.5 -right-1.5 cursor-nwse-resize'
                            }`}
                          />
                        ))}
                    </div>
                  ))}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ---- helpers ----
function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function fontCss(family?: 'Arial' | 'Times New Roman') {
  return family === 'Times New Roman' ? '"Times New Roman", Times, serif' : 'Arial, Helvetica, sans-serif';
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getImageAspect(url: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
    img.onerror = () => resolve(1);
    img.src = url;
  });
}

// Decodes any browser-supported image (PNG/JPEG/WebP/AVIF) and re-encodes it as
// PNG so it can be embedded via pdf-lib (which only supports PNG/JPG).
function convertImageToPng(
  file: Blob
): Promise<{ pngBytes: Uint8Array; aspect: number; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context nicht verfügbar');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve({ pngBytes: dataUrlToUint8(dataUrl), aspect: w / h || 1, dataUrl });
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild konnte nicht dekodiert werden'));
    };
    img.src = url;
  });
}

function dataUrlToUint8(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
