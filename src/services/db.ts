import { DeviceInfo, MediaItem, SyncSession, SyncSettings } from '../types';

const DB_NAME = 'iphone_media_sync_db';
const DB_VERSION = 1;

export class SyncDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Devices store
        if (!db.objectStoreNames.contains('devices')) {
          const deviceStore = db.createObjectStore('devices', { keyPath: 'id' });
          deviceStore.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
        }

        // Media store
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('deviceId', 'deviceId', { unique: false });
          mediaStore.createIndex('sourceIdentifier', 'sourceIdentifier', { unique: false });
          mediaStore.createIndex('hash', 'hash', { unique: false });
          mediaStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          mediaStore.createIndex('deviceId_filename_size', ['deviceId', 'filename', 'size'], { unique: false });
        }

        // Sync sessions store
        if (!db.objectStoreNames.contains('sync_sessions')) {
          const sessionStore = db.createObjectStore('sync_sessions', { keyPath: 'id' });
          sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- Devices ---
  async saveDevice(device: DeviceInfo): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('devices', 'readwrite');
      tx.objectStore('devices').put(device);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getDevice(id: string): Promise<DeviceInfo | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('devices', 'readonly');
      const req = tx.objectStore('devices').get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllDevices(): Promise<DeviceInfo[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('devices', 'readonly');
      const req = tx.objectStore('devices').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Media ---
  async saveMediaItem(item: Omit<MediaItem, 'fileHandle' | 'file' | 'previewUrl'>): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      tx.objectStore('media').put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async batchSaveMediaItems(items: Omit<MediaItem, 'fileHandle' | 'file' | 'previewUrl'>[]): Promise<void> {
    if (items.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media');
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSyncedMediaByDevice(deviceId: string): Promise<MediaItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const index = tx.objectStore('media').index('deviceId');
      const req = index.getAll(deviceId);
      req.onsuccess = () => {
        const results = req.result || [];
        resolve(results.filter((m: MediaItem) => m.isSynced));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async findSyncedItem(deviceId: string, filename: string, size: number, hash?: string): Promise<MediaItem | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('media', 'readonly');
      const store = tx.objectStore('media');

      if (hash) {
        const hashIndex = store.index('hash');
        const hashReq = hashIndex.get(hash);
        hashReq.onsuccess = () => {
          if (hashReq.result && hashReq.result.isSynced) {
            resolve(hashReq.result);
            return;
          }
          this.findByMetadata(store, deviceId, filename, size, resolve);
        };
        hashReq.onerror = () => this.findByMetadata(store, deviceId, filename, size, resolve);
      } else {
        this.findByMetadata(store, deviceId, filename, size, resolve);
      }
    });
  }

  private findByMetadata(
    store: IDBObjectStore,
    deviceId: string,
    filename: string,
    size: number,
    resolve: (item: MediaItem | null) => void
  ) {
    const index = store.index('deviceId_filename_size');
    const req = index.get([deviceId, filename, size]);
    req.onsuccess = () => {
      if (req.result && req.result.isSynced) {
        resolve(req.result);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => resolve(null);
  }

  // --- Sync Sessions ---
  async saveSyncSession(session: SyncSession): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_sessions', 'readwrite');
      tx.objectStore('sync_sessions').put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllSyncSessions(): Promise<SyncSession[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_sessions', 'readonly');
      const req = tx.objectStore('sync_sessions').getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        // Sort descending by startedAt
        list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // --- Settings ---
  async getSettings(): Promise<SyncSettings> {
    const defaultSettings: SyncSettings = {
      concurrency: 3,
      verificationMode: 'checksum',
      duplicateBehavior: 'skip_identical',
      autoScanOnConnect: true,
    };

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get('app_settings');
        req.onsuccess = () => {
          if (req.result && req.result.value) {
            resolve({ ...defaultSettings, ...req.result.value });
          } else {
            resolve(defaultSettings);
          }
        };
        req.onerror = () => resolve(defaultSettings);
      });
    } catch {
      return defaultSettings;
    }
  }

  async saveSettings(settings: SyncSettings): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key: 'app_settings', value: settings });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllHistory(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['media', 'sync_sessions'], 'readwrite');
      tx.objectStore('media').clear();
      tx.objectStore('sync_sessions').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const syncDb = new SyncDatabase();
