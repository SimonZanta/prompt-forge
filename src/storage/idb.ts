/** Minimal promise wrapper over the one IndexedDB database the app uses. */

const DB_NAME = "prompt-forge";
const DB_VERSION = 1;

export const IDB_STORES = {
  /** key: folder name → `{ name }` */
  folders: "folders",
  /** key: `folder/name` → `{ folder, name, content, updated_at }` */
  prompts: "prompts",
  /** misc singletons: the remembered directory handle, the "seeded" marker */
  meta: "meta",
} as const;

type StoreName = (typeof IDB_STORES)[keyof typeof IDB_STORES];

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const store of Object.values(IDB_STORES)) {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return databasePromise;
}

/**
 * Runs `operate` inside one transaction on `storeName`; resolves with the result of the request it
 * returns (if any) once the transaction has committed.
 */
export async function withStore<T = void>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  operate: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operate(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request ? request.result : (undefined as T));
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const idbGet = <T>(storeName: StoreName, key: IDBValidKey) =>
  withStore<T | undefined>(storeName, "readonly", (store) => store.get(key) as IDBRequest<T | undefined>);

export const idbGetAll = <T>(storeName: StoreName, range?: IDBKeyRange) =>
  withStore<T[]>(storeName, "readonly", (store) => store.getAll(range) as IDBRequest<T[]>);

export const idbGetAllKeys = (storeName: StoreName, range?: IDBKeyRange) =>
  withStore<IDBValidKey[]>(storeName, "readonly", (store) => store.getAllKeys(range));

export const idbSet = (storeName: StoreName, key: IDBValidKey, value: unknown) =>
  withStore(storeName, "readwrite", (store) => { store.put(value, key); });

export const idbDelete = (storeName: StoreName, key: IDBValidKey) =>
  withStore(storeName, "readwrite", (store) => { store.delete(key); });
