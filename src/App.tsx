import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { HelpGuideModal } from './components/HelpGuideModal';
import { InsertMathModal } from './components/InsertMathModal';
import { NotebooksModal } from './components/NotebooksModal';
import { PagesDrawer } from './components/PagesDrawer';
import { PageTocSidebar } from './components/PageTocSidebar';
import { SaveAsModal } from './components/SaveAsModal';
import { ToolDock } from './components/ToolDock';
import { TopBar } from './components/TopBar';
import { WebLinkModal } from './components/WebLinkModal';
import { WhiteboardCanvas } from './components/WhiteboardCanvas';
import { auth } from './firebase';
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
import {
  deleteNotebookFromCloud,
  loadUserCustomColorsFromCloud,
  loadUserNotebooksFromCloud,
  saveNotebookToCloud,
  saveUserCustomColorsToCloud,
  syncUserProfileOnLogin,
} from './utils/cloudSync';
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
  listNotebooks,
  loadLocalCustomColors,
  parseInkboardJSON,
  saveAsInkboardFile,
  saveLocalCustomColors,
  saveNotebookToDB,
  setLastActiveNotebookId,
  writeDocToFileHandle,
} from './utils/storage';

interface PageHistory {
  past: BoardElement[][];
  future: BoardElement[][];
}

