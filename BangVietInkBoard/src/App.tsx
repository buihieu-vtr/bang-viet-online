import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { HelpGuideModal } from './components/HelpGuideModal';
import { InsertMathModal } from './components/InsertMathModal';
import { NotebooksModal } from './components/NotebooksModal';
import { PagesDrawer } from './components/PagesDrawer';
import { SaveAsModal } from './components/SaveAsModal';
import { ToolDock } from './components/ToolDock';
import { TopBar } from './components/TopBar';
import { WebLinkModal } from './components/WebLinkModal';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import {
  BoardElement,
  BoardPage,
  DEFAULT_CHALK_SLOTS,
  DEFAULT_PEN_SLOTS,
  EraserMode,
  ImageItem,
  NotebookDocument,
  PAGE_DIMENSIONS,
  PageSizeMode,
  PaperTemplate,
  PenSlot,
  RulerState,
  SelectMode,
  ShapeItem,
  ShapeType,
  StickyItem,
  TextItem,
  ToolType,
  ViewportState,
} from './types/inkboard';
import { uid } from './utils/geometry';
import { isDarkBoardTemplate } from './utils/renderer';
import {
  createBlankNotebook,
  createBlankPage,
  decodeBoardFromHash,
  deleteNotebookFromDB,
  exportNotebookToPDF,
  exportPageToPNG,
  exportPageToSVG,
  FSFileHandle,
  getLastActiveNotebookId,
  isTopLevelWindow,
  listNotebooks,
  parseInkboardJSON,
  saveAsInkboardFile,
  saveNotebookToDB,
  setLastActiveNotebookId,
  writeDocToFileHandle,
} from './utils/storage';

interface PageHistory {
  past: BoardElement[][];
  future: BoardElement[][];
}

