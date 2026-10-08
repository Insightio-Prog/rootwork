const DB_NAME = "rootwork-media";
const STORE = "files";

type StoredFile = {
  id: string;
  mime: string;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbPut(id: string, mime: string, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put({ id, mime, blob } satisfies StoredFile, id);
  });
  db.close();
}

export async function idbGet(id: string): Promise<StoredFile | undefined> {
  const db = await openDb();
  const value = await new Promise<StoredFile | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(id);
    request.onsuccess = () => resolve(request.result as StoredFile | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

export async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(id);
  });
  db.close();
}

export async function idbAllIds(): Promise<string[]> {
  const db = await openDb();
  const keys = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAllKeys();
    request.onsuccess = () => resolve((request.result as IDBValidKey[]).map(String));
    request.onerror = () => reject(request.error);
  });
  db.close();
  return keys;
}