const PAGE_GAP = 48;

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authRefreshKey, setAuthRefreshKey] = useState(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const ownerScope = authUser?.uid || 'guest';

  const [notebooks, setNotebooks] = useState<NotebookDocument[]>([]);
  const [doc, setDoc] = useState<NotebookDocument>(() =>
    createBlankNotebook('Bảng viết của tôi', 'blank', undefined, 'infinite', 'guest')
  );
  const [ready, setReady] = useState(false);

  // User custom colors
  const [customColors, setCustomColors] = useState<string[]>(() =>
    loadLocalCustomColors('guest')
  );

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
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [pagesDrawerOpen, setPagesDrawerOpen] = useState<boolean>(false);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [saveAsOpen, setSaveAsOpen] = useState<boolean>(false);
  const [webLinkOpen, setWebLinkOpen] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [mathModalOpen, setMathModalOpen] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isCompactViewport, setIsCompactViewport] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.innerWidth < 768 || window.innerHeight <= 540
      : false
  );

  useEffect(() => {
    const onResize = () => {
      setIsCompactViewport(window.innerWidth < 768 || window.innerHeight <= 540);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Viewport, Scroll request, Selection & Ruler
  const [viewport, setViewport] = useState<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  });
  const [scrollToPageRequest, setScrollToPageRequest] = useState<{
    pageId: string;
    seq: number;
  } | null>(null);
  const scrollSeqRef = useRef(0);
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
  const hashConsumedRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  const triggerScrollToPage = useCallback((pageId: string) => {
    scrollSeqRef.current += 1;
    setScrollToPageRequest({ pageId, seq: scrollSeqRef.current });
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

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Load isolated notebooks + custom colors whenever authUser / ownerScope changes
  useEffect(() => {
    if (!authReady) return;
    let mounted = true;
    setReady(false);
    setSelectedIds([]);
    setHistoryMap({});
    setLinkedFileHandle(null);

    (async () => {
      try {
        const localColors = loadLocalCustomColors(ownerScope);
        setCustomColors(localColors);

        let localList = await listNotebooks(ownerScope);
        if (!mounted) return;

        // If authenticated & verified, sync profile, custom colors, and Firestore notebooks
        if (authUser && authUser.emailVerified) {
          try {
            await syncUserProfileOnLogin(authUser);
            const cloudColors = await loadUserCustomColorsFromCloud(authUser.uid);
            if (!mounted) return;
            if (cloudColors && cloudColors.length > 0) {
              setCustomColors(cloudColors);
              saveLocalCustomColors(cloudColors, ownerScope);
            } else {
              await saveUserCustomColorsToCloud(authUser.uid, localColors);
            }

            const cloudList = await loadUserNotebooksFromCloud(authUser.uid);
            if (!mounted) return;

            const mergedMap = new Map<string, NotebookDocument>();
            for (const c of cloudList) mergedMap.set(c.id, c);
            for (const l of localList) {
              const existing = mergedMap.get(l.id);
              if (!existing || l.updatedAt > existing.updatedAt) {
                mergedMap.set(l.id, { ...l, ownerId: ownerScope });
              }
            }
            const merged = Array.from(mergedMap.values()).sort(
              (a, b) => b.updatedAt - a.updatedAt
            );
            for (const nb of merged) {
              await saveNotebookToDB(nb, ownerScope);
            }
            localList = merged;
          } catch (err) {
            console.error('Cloud sync warning:', err);
          }
        }

        if (!mounted) return;
        setNotebooks(localList);

        // 1. Check serverless URL hash once on startup (#ten=...&board=... or #board=...)
        if (!hashConsumedRef.current && window.location.hash && window.location.hash.length > 1) {
          hashConsumedRef.current = true;
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          const payload = hashParams.get('board');
          const tenParam = hashParams.get('ten');
          if (payload) {
            const hashDoc = await decodeBoardFromHash(payload);
            if (!mounted) return;
            if (hashDoc) {
              const normalizedDoc: NotebookDocument = {
                ...hashDoc,
                ownerId: ownerScope,
                slug: hashDoc.slug || tenParam || undefined,
              };
              await saveNotebookToDB(normalizedDoc, ownerScope);
              setDoc(normalizedDoc);
              setNotebooks((prev) => [
                normalizedDoc,
                ...prev.filter((n) => n.id !== normalizedDoc.id),
              ]);
              const firstPage =
                normalizedDoc.pages.find((p) => p.id === normalizedDoc.activePageId) ||
                normalizedDoc.pages[0];
              if (firstPage) {
                syncPaletteForTemplate(firstPage.template);
                if (firstPage.pageSize !== 'infinite' && window.innerWidth >= 768) {
                  setTocOpen(true);
                }
              }
              showToast(`Đã mở bảng chia sẻ: ${normalizedDoc.title}`);
              setReady(true);
              return;
            }
          }
        }
        hashConsumedRef.current = true;

        const lastId = await getLastActiveNotebookId(ownerScope);
        if (localList.length > 0) {
          const active = localList.find((n) => n.id === lastId) || localList[0];
          setDoc(active);
          const activeP = active.pages.find((p) => p.id === active.activePageId) || active.pages[0];
          if (activeP) {
            syncPaletteForTemplate(activeP.template);
            if (activeP.pageSize !== 'infinite' && window.innerWidth >= 768) {
              setTocOpen(true);
            }
          }
        } else {
          const initial = createBlankNotebook(
            authUser ? `Bảng viết của ${authUser.displayName || 'tôi'}` : 'Bảng viết của tôi',
            'blank',
            undefined,
            'infinite',
            ownerScope
          );
          await saveNotebookToDB(initial, ownerScope);
          await setLastActiveNotebookId(initial.id, ownerScope);
          if (!mounted) return;
          setNotebooks([initial]);
          setDoc(initial);
          syncPaletteForTemplate('blank');
        }
        setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      } catch {
        // Fallback already initialized
      } finally {
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authReady, authUser, authRefreshKey, ownerScope, showToast, syncPaletteForTemplate]);

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

  // Auto-save debounced to scoped IndexedDB + Cloud Firestore (when signed in & verified)
  useEffect(() => {
    if (!ready) return;
    setSaveStatus('saving');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const currentScope = ownerScope;
    const verifiedUid = authUser && authUser.emailVerified ? authUser.uid : null;

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        const scopedDoc: NotebookDocument = { ...doc, ownerId: currentScope };
        await saveNotebookToDB(scopedDoc, currentScope);
        await setLastActiveNotebookId(scopedDoc.id, currentScope);
        if (verifiedUid) {
          await saveNotebookToCloud(verifiedUid, scopedDoc);
        }
        setNotebooks((prev) => {
          const idx = prev.findIndex((n) => n.id === scopedDoc.id);
          if (idx === -1) return [scopedDoc, ...prev];
          const copy = [...prev];
          copy[idx] = scopedDoc;
          return copy.sort((a, b) => b.updatedAt - a.updatedAt);
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('saved');
      }
    }, 650);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [doc, ready, ownerScope, authUser]);

  const activePageIndex = useMemo(() => {
    const idx = doc.pages.findIndex((p) => p.id === doc.activePageId);
    return idx >= 0 ? idx : 0;
  }, [doc.pages, doc.activePageId]);

  const activePage = doc.pages[activePageIndex] || doc.pages[0];

  const activePageOffset = useMemo(() => {
    if (activePage.pageSize === 'infinite') {
      return { x: 0, y: 0 };
    }
    let curY = 0;
    for (const p of doc.pages) {
      const dims =
        p.pageSize === 'infinite'
          ? { width: 1120, height: 1584 }
          : PAGE_DIMENSIONS[p.pageSize];
      if (p.id === activePage.id) {
        return { x: -dims.width / 2, y: curY };
      }
      curY += dims.height + PAGE_GAP;
    }
    return { x: 0, y: 0 };
  }, [activePage.id, activePage.pageSize, doc.pages]);

  const activePenSlot = useMemo(
    () => penSlots.find((s) => s.id === activeSlotId) || penSlots[0],
    [penSlots, activeSlotId]
  );

  const pageHistory = historyMap[activePage.id] || { past: [], future: [] };

  // Custom Color Management (scoped per user + synced to cloud)
  const handleAddCustomColor = useCallback(
    (hex: string) => {
      const normalized = hex.toUpperCase();
      setCustomColors((prev) => {
        const filtered = prev.filter((c) => c.toUpperCase() !== normalized);
        const next = [normalized, ...filtered].slice(0, 24);
        saveLocalCustomColors(next, ownerScope);
        if (authUser && authUser.emailVerified) {
          saveUserCustomColorsToCloud(authUser.uid, next).catch(() => {});
        }
        return next;
      });
      showToast(`Đã lưu màu ${normalized} vào dải màu riêng`);
    },
    [ownerScope, authUser, showToast]
  );

  const handleRemoveCustomColor = useCallback(
    (hex: string) => {
      const normalized = hex.toUpperCase();
      setCustomColors((prev) => {
        const next = prev.filter((c) => c.toUpperCase() !== normalized);
        saveLocalCustomColors(next, ownerScope);
        if (authUser && authUser.emailVerified) {
          saveUserCustomColorsToCloud(authUser.uid, next).catch(() => {});
        }
        return next;
      });
    },
    [ownerScope, authUser]
  );

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

  const handleCommitPageElements = useCallback(
    (pageId: string, nextElements: BoardElement[]) => {
      setDoc((prev) => {
        const targetPage = prev.pages.find((p) => p.id === pageId);
        if (!targetPage) return prev;
        const prevElements = targetPage.elements;
        setHistoryMap((hPrev) => {
          const cur = hPrev[pageId] || { past: [], future: [] };
          return {
            ...hPrev,
            [pageId]: {
              past: [...cur.past.slice(-49), prevElements],
              future: [],
            },
          };
        });
        return {
          ...prev,
          updatedAt: Date.now(),
          pages: prev.pages.map((p) =>
            p.id === pageId ? { ...p, elements: nextElements } : p
          ),
        };
      });
    },
    []
  );

  const handleCommitElements = useCallback(
    (nextElements: BoardElement[]) => {
      handleCommitPageElements(activePage.id, nextElements);
    },
    [activePage.id, handleCommitPageElements]
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
    const scopedDoc: NotebookDocument = { ...doc, ownerId: ownerScope };
    await saveNotebookToDB(scopedDoc, ownerScope);
    if (authUser && authUser.emailVerified) {
      await saveNotebookToCloud(authUser.uid, scopedDoc);
    }
    if (linkedFileHandle) {
      try {
        await writeDocToFileHandle(linkedFileHandle, scopedDoc);
        showToast(`Đã lưu vào ${linkedFileHandle.name}`);
      } catch {
        showToast('Đã lưu vào thư viện cá nhân');
      }
    } else {
      showToast(
        authUser?.emailVerified
          ? 'Đã lưu đồng bộ lên tài khoản & trình duyệt'
          : 'Đã lưu bảng viết vào bộ nhớ trình duyệt'
      );
    }
    setSaveStatus('saved');
  }, [doc, ownerScope, authUser, linkedFileHandle, showToast]);

  const importNotebookText = useCallback(
    async (rawText: string, fileName: string) => {
      const parsed = parseInkboardJSON(rawText);
      const imported: NotebookDocument = {
        ...parsed,
        ownerId: ownerScope,
      };
      await saveNotebookToDB(imported, ownerScope);
      await setLastActiveNotebookId(imported.id, ownerScope);
      setDoc(imported);
      setNotebooks((prev) => {
        const filtered = prev.filter((n) => n.id !== imported.id);
        return [imported, ...filtered].sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setLinkedFileHandle(null);
      window.history.replaceState(null, '', window.location.pathname);
      setSelectedIds([]);
      setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      const firstPage =
        imported.pages.find((p) => p.id === imported.activePageId) || imported.pages[0];
      if (firstPage) {
        syncPaletteForTemplate(firstPage.template);
        if (firstPage.pageSize !== 'infinite' && window.innerWidth >= 768) {
          setTocOpen(true);
        }
      }
      setLibraryOpen(false);
      showToast(`Đã mở tệp ${fileName}`);
    },
    [ownerScope, showToast, syncPaletteForTemplate]
  );

  const handleOpenFileTrigger = useCallback(() => {
    inkboardInputRef.current?.click();
  }, []);

  const handleImportFileFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      await importNotebookText(text, file.name);
    } catch {
      showToast('Không thể đọc tệp bảng viết này (tệp không đúng định dạng .scrbleweb / .inkboard).');
    }
  };

  const handleSaveAsCopyInLibrary = async (newTitle: string) => {
    const clone: NotebookDocument = {
      ...JSON.parse(JSON.stringify(doc)),
      id: uid('nb'),
      ownerId: ownerScope,
      slug: undefined,
      title: newTitle,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveNotebookToDB(clone, ownerScope);
    setDoc(clone);
    setLinkedFileHandle(null);
    window.history.replaceState(null, '', window.location.pathname);
    showToast(`Đã lưu bản sao "${newTitle}" vào Sổ tay`);
  };

  const handleSaveAsDiskFile = async (
    newTitle: string,
    ext: '.inkboard' | '.scrbleweb' | '.json' = '.scrbleweb'
  ) => {
    const updated = { ...doc, ownerId: ownerScope, title: newTitle, updatedAt: Date.now() };
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

  const getLocalPageCenter = () => {
    const sideOffset = tocOpen && window.innerWidth >= 768 ? 236 : 0;
    const worldX = ((window.innerWidth - sideOffset) / 2 - viewport.offsetX) / viewport.zoom;
    const worldY = (window.innerHeight / 2 - viewport.offsetY) / viewport.zoom;
    return {
      x: worldX - activePageOffset.x,
      y: worldY - activePageOffset.y,
    };
  };

  const insertImageDataUrl = (src: string) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 480;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const w = img.width * scale;
      const h = img.height * scale;
      const center = getLocalPageCenter();
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
    const center = getLocalPageCenter();
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
    const center = getLocalPageCenter();
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
    const center = getLocalPageCenter();
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
    const lowerName = file.name.toLowerCase();
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') insertImageDataUrl(reader.result);
      };
      reader.readAsDataURL(file);
    } else if (
      lowerName.endsWith('.inkboard') ||
      lowerName.endsWith('.scrbleweb') ||
      lowerName.endsWith('.json')
    ) {
      file.text().then(async (txt) => {
        try {
          await importNotebookText(txt, file.name);
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
    if (activePage.pageSize !== 'infinite') {
      window.setTimeout(() => triggerScrollToPage(newPage.id), 30);
    }
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
    if (clone.pageSize !== 'infinite') {
      window.setTimeout(() => triggerScrollToPage(clone.id), 30);
    }
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

  const handleSwitchAllToA4 = useCallback(() => {
    setDoc((prev) => ({
      ...prev,
      updatedAt: Date.now(),
      pages: prev.pages.map((p) => ({ ...p, pageSize: 'a4Portrait' })),
    }));
    setTocOpen(true);
    window.setTimeout(() => triggerScrollToPage(activePage.id), 40);
    showToast('Đã chuyển sang khổ A4 Dọc — Lướt chuột xuống để chuyển trang');
  }, [activePage.id, triggerScrollToPage, showToast]);

  const handleChangePageSize = useCallback(
    (pageSize: PageSizeMode) => {
      setDoc((prev) => ({
        ...prev,
        updatedAt: Date.now(),
        pages: prev.pages.map((p) => ({ ...p, pageSize })),
      }));
      if (pageSize !== 'infinite') {
        if (window.innerWidth >= 768) {
          setTocOpen(true);
        }
        window.setTimeout(() => triggerScrollToPage(activePage.id), 40);
      } else {
        setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      }
    },
    [activePage.id, triggerScrollToPage]
  );

  const handleFitScreen = () => {
    if (activePage.pageSize === 'infinite') {
      setViewport({ offsetX: 0, offsetY: 0, zoom: 1 });
      return;
    }
    const dims = PAGE_DIMENSIONS[activePage.pageSize];
    const isDesktopSidebars = window.innerWidth >= 768;
    const tocW = tocOpen && isDesktopSidebars ? 240 : 0;
    const drawerW = pagesDrawerOpen && isDesktopSidebars ? 288 : 0;
    const canvasW = Math.max(240, window.innerWidth - tocW - drawerW);
    const padX = canvasW < 640 ? 24 : 140;
    const padY = window.innerHeight < 540 ? 120 : 110;
    const availW = Math.max(180, canvasW - padX);
    const availH = Math.max(160, window.innerHeight - padY);
    const z = Math.max(0.2, Math.min(availW / dims.width, availH / dims.height, 1.15));
    setViewport({
      zoom: z,
      offsetX: canvasW / 2,
      offsetY: 28 - activePageOffset.y * z,
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
      className="h-dvh w-full flex flex-col bg-slate-100 dark:bg-[#0F1115] text-slate-900 dark:text-slate-100 overflow-hidden"
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
        onToggleRuler={() => {
          const center = getLocalPageCenter();
          setRuler((prev) => ({
            ...prev,
            visible: !prev.visible,
            x: !prev.visible ? center.x + activePageOffset.x : prev.x,
            y: !prev.visible ? center.y + activePageOffset.y : prev.y,
          }));
        }}
        stylusOnly={stylusOnly}
        onToggleStylusOnly={() => setStylusOnly((v) => !v)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((v) => !v)}
        pagesDrawerOpen={pagesDrawerOpen}
        onTogglePagesDrawer={() =>
          setPagesDrawerOpen((v) => {
            const next = !v;
            if (next && window.innerWidth < 768) setTocOpen(false);
            return next;
          })
        }
        pageIndex={activePageIndex}
        pageCount={doc.pages.length}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onOpenLibrary={() => setLibraryOpen(true)}
        onNewNotebook={async () => {
          const nb = createBlankNotebook(
            `Bảng viết ${notebooks.length + 1}`,
            activePage.template,
            undefined,
            activePage.pageSize,
            ownerScope
          );
          await saveNotebookToDB(nb, ownerScope);
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
        tocOpen={tocOpen}
        onToggleToc={() =>
          setTocOpen((v) => {
            const next = !v;
            if (next && window.innerWidth < 768) setPagesDrawerOpen(false);
            return next;
          })
        }
        user={authUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        customColors={customColors}
        onAddCustomColor={handleAddCustomColor}
        onRemoveCustomColor={handleRemoveCustomColor}
      />

      {/* Main Workspace Area */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* Left Mục lục (Table of Contents) Sidebar */}
        <PageTocSidebar
          open={tocOpen}
          onClose={() => setTocOpen(false)}
          pages={doc.pages}
          activePageId={activePage.id}
          onSelectPage={(id) => {
            setDoc((prev) => ({ ...prev, activePageId: id }));
            setSelectedIds([]);
            triggerScrollToPage(id);
            if (window.innerWidth < 768) setTocOpen(false);
          }}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
          onSwitchAllToA4={handleSwitchAllToA4}
        />

        {/* Canvas Pane (ToolDock + Zoom Bar + Canvas + Pager sit cleanly inside) */}
        <div className="relative flex-1 flex overflow-hidden">
          <ToolDock
            isCompact={isCompactViewport}
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
            customColors={customColors}
            onAddCustomColor={handleAddCustomColor}
            onRemoveCustomColor={handleRemoveCustomColor}
          />

          <WhiteboardCanvas
            page={activePage}
            pages={doc.pages}
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
            onCommitPageElements={handleCommitPageElements}
            onSelectPage={(pageId) => {
              setDoc((prev) =>
                prev.activePageId === pageId ? prev : { ...prev, activePageId: pageId }
              );
            }}
            scrollToPageRequest={scrollToPageRequest}
            onSelectTool={setActiveTool}
          />

          {/* Quick Multi-Page Switcher (Top-left on compact mobile so it never collides with Bottom ToolDock) */}
          {doc.pages.length > 1 && (
            <div
              className={`absolute z-30 flex items-center gap-0.5 sm:gap-1 rounded-xl bg-white/95 dark:bg-[#161920]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-md select-none ${
                isCompactViewport
                  ? 'top-2 left-2 px-1 py-0.5'
                  : 'bottom-3 left-1/2 -translate-x-1/2 px-2 py-1'
              }`}
            >
              <button
                type="button"
                disabled={activePageIndex === 0}
                onClick={() => {
                  const prevPage = doc.pages[activePageIndex - 1];
                  if (!prevPage) return;
                  setDoc((prev) => ({
                    ...prev,
                    activePageId: prevPage.id,
                  }));
                  setSelectedIds([]);
                  triggerScrollToPage(prevPage.id);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span
                className={`${isCompactViewport ? 'px-1 text-[11px]' : 'px-2 text-xs'} font-mono-tabular font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap`}
              >
                {isCompactViewport
                  ? `${activePageIndex + 1}/${doc.pages.length}`
                  : `Trang ${activePageIndex + 1} / ${doc.pages.length}`}
              </span>
              <button
                type="button"
                disabled={activePageIndex === doc.pages.length - 1}
                onClick={() => {
                  const nextPage = doc.pages[activePageIndex + 1];
                  if (!nextPage) return;
                  setDoc((prev) => ({
                    ...prev,
                    activePageId: nextPage.id,
                  }));
                  setSelectedIds([]);
                  triggerScrollToPage(nextPage.id);
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right Pages & Templates Drawer */}
        <PagesDrawer
          open={pagesDrawerOpen}
          onClose={() => setPagesDrawerOpen(false)}
          pages={doc.pages}
          activePageId={activePage.id}
          onSelectPage={(id) => {
            setDoc((prev) => ({ ...prev, activePageId: id }));
            setSelectedIds([]);
            triggerScrollToPage(id);
            if (window.innerWidth < 768) setPagesDrawerOpen(false);
          }}
          onAddPage={handleAddPage}
          onDuplicatePage={handleDuplicatePage}
          onDeletePage={handleDeletePage}
          onMovePage={handleMovePage}
          onChangeTemplate={handleTemplateChange}
          onChangePageSize={handleChangePageSize}
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
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        user={authUser}
        onAuthToast={showToast}
        onRefreshUser={async () => {
          if (auth.currentUser) {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
            setAuthUser(auth.currentUser);
            setAuthRefreshKey((k) => k + 1);
            if (auth.currentUser.emailVerified) {
              showToast('Email đã xác minh! Bắt đầu đồng bộ dữ liệu riêng.');
            } else {
              showToast('Chưa thấy xác minh email. Vui lòng kiểm tra hộp thư rồi thử lại.');
            }
          }
        }}
      />

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
          const firstP = nb.pages.find((p) => p.id === nb.activePageId) || nb.pages[0];
          if (firstP) {
            syncPaletteForTemplate(firstP.template);
            if (firstP.pageSize !== 'infinite' && window.innerWidth >= 768) setTocOpen(true);
          }
        }}
        onCreateNotebook={async () => {
          const nb = createBlankNotebook(
            `Bảng viết ${notebooks.length + 1}`,
            activePage.template,
            undefined,
            activePage.pageSize,
            ownerScope
          );
          await saveNotebookToDB(nb, ownerScope);
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
            ownerId: ownerScope,
            slug: undefined,
            title: `${nb.title} (Bản sao)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveNotebookToDB(clone, ownerScope);
          setNotebooks((prev) => [clone, ...prev]);
          showToast('Đã nhân bản sổ tay');
        }}
        onDeleteNotebook={async (id) => {
          await deleteNotebookFromDB(id);
          if (authUser && authUser.emailVerified) {
            deleteNotebookFromCloud(authUser.uid, id).catch(() => {});
          }
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
        <div
          className={`fixed right-3 sm:right-4 z-50 px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-xl max-w-[calc(100vw-24px)] ${
            isCompactViewport ? 'bottom-16' : 'bottom-4'
          }`}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