export default function App() {
  const [notebooks, setNotebooks] = useState<NotebookDocument[]>([]);
  const [doc, setDoc] = useState<NotebookDocument>(() =>
    createBlankNotebook('Bảng viết của tôi', 'blank')
  );
  const [ready, setReady] = useState(false);

  // Tools & UI state
  const [activeTool, setActiveTool] = useState<ToolType>('pen');
  const [penSlots, setPenSlots] = useState<PenSlot[]>(DEFAULT_PEN_SLOTS);
  const [activeSlotId, setActiveSlotId] = useState<string>(DEFAULT_PEN_SLOTS[0].id);
  const [selectMode, setSelectMode] = useState<SelectMode>('lasso');
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [eraserSize, setEraserSize] = useState<number>(24);
  const [activeShape, setActiveShape] = useState<ShapeType>('rect');
  const [shapeStrokeColor, setShapeStrokeColor] = useState<string>('#2563EB');
  const [shapeFillColor, setShapeFillColor] = useState<string>('transparent');
  const [shapeDashed, setShapeDashed] = useState<boolean>(false);
  const [inkToShape, setInkToShape] = useState<boolean>(false);
  const [stylusOnly, setStylusOnly] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [pagesDrawerOpen, setPagesDrawerOpen] = useState<boolean>(false);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [saveAsOpen, setSaveAsOpen] = useState<boolean>(false);
  const [webLinkOpen, setWebLinkOpen] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [mathModalOpen, setMathModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Viewport & Selection & Ruler
  const [viewport, setViewport] = useState<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ruler, setRuler] = useState<RulerState>({
    visible: false,
    x: 520,
    y: 340,
    angleDeg: 0,
    length: 560,
  });

  // Undo/Redo history per page
  const [historyMap, setHistoryMap] = useState<Record<string, PageHistory>>({});

  // Save state & linked OS file handle
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [linkedFileHandle, setLinkedFileHandle] = useState<FSFileHandle | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const inkboardInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const syncPaletteForTemplate = useCallback((tpl: PaperTemplate) => {
    if (isDarkBoardTemplate(tpl)) {
      setPenSlots(DEFAULT_CHALK_SLOTS);
      setActiveSlotId(DEFAULT_CHALK_SLOTS[0].id);
      setActiveTool(DEFAULT_CHALK_SLOTS[0].tool);
      setShapeStrokeColor('#F8FAFC');
    } else {
      setPenSlots(DEFAULT_PEN_SLOTS);
      setActiveSlotId(DEFAULT_PEN_SLOTS[0].id);
      setActiveTool(DEFAULT_PEN_SLOTS[0].tool);
      setShapeStrokeColor('#2563EB');
    }
  }, []);

  // Load notebooks from URL hash (#ten=...&board=...) OR IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await listNotebooks();
        if (!mounted) return;
        setNotebooks(list);

        // 1. Check serverless URL hash (#ten=...&board=... or #board=...)
        if (window.location.hash && window.location.hash.length > 1) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          const payload = hashParams.get('board');
          const tenParam = hashParams.get('ten');
          if (payload) {
            const hashDoc = await decodeBoardFromHash(payload);
            if (!mounted) return;
            if (hashDoc) {
              const normalizedDoc: NotebookDocument = {
                ...hashDoc,
                slug: hashDoc.slug || tenParam || undefined,
              };
              await saveNotebookToDB(normalizedDoc);
              setDoc(normalizedDoc);
              const firstPage =
                normalizedDoc.pages.find((p) => p.id === normalizedDoc.activePageId) ||
                normalizedDoc.pages[0];
              if (firstPage && isDarkBoardTemplate(firstPage.template)) {
                setPenSlots(DEFAULT_CHALK_SLOTS);
                setActiveSlotId(DEFAULT_CHALK_SLOTS[0].id);
                setActiveTool(DEFAULT_CHALK_SLOTS[0].tool);
                setShapeStrokeColor('#F8FAFC');
              }
              showToast(`Đã mở bảng chia sẻ: ${normalizedDoc.title}`);
              setReady(true);
              return;
            }
          }
        }

        const lastId = await getLastActiveNotebookId();
        if (list.length > 0) {
          const active = list.find((n) => n.id === lastId) || list[0];
          setDoc(active);
          const activeP = active.pages.find((p) => p.id === active.activePageId) || active.pages[0];
          if (activeP && isDarkBoardTemplate(activeP.template)) {
            setPenSlots(DEFAULT_CHALK_SLOTS);
            setActiveSlotId(DEFAULT_CHALK_SLOTS[0].id);
            setActiveTool(DEFAULT_CHALK_SLOTS[0].tool);
            setShapeStrokeColor('#F8FAFC');
          }
        } else {
          const initial = createBlankNotebook('Bảng viết của tôi', 'blank');
          await saveNotebookToDB(initial);
          await setLastActiveNotebookId(initial.id);
          if (!mounted) return;
          setNotebooks([initial]);
          setDoc(initial);
        }
      } catch {
        // Fallback already initialized
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Fullscreen listener
  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Auto-save debounced to IndexedDB
  useEffect(() => {
    if (!ready) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await saveNotebookToDB(doc);
        await setLastActiveNotebookId(doc.id);
        setNotebooks((prev) => {
          const idx = prev.findIndex((n) => n.id === doc.id);
          if (idx === -1) return [doc, ...prev];
          const copy = [...prev];
          copy[idx] = doc;
          return copy.sort((a, b) => b.updatedAt - a.updatedAt);
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('saved');
      }
    }, 550);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [doc, ready]);

  const activePageIndex = useMemo(() => {
    const idx = doc.pages.findIndex((p) => p.id === doc.activePageId);
    return idx >= 0 ? idx : 0;
  }, [doc.pages, doc.activePageId]);

  const activePage = doc.pages[activePageIndex] || doc.pages[0];

  const activePenSlot = useMemo(
    () => penSlots.find((s) => s.id === activeSlotId) || penSlots[0],
    [penSlots, activeSlotId]
  );

  const pageHistory = historyMap[activePage.id] || { past: [], future: [] };

  const updateActivePage = useCallback(
    (updater: (page: BoardPage) => BoardPage) => {
      setDoc((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        pages: prev.pages.map((p) =>
          p.id === activePage.id ? updater(p) : p
        ),
      }));
    },
    [activePage.id]
  );

  const handleTemplateChange = useCallback(
    (template: PaperTemplate) => {
      const wasDark = isDarkBoardTemplate(activePage.template);
      const willBeDark = isDarkBoardTemplate(template);
      updateActivePage((p) => ({ ...p, template }));
      if (wasDark !== willBeDark) {
        syncPaletteForTemplate(template);
      }
    },
    [activePage.template, updateActivePage, syncPaletteForTemplate]
  );

  const handleCommitElements = useCallback(
    (nextElements: BoardElement[]) => {
      const prevElements = activePage.elements;
      setHistoryMap((prev) => {
        const cur = prev[activePage.id] || { past: [], future: [] };
        return {
          ...prev,
          [activePage.id]: {
            past: [...cur.past.slice(-49), prevElements],
            future: [],
          },
        };
      });
      updateActivePage((p) => ({ ...p, elements: nextElements }));
    },
    [activePage.id, activePage.elements, updateActivePage]
  );

  const handleUndo = useCallback(() => {
    const cur = historyMap[activePage.id];
    if (!cur || cur.past.length === 0) return;
    const previous = cur.past[cur.past.length - 1];
    const currentElements = activePage.elements;
    setHistoryMap((prev) => ({
      ...prev,
      [activePage.id]: {
        past: cur.past.slice(0, -1),
        future: [currentElements, ...cur.future],
      },
    }));
    updateActivePage((p) => ({ ...p, elements: previous }));
    setSelectedIds([]);
  }, [historyMap, activePage.id, activePage.elements, updateActivePage]);

  const handleRedo = useCallback(() => {
    const cur = historyMap[activePage.id];
    if (!cur || cur.future.length === 0) return;
    const next = cur.future[0];
    const currentElements = activePage.elements;
    setHistoryMap((prev) => ({
      ...prev,
      [activePage.id]: {
        past: [...cur.past, currentElements],
        future: cur.future.slice(1),
      },
    }));
    updateActivePage((p) => ({ ...p, elements: next }));
    setSelectedIds([]);
  }, [historyMap, activePage.id, activePage.elements, updateActivePage]);

  // Save / Save As / Open handlers
  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    await saveNotebookToDB(doc);
    if (linkedFileHandle) {
      try {
        await writeDocToFileHandle(linkedFileHandle, doc);
        showToast(`Đã lưu vào ${linkedFileHandle.name}`);
      } catch {
        showToast('Đã lưu vào thư viện cục bộ');
      }
    } else {
      showToast('Đã lưu bảng viết vào bộ nhớ trình duyệt');
    }
    setSaveStatus('saved');
  }, [doc, linkedFileHandle, showToast]);

  const handleOpenFileTrigger = useCallback(async () => {
    if (isTopLevelWindow() && 'showOpenFilePicker' in window) {
      try {
        const picker = (window as unknown as {
          showOpenFilePicker: (opts: unknown) => Promise<(FSFileHandle & { getFile(): Promise<File> })[]>;
        }).showOpenFilePicker;
        const [handle] = await picker({
          types: [
            {
              description: 'InkBoard Web Project (.scrbleweb, .inkboard, .json)',
              accept: {
                'application/octet-stream': ['.scrbleweb', '.inkboard'],
                'application/json': ['.json', '.scrbleweb', '.inkboard'],
              },
            },
          ],
          multiple: false,
        });
        const file = await handle.getFile();
        const text = await file.text();
        const imported = parseInkboardJSON(text);
        await saveNotebookToDB(imported);
        setDoc(imported);
        setLinkedFileHandle(handle);
        window.history.replaceState(null, '', window.location.pathname);
        setSelectedIds([]);
        setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
        showToast(`Đã mở tệp ${file.name}`);
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    inkboardInputRef.current?.click();
  }, [showToast]);

  const handleImportFileFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parseInkboardJSON(text);
      await saveNotebookToDB(imported);
      setDoc(imported);
      setLinkedFileHandle(null);
      window.history.replaceState(null, '', window.location.pathname);
      setSelectedIds([]);
      setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      showToast(`Đã mở tệp ${file.name}`);
    } catch {
      showToast('Không thể đọc tệp bảng viết này.');
    }
  };

  const handleSaveAsCopyInLibrary = async (newTitle: string) => {
    const clone: NotebookDocument = {
      ...JSON.parse(JSON.stringify(doc)),
      id: uid('nb'),
      slug: undefined,
      title: newTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveNotebookToDB(clone);
    setDoc(clone);
    setLinkedFileHandle(null);
    window.history.replaceState(null, '', window.location.pathname);
    showToast(`Đã lưu bản sao "${newTitle}" vào Sổ tay`);
  };

  const handleSaveAsDiskFile = async (
    newTitle: string,
    ext: '.inkboard' | '.scrbleweb' | '.json' = '.scrbleweb'
  ) => {
    const updated = { ...doc, title: newTitle, updatedAt: Date.now() };
    setDoc(updated);
    const result = await saveAsInkboardFile(updated, newTitle, ext);
    if (!result.filename) return;
    if (result.handle) {
      setLinkedFileHandle(result.handle);
      showToast(`Đã lưu tệp ${result.filename}`);
    } else {
      showToast(`Đã tải "${result.filename}" vào thư mục Downloads (Ctrl+J để xem)`);
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) setSaveAsOpen(true);
        else handleSave();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFileTrigger();
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'p') setActiveTool('pen');
        else if (k === 'e') setActiveTool('eraser');
        else if (k === 't') setActiveTool('text');
        else if (k === 'v') setActiveTool('select');
        else if (k === 'h') setActiveTool('pan');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleSave, handleOpenFileTrigger]);

  const getWorldCenter = () => ({
    x: (window.innerWidth / 2 - viewport.offsetX) / viewport.zoom,
    y: (window.innerHeight / 2 - viewport.offsetY) / viewport.zoom,
  });

  const insertImageDataUrl = (src: string) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 480;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = img.width * scale;
      const h = img.height * scale;
      const center = getWorldCenter();
      const item: ImageItem = {
        id: uid('img'),
        type: 'image',
        x: center.x - w / 2,
        y: center.y - h / 2,
        width: w,
        height: h,
        rotation: 0,
        src,
        opacity: 1,
      };
      handleCommitElements([...activePage.elements, item]);
      setSelectedIds([item.id]);
      setActiveTool('select');
    };
    img.src = src;
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        insertImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInsertSticky = (bg: string, textColor: string) => {
    const center = getWorldCenter();
    const sticky: StickyItem = {
      id: uid('sticky'),
      type: 'sticky',
      x: center.x - 110,
      y: center.y - 110,
      width: 220,
      height: 200,
      rotation: 0,
      text: 'Nhấn đúp để nhập ghi chú...',
      noteColor: bg,
      textColor,
      fontSize: 16,
    };
    handleCommitElements([...activePage.elements, sticky]);
    setSelectedIds([sticky.id]);
    setActiveTool('select');
  };

  const handleInsertMathText = (expr: string) => {
    const center = getWorldCenter();
    const isDarkPaper = isDarkBoardTemplate(activePage.template);
    const item: TextItem = {
      id: uid('text'),
      type: 'text',
      x: center.x - 160,
      y: center.y - 30,
      width: 340,
      height: 70,
      rotation: 0,
      text: expr,
      fontSize: 24,
      fontFamily: '"JetBrains Mono", monospace',
      color: isDarkPaper ? '#F8FAFC' : '#0F172A',
      bold: false,
      italic: false,
      align: 'left',
      bgColor: 'transparent',
    };
    handleCommitElements([...activePage.elements, item]);
    setSelectedIds([item.id]);
    setActiveTool('select');
  };

  const handleInsertPresetShape = (shapeType: 'axes' | 'table') => {
    const center = getWorldCenter();
    const isDarkPaper = isDarkBoardTemplate(activePage.template);
    const shape: ShapeItem = {
      id: uid('shape'),
      type: 'shape',
      shapeType,
      x: center.x - 200,
      y: center.y - 160,
      width: 400,
      height: 320,
      rotation: 0,
      strokeColor: isDarkPaper ? '#E2E8F0' : '#0F172A',
      fillColor: 'transparent',
      fillOpacity: 0,
      strokeWidth: 2.5,
      rows: 3,
      cols: 3,
    };
    handleCommitElements([...activePage.elements, shape]);
    setSelectedIds([shape.id]);
    setActiveTool('select');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') insertImageDataUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else if (
      file.name.endsWith('.inkboard') ||
      file.name.endsWith('.scrbleweb') ||
      file.name.endsWith('.json')
    ) {
      file.text().then(async (txt) => {
        try {
          const imported = parseInkboardJSON(txt);
          await saveNotebookToDB(imported);
          setDoc(imported);
          window.history.replaceState(null, '', window.location.pathname);
          showToast(`Đã mở ${file.name}`);
        } catch {
          showToast('Tệp không hợp lệ.');
        }
      });
    }
  };

  const handleAddPage = () => {
    const newPage = createBlankPage(
      `Trang ${doc.pages.length + 1}`,
      activePage.template,
      activePage.pageSize
    );
    setDoc((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      activePageId: newPage.id,
      pages: [...prev.pages, newPage],
    }));
    setSelectedIds([]);
  };

  const handleDuplicatePage = (pageId: string) => {
    const target = doc.pages.find((p) => p.id === pageId);
    if (!target) return;
    const clone: BoardPage = {
      ...JSON.parse(JSON.stringify(target)),
      id: uid('page'),
      title: `${target.title} (Bản sao)`,
    };
    const idx = doc.pages.findIndex((p) => p.id === pageId);
    const nextPages = [...doc.pages];
    nextPages.splice(idx + 1, 0, clone);
    setDoc((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      activePageId: clone.id,
      pages: nextPages,
    }));
  };

  const handleDeletePage = (pageId: string) => {
    if (doc.pages.length <= 1) return;
    const idx = doc.pages.findIndex((p) => p.id === pageId);
    const nextPages = doc.pages.filter((p) => p.id !== pageId);
    const fallback = nextPages[Math.max(0, idx - 1)] || nextPages[0];
    setDoc((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      activePageId: prev.activePageId === pageId ? fallback.id : prev.activePageId,
      pages: nextPages,
    }));
    setSelectedIds([]);
  };

  const handleMovePage = (pageId: string, dir: -1 | 1) => {
    const idx = doc.pages.findIndex((p) => p.id === pageId);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= doc.pages.length) return;
    const next = [...doc.pages];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);
    setDoc((prev) => ({ ...prev, updatedAt: Date.now(), pages: next }));
  };

  const handleFitScreen = () => {
    if (activePage.pageSize === 'infinite') {
      setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      return;
    }
    const dims = PAGE_DIMENSIONS[activePage.pageSize];
    const availW = window.innerWidth - (pagesDrawerOpen ? 360 : 100);
    const availH = window.innerHeight - 96;
    const z = Math.min(availW / dims.width, availH / dims.height, 1.2);
    setViewport({
      zoom: z,
      offsetX: (window.innerWidth - dims.width * z) / 2,
      offsetY: (window.innerHeight - 56 - dims.height * z) / 2,
    });
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="h-screen w-screen flex flex-col bg-slate-100 dark:bg-[#0F1115] text-slate-900 dark:text-slate-100 overflow-hidden"
    >
      {/* Top Studio Bar */}
      <TopBar
        title={doc.title}
        onTitleChange={(title) =>
          setDoc((prev) => ({ ...prev, title, updatedAt: Date.now() }))
        }
        canUndo={pageHistory.past.length > 0}
        canRedo={pageHistory.future.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
        penSlots={penSlots}
        activeSlotId={activeSlotId}
        activeTool={activeTool}
        onSelectPenSlot={(slot) => {
          setActiveSlotId(slot.id);
          setActiveTool(slot.tool);
        }}
        onUpdatePenSlot={(updated) => {
          setPenSlots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          setActiveTool(updated.tool);
        }}
        inkToShape={inkToShape}
        onToggleInkToShape={() => setInkToShape((v) => !v)}
        rulerVisible={ruler.visible}
        onToggleRuler={() =>
          setRuler((prev) => ({
            ...prev,
            visible: !prev.visible,
            x: !prev.visible ? getWorldCenter().x : prev.x,
            y: !prev.visible ? getWorldCenter().y : prev.y,
          }))
        }
        stylusOnly={stylusOnly}
        onToggleStylusOnly={() => setStylusOnly((v) => !v)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
        pagesDrawerOpen={pagesDrawerOpen}
        onTogglePagesDrawer={() => setPagesDrawerOpen((v) => !v)}
        pageIndex={activePageIndex}
        pageCount={doc.pages.length}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenLibrary={() => setLibraryOpen(true)}
        onNewNotebook={async () => {
          const nb = createBlankNotebook(`Bảng viết ${notebooks.length + 1}`, activePage.template);
          await saveNotebookToDB(nb);
          setDoc(nb);
          setLinkedFileHandle(null);
          window.history.replaceState(null, '', window.location.pathname);
          setSelectedIds([]);
          setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
          showToast('Đã tạo bảng viết mới');
        }}
        onOpenFile={handleOpenFileTrigger}
        onSave={handleSave}
        onOpenSaveAs={() => setSaveAsOpen(true)}
        onOpenWebLink={() => setWebLinkOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        activeSlug={doc.slug || null}
        activeTemplate={activePage.template}
        onQuickSwitchBoard={handleTemplateChange}
        onExportPNG={async (transparent) => {
          await exportPageToPNG(
            activePage,
            `${doc.title}_Trang_${activePageIndex + 1}`,
            transparent
          );
          showToast('Đã xuất ảnh PNG');
        }}
        onExportSVG={() => {
          exportPageToSVG(activePage, `${doc.title}_Trang_${activePageIndex + 1}`);
          showToast('Đã xuất tệp Vector SVG');
        }}
        onExportPDF={async () => {
          showToast('Đang tạo tài liệu PDF...');
          await exportNotebookToPDF(doc);
          showToast('Đã xuất tệp PDF thành công');
        }}
        saveStatus={saveStatus}
        linkedFileName={linkedFileHandle?.name ?? null}
      />

      {/* Main Workspace Area */}
      <div className="relative flex-1 flex overflow-hidden">
        <ToolDock
          activeTool={activeTool}
          onSelectTool={(t) => {
            if (t === 'pen' || t === 'pencil' || t === 'highlighter') {
              const match = penSlots.find((s) => s.tool === t);
              if (match) setActiveSlotId(match.id);
            }
            setActiveTool(t);
          }}
          selectMode={selectMode}
          onSelectModeChange={setSelectMode}
          eraserMode={eraserMode}
          onEraserModeChange={setEraserMode}
          eraserSize={eraserSize}
          onEraserSizeChange={setEraserSize}
          onClearPage={() => {
            if (activePage.elements.length > 0) {
              handleCommitElements([]);
              setSelectedIds([]);
            }
          }}
          activeShape={activeShape}
          onSelectShape={setActiveShape}
          shapeStrokeColor={shapeStrokeColor}
          onShapeStrokeColorChange={setShapeStrokeColor}
          shapeFillColor={shapeFillColor}
          onShapeFillColorChange={setShapeFillColor}
          shapeDashed={shapeDashed}
          onShapeDashedChange={setShapeDashed}
          onTriggerImageUpload={() => imageInputRef.current?.click()}
          onInsertSticky={handleInsertSticky}
          onInsertMath={() => setMathModalOpen(true)}
          onInsertAxesPreset={() => handleInsertPresetShape('axes')}
          onInsertTablePreset={() => handleInsertPresetShape('table')}
          zoom={viewport.zoom}
          onZoomIn={() =>
            setViewport((v) => ({ ...v, zoom: Math.min(4, v.zoom * 1.15) }))
          }
          onZoomOut={() =>
            setViewport((v) => ({ ...v, zoom: Math.max(0.2, v.zoom * 0.85) }))
          }
          onZoomReset={() => setViewport((v) => ({ ...v, zoom: 1 }))}
          onFitScreen={handleFitScreen}
        />

        <WhiteboardCanvas
          page={activePage}
          viewport={viewport}
          onViewportChange={setViewport}
          activeTool={activeTool}
          activePenSlot={activePenSlot}
          selectMode={selectMode}
          eraserMode={eraserMode}
          eraserSize={eraserSize}
          activeShape={activeShape}
          shapeStrokeColor={shapeStrokeColor}
          shapeFillColor={shapeFillColor}
          shapeDashed={shapeDashed}
          inkToShape={inkToShape}
          stylusOnly={stylusOnly}
          darkMode={darkMode}
          ruler={ruler}
          onRulerChange={setRuler}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onCommitElements={handleCommitElements}
          onSelectTool={setActiveTool}
        />

        {/* Quick Bottom-Center Multi-Page Switcher */}
        {doc.pages.length > 1 && (
          <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1 rounded-xl bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-md select-none">
            <button
              type="button"
              disabled={activePageIndex === 0}
              onClick={() => {
                setDoc((prev) => ({
                  ...prev,
                  activePageId: prev.pages[activePageIndex - 1].id,
                }));
                setSelectedIds([]);
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono-tabular font-medium text-slate-700 dark:text-slate-200">
              Trang {activePageIndex + 1} / {doc.pages.length}
            </span>
            <button
              type="button"
              disabled={activePageIndex === doc.pages.length - 1}
              onClick={() => {
                setDoc((prev) => ({
                  ...prev,
                  activePageId: prev.pages[activePageIndex + 1].id,
                }));
                setSelectedIds([]);
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right Pages & Templates Drawer */}
        <PagesDrawer
          open={pagesDrawerOpen}
          onClose={() => setPagesDrawerOpen(false)}
          pages={doc.pages}
          activePageId={activePage.id}
          onSelectPage={(id) => {
            setDoc((prev) => ({ ...prev, activePageId: id }));
            setSelectedIds([]);
          }}
          onAddPage={handleAddPage}
          onDuplicatePage={handleDuplicatePage}
          onDeletePage={handleDeletePage}
          onMovePage={handleMovePage}
          onChangeTemplate={handleTemplateChange}
          onChangePageSize={(pageSize: PageSizeMode) => {
            updateActivePage((p) => ({ ...p, pageSize }));
          }}
          onChangeGridSize={(gridSize: number) => {
            updateActivePage((p) => ({ ...p, gridSize }));
          }}
        />
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileSelect}
        className="hidden"
      />
      <input
        ref={inkboardInputRef}
        type="file"
        accept=".inkboard,.scrbleweb,.json"
        onChange={handleImportFileFallback}
        className="hidden"
      />

      {/* Modals */}
      <WebLinkModal
        open={webLinkOpen}
        onClose={() => setWebLinkOpen(false)}
        currentDoc={doc}
        onUpdateUrlHash={(hash, slugLabel) => {
          window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
          setDoc((prev) => ({ ...prev, slug: slugLabel, updatedAt: Date.now() }));
          showToast('Đã gắn link chia sẻ lên thanh địa chỉ trình duyệt');
        }}
        onDownloadProjectFile={() => handleSaveAsDiskFile(doc.title, '.scrbleweb')}
      />

      <NotebooksModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        notebooks={notebooks}
        activeId={doc.id}
        onSelectNotebook={(nb) => {
          setDoc(nb);
          setLinkedFileHandle(null);
          window.history.replaceState(null, '', window.location.pathname);
          setSelectedIds([]);
          setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
        }}
        onCreateNotebook={async () => {
          const nb = createBlankNotebook(`Bảng viết ${notebooks.length + 1}`, activePage.template);
          await saveNotebookToDB(nb);
          setDoc(nb);
          setLinkedFileHandle(null);
          window.history.replaceState(null, '', window.location.pathname);
          setLibraryOpen(false);
          setSelectedIds([]);
        }}
        onDuplicateNotebook={async (nb) => {
          const clone: NotebookDocument = {
            ...JSON.parse(JSON.stringify(nb)),
            id: uid('nb'),
            slug: undefined,
            title: `${nb.title} (Bản sao)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveNotebookToDB(clone);
          setNotebooks((prev) => [clone, ...prev]);
          showToast('Đã nhân bản sổ tay');
        }}
        onDeleteNotebook={async (id) => {
          await deleteNotebookFromDB(id);
          const remaining = notebooks.filter((n) => n.id !== id);
          setNotebooks(remaining);
          if (doc.id === id && remaining.length > 0) {
            setDoc(remaining[0]);
          }
          showToast('Đã xóa sổ tay');
        }}
        onImportFile={() => {
          setLibraryOpen(false);
          handleOpenFileTrigger();
        }}
      />

      <SaveAsModal
        open={saveAsOpen}
        onClose={() => setSaveAsOpen(false)}
        currentTitle={doc.title}
        onOpenWebLink={() => setWebLinkOpen(true)}
        onSaveAsCopyInLibrary={handleSaveAsCopyInLibrary}
        onSaveAsDiskFile={handleSaveAsDiskFile}
        onExportPNG={async (transparent) => {
          await exportPageToPNG(
            activePage,
            `${doc.title}_Trang_${activePageIndex + 1}`,
            transparent
          );
          showToast('Đã xuất ảnh PNG');
        }}
        onExportSVG={() => {
          exportPageToSVG(activePage, `${doc.title}_Trang_${activePageIndex + 1}`);
          showToast('Đã xuất tệp Vector SVG');
        }}
        onExportPDF={async () => {
          showToast('Đang tạo tài liệu PDF...');
          await exportNotebookToPDF(doc);
          showToast('Đã xuất tệp PDF thành công');
        }}
      />

      <InsertMathModal
        open={mathModalOpen}
        onClose={() => setMathModalOpen(false)}
        onInsertText={handleInsertMathText}
      />

      <HelpGuideModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
