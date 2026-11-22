import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BoardElement, BoardPage, NotebookDocument } from '../types/inkboard';

function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned || `id_${Date.now()}`;
}

function sanitizeElementsForFirestore(elements: BoardElement[]): BoardElement[] {
  const capped = elements.slice(0, 2500);
  const out: BoardElement[] = [];
  let approxBytes = 0;

  for (const el of capped) {
    // Strip undefined fields and guard against 1MB Firestore document limit
    const cleanEl = JSON.parse(JSON.stringify(el)) as BoardElement;
    if (cleanEl.type === 'image' && cleanEl.src.length > 350000) {
      // Skip inline huge image blob from cloud sync payload to stay strictly below 1MB Firestore doc cap
      continue;
    }
    const len = JSON.stringify(cleanEl).length;
    if (approxBytes + len > 780000) break;
    approxBytes += len;
    out.push(cleanEl);
  }
  return out;
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export async function syncUserProfileOnLogin(user: User): Promise<void> {
  if (!user.emailVerified) return;
  const uid = sanitizeId(user.uid);
  const publicPath = `users/${uid}/public/profile`;
  const privatePath = `users/${uid}/private/info`;

  try {
    const pubRef = doc(db, 'users', uid, 'public', 'profile');
    const pubSnap = await getDoc(pubRef);
    const displayName = (user.displayName || user.email?.split('@')[0] || 'Người dùng').slice(0, 80);
    const photoURL = (user.photoURL || '').slice(0, 500);

    if (!pubSnap.exists()) {
      await setDoc(pubRef, {
        uid,
        displayName,
        ...(photoURL ? { photoURL } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(pubRef, {
        displayName,
        ...(photoURL ? { photoURL } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    const privRef = doc(db, 'users', uid, 'private', 'info');
    const privSnap = await getDoc(privRef);
    const email = (user.email || '').slice(0, 254);

    if (!privSnap.exists()) {
      await setDoc(privRef, {
        uid,
        ...(email ? { email } : {}),
        customColors: [],
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privRef, {
        ...(email ? { email } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function loadUserCustomColorsFromCloud(uidRaw: string): Promise<string[] | null> {
  const uid = sanitizeId(uidRaw);
  const path = `users/${uid}/private/info`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'private', 'info'));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (Array.isArray(data.customColors) && data.customColors.length > 0) {
      return data.customColors
        .filter((c): c is string => typeof c === 'string')
        .slice(0, 24);
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserCustomColorsToCloud(
  uidRaw: string,
  colors: string[]
): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const path = `users/${uid}/private/info`;
  const cleanColors = colors
    .filter((c) => typeof c === 'string' && c.length <= 16)
    .slice(0, 24);
  try {
    const privRef = doc(db, 'users', uid, 'private', 'info');
    const snap = await getDoc(privRef);
    if (!snap.exists()) {
      await setDoc(privRef, {
        uid,
        customColors: cleanColors,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(privRef, {
        customColors: cleanColors,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function loadUserNotebooksFromCloud(uidRaw: string): Promise<NotebookDocument[]> {
  const uid = sanitizeId(uidRaw);
  const nbPath = `users/${uid}/notebooks`;
  try {
    const nbQuery = query(collection(db, 'users', uid, 'notebooks'), where('ownerId', '==', uid));
    const nbSnap = await getDocs(nbQuery);

    const results: NotebookDocument[] = [];
    for (const nbDoc of nbSnap.docs) {
      const meta = nbDoc.data();
      const nbId = sanitizeId(nbDoc.id);
      const pagesPath = `users/${uid}/notebooks/${nbId}/pages`;
      let pages: BoardPage[] = [];
      try {
        const pQuery = query(
          collection(db, 'users', uid, 'notebooks', nbId, 'pages'),
          where('ownerId', '==', uid),
          where('notebookId', '==', nbId)
        );
        const pSnap = await getDocs(pQuery);
        pages = pSnap.docs
          .map((d) => ({ order: Number(d.data().order ?? 0), data: d.data() }))
          .sort((a, b) => a.order - b.order)
          .map(({ data }) => ({
            id: String(data.id),
            title: String(data.title || 'Trang 1'),
            template: data.template,
            pageSize: data.pageSize,
            gridSize: Number(data.gridSize || 32),
            elements: Array.isArray(data.elements) ? (data.elements as BoardElement[]) : [],
          }));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, pagesPath);
      }

      if (pages.length === 0) continue;

      results.push({
        id: nbId,
        ownerId: uid,
        slug: typeof meta.slug === 'string' && meta.slug ? meta.slug : undefined,
        title: String(meta.title || 'Bảng viết'),
        activePageId: String(meta.activePageId || pages[0].id),
        version: Number(meta.version || 1),
        createdAt: toMillis(meta.createdAt),
        updatedAt: toMillis(meta.updatedAt),
        pages,
      });
    }

    return results.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, nbPath);
  }
}

export async function saveNotebookToCloud(
  uidRaw: string,
  notebook: NotebookDocument
): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const nbId = sanitizeId(notebook.id);
  const nbPath = `users/${uid}/notebooks/${nbId}`;

  try {
    const nbRef = doc(db, 'users', uid, 'notebooks', nbId);
    const existingNb = await getDoc(nbRef);

    const safeTitle = (notebook.title || 'Bảng viết').trim().slice(0, 120) || 'Bảng viết';
    const safeSlug = (notebook.slug || '').trim().slice(0, 80);
    const safePages = notebook.pages.slice(0, 200);
    const activePageId = sanitizeId(
      safePages.find((p) => p.id === notebook.activePageId)?.id || safePages[0].id
    );

    const batch = writeBatch(db);

    if (!existingNb.exists()) {
      batch.set(nbRef, {
        id: nbId,
        ownerId: uid,
        title: safeTitle,
        slug: safeSlug,
        activePageId,
        pageCount: safePages.length,
        version: Math.min(10, Math.max(1, Number(notebook.version || 1))),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(nbRef, {
        title: safeTitle,
        slug: safeSlug,
        activePageId,
        pageCount: safePages.length,
        version: Math.min(10, Math.max(1, Number(notebook.version || 1))),
        updatedAt: serverTimestamp(),
      });
    }

    const existingPagesSnap = await getDocs(
      query(
        collection(db, 'users', uid, 'notebooks', nbId, 'pages'),
        where('ownerId', '==', uid),
        where('notebookId', '==', nbId)
      )
    );
    const existingPageIds = new Set(existingPagesSnap.docs.map((d) => d.id));
    const nextPageIds = new Set<string>();

    safePages.forEach((p, idx) => {
      const pId = sanitizeId(p.id);
      nextPageIds.add(pId);
      const pRef = doc(db, 'users', uid, 'notebooks', nbId, 'pages', pId);
      const safeElements = sanitizeElementsForFirestore(p.elements);
      const safePageTitle = (p.title || `Trang ${idx + 1}`).trim().slice(0, 80) || `Trang ${idx + 1}`;
      const gridSize = Math.min(128, Math.max(8, Math.round(p.gridSize || 32)));

      if (!existingPageIds.has(pId)) {
        batch.set(pRef, {
          id: pId,
          ownerId: uid,
          notebookId: nbId,
          order: idx,
          title: safePageTitle,
          template: p.template,
          pageSize: p.pageSize,
          gridSize,
          elements: safeElements,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(pRef, {
          order: idx,
          title: safePageTitle,
          template: p.template,
          pageSize: p.pageSize,
          gridSize,
          elements: safeElements,
          updatedAt: serverTimestamp(),
        });
      }
    });

    for (const oldId of existingPageIds) {
      if (!nextPageIds.has(oldId)) {
        batch.delete(doc(db, 'users', uid, 'notebooks', nbId, 'pages', oldId));
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, nbPath);
  }
}

export async function deleteNotebookFromCloud(uidRaw: string, notebookIdRaw: string): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const nbId = sanitizeId(notebookIdRaw);
  const nbPath = `users/${uid}/notebooks/${nbId}`;
  try {
    const pagesSnap = await getDocs(
      query(
        collection(db, 'users', uid, 'notebooks', nbId, 'pages'),
        where('ownerId', '==', uid),
        where('notebookId', '==', nbId)
      )
    );
    const batch = writeBatch(db);
    for (const p of pagesSnap.docs) {
      batch.delete(p.ref);
    }
    batch.delete(doc(db, 'users', uid, 'notebooks', nbId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, nbPath);
  }
}
