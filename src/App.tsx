import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DeviceInfo, MediaItem, SyncProgressState, SyncSession, SyncSettings } from './types';
import { syncDb } from './services/db';
import { deviceDetector } from './services/deviceDetector';
import {
  scanDirectoryHandle,
  scanDataTransferItems,
  scanFileList,
} from './services/fileScanner';
import { syncEngine } from './services/syncEngine';
import { Navbar } from './components/Navbar';
import { SyncView } from './components/SyncView';
import { MediaInspector } from './components/MediaInspector';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { SyncProgressModal } from './components/SyncProgressModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'sync' | 'inspect' | 'history' | 'settings'>('sync');
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [settings, setSettings] = useState<SyncSettings>({
    concurrency: 3,
    verificationMode: 'checksum',
    duplicateBehavior: 'skip_identical',
    autoScanOnConnect: true,
  });

  // Source scanning state
  const [sourceHandle, setSourceHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [scannedItems, setScannedItems] = useState<MediaItem[]>([]);
  const [newItems, setNewItems] = useState<MediaItem[]>([]);
  const [syncedItems, setSyncedItems] = useState<MediaItem[]>([]);
  const [totalNewBytes, setTotalNewBytes] = useState(0);
  const [totalSyncedBytes, setTotalSyncedBytes] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgressText, setScanProgressText] = useState('');

  // Destination directory state
  const [destinationHandle, setDestinationHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [destinationName, setDestinationName] = useState<string | null>('iPhone Backup');

  // Inspector selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sessions and sync progress
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [progress, setProgress] = useState<SyncProgressState>({
    isActive: false,
    isPaused: false,
    totalItems: 0,
    completedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    totalBytes: 0,
    completedBytes: 0,
    currentFilename: '',
    currentFileIndex: 0,
    bytesPerSecond: 0,
    estimatedSecondsRemaining: 0,
    errors: [],
  });
  const [showProgressModal, setShowProgressModal] = useState(false);

  // Hidden file input refs
  const dirInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  // Initialize DB, settings, history and device detector
  useEffect(() => {
    async function initApp() {
      const loadedSettings = await syncDb.getSettings();
      setSettings(loadedSettings);

      const pastSessions = await syncDb.getAllSyncSessions();
      setSessions(pastSessions);

      const initialDevice = await deviceDetector.init();
      if (initialDevice) setDevice(initialDevice);

      deviceDetector.subscribe((d) => {
        setDevice(d);
      });
    }

    initApp();

    const unsubscribeProgress = syncEngine.subscribeProgress((p) => {
      setProgress(p);
      if (p.isActive) {
        setShowProgressModal(true);
      }
    });

    return () => {
      unsubscribeProgress();
    };
  }, []);

  // Reconcile items whenever scanned items or destination changes
  const runReconciliation = useCallback(
    async (items: MediaItem[], devId: string, destHandle: FileSystemDirectoryHandle | null) => {
      const result = await syncEngine.reconcileMedia(items, devId, destHandle);
      setScannedItems(result.allItems);
      setNewItems(result.newItems);
      setSyncedItems(result.syncedItems);
      setTotalNewBytes(result.totalNewBytes);
      setTotalSyncedBytes(result.totalSyncedBytes);

      // By default select all new items for sync
      setSelectedIds(new Set(result.newItems.map((i) => i.id)));
    },
    []
  );

  // Pick iPhone Source Directory
  const handleSelectSourceFolder = async () => {
    const isIframe = window.self !== window.top;

    // In iframes, showDirectoryPicker is prohibited by browser cross-origin policy.
    // Use the native HTML directory picker directly.
    if (isIframe || !('showDirectoryPicker' in window)) {
      dirInputRef.current?.click();
      return;
    }

    try {
      const dirHandle = await (
        window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker();
      setSourceHandle(dirHandle);

      const dev = deviceDetector.registerFolderDevice(dirHandle.name, dirHandle.name);
      setDevice(dev);

      setIsScanning(true);
      setScanProgressText('Discovering files...');

      const items = await scanDirectoryHandle(dirHandle, dev.id, (count, currentPath) => {
        setScanProgressText(`Found ${count} photos and videos... (${currentPath})`);
      });

      await runReconciliation(items, dev.id, destinationHandle);
      setIsScanning(false);
      setScanProgressText('');
    } catch (err: unknown) {
      setIsScanning(false);
      setScanProgressText('');
      // If permission / iframe error occurred, fallback to standard input
      if (err instanceof Error && err.name !== 'AbortError') {
        dirInputRef.current?.click();
      }
    }
  };

  // Pick Destination Directory
  const handleSelectDestinationFolder = async () => {
    const isIframe = window.self !== window.top;

    if (!isIframe && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (
          window as unknown as {
            showDirectoryPicker: (opts: { mode: string }) => Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker({ mode: 'readwrite' });

        setDestinationHandle(dirHandle);
        setDestinationName(dirHandle.name);

        if (scannedItems.length > 0 && device) {
          await runReconciliation(scannedItems, device.id, dirHandle);
        }
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback in iframe: let user specify custom backup folder name
    const currentName = destinationName || 'D:\\iPhone Backup';
    const chosenName = prompt('Enter your destination backup folder name:', currentName);
    if (chosenName && chosenName.trim()) {
      setDestinationName(chosenName.trim());
    }
  };

  // Handle Drag and Drop
  const handleFilesDropped = async (e: React.DragEvent) => {
    setIsScanning(true);
    setScanProgressText('Scanning dropped files...');

    const dev = deviceDetector.registerFolderDevice('iPhone Media (DCIM)', 'DCIM');
    setDevice(dev);

    try {
      const items = await scanDataTransferItems(e.dataTransfer, dev.id, (count, currentPath) => {
        setScanProgressText(`Scanning: ${count} media items found... (${currentPath})`);
      });

      await runReconciliation(items, dev.id, destinationHandle);
    } catch (err) {
      console.error('Error reading dropped files:', err);
    } finally {
      setIsScanning(false);
      setScanProgressText('');
    }
  };

  // Handle standard <input webkitdirectory> folder input
  const handleDirectoryFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    setScanProgressText('Reading iPhone folder tree...');

    const firstFile = files[0];
    const relPath = (firstFile as unknown as { webkitRelativePath?: string }).webkitRelativePath || '';
    const folderName = relPath.split('/')[0] || 'Apple iPhone DCIM';

    const dev = deviceDetector.registerFolderDevice(folderName, relPath || 'DCIM');
    setDevice(dev);

    try {
      const items = scanFileList(files, dev.id, (count, currentPath) => {
        setScanProgressText(`Scanned ${count} items... (${currentPath})`);
      });

      await runReconciliation(items, dev.id, destinationHandle);
    } catch (err) {
      console.error('Error reading file list:', err);
    } finally {
      setIsScanning(false);
      setScanProgressText('');
      // Reset input value so user can pick same folder again if needed
      e.target.value = '';
    }
  };

  // Handle individual files selection fallback
  const handleIndividualFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsScanning(true);
    setScanProgressText('Reading selected media files...');

    const dev = deviceDetector.registerFolderDevice('iPhone Photos & Videos', 'Media');
    setDevice(dev);

    try {
      const items = scanFileList(files, dev.id, (count) => {
        setScanProgressText(`Scanned ${count} items...`);
      });

      await runReconciliation(items, dev.id, destinationHandle);
    } catch (err) {
      console.error('Error reading files:', err);
    } finally {
      setIsScanning(false);
      setScanProgressText('');
      e.target.value = '';
    }
  };

  // Rescan existing source
  const handleRescan = async () => {
    if (!device) return;

    setIsScanning(true);
    setScanProgressText('Rescanning device...');

    if (sourceHandle) {
      try {
        const items = await scanDirectoryHandle(sourceHandle, device.id, (count, currentPath) => {
          setScanProgressText(`Rescanning: ${count} items found... (${currentPath})`);
        });
        await runReconciliation(items, device.id, destinationHandle);
      } catch (err) {
        console.error('Rescan error:', err);
      }
    } else {
      await runReconciliation(scannedItems, device.id, destinationHandle);
    }

    setIsScanning(false);
    setScanProgressText('');
  };

  // Start Real Sync
  const handleStartSync = async () => {
    if (!destinationName || !device) return;

    const itemsToSync =
      selectedIds.size > 0
        ? scannedItems.filter((i) => selectedIds.has(i.id) && !i.isSynced)
        : newItems;

    if (itemsToSync.length === 0) return;

    setShowProgressModal(true);

    try {
      await syncEngine.startSync(
        itemsToSync,
        destinationHandle,
        device.id,
        destinationName,
        settings
      );

      const updatedSessions = await syncDb.getAllSyncSessions();
      setSessions(updatedSessions);

      await runReconciliation(scannedItems, device.id, destinationHandle);
    } catch (err) {
      console.error('Sync process error:', err);
    }
  };

  // Selection handlers in Media Inspector
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (ids: string[]) => {
    setSelectedIds(new Set(ids));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Clear DB history
  const handleClearAllData = async () => {
    if (confirm('Are you sure you want to clear the local sync registry? Your actual files will not be touched.')) {
      await syncDb.clearAllHistory();
      setSessions([]);
      if (device) {
        await runReconciliation(scannedItems, device.id, destinationHandle);
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Hidden inputs that work across all iframes and standalone windows */}
      <input
        type="file"
        ref={dirInputRef}
        // @ts-expect-error - webkitdirectory standard
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleDirectoryFileInput}
      />
      <input
        type="file"
        ref={filesInputRef}
        multiple
        accept="image/*,video/*,.heic,.heif,.mov,.mp4,.dng,.raw"
        className="hidden"
        onChange={handleIndividualFileInput}
      />

      {/* Top Navbar */}
      <Navbar
        device={device}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        scannedCount={scannedItems.length}
        newCount={newItems.length}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'sync' && (
          <SyncView
            device={device}
            scannedItems={scannedItems}
            newItems={newItems}
            syncedItems={syncedItems}
            totalNewBytes={totalNewBytes}
            totalSyncedBytes={totalSyncedBytes}
            isScanning={isScanning}
            scanProgressText={scanProgressText}
            destinationName={destinationName}
            destinationHandle={destinationHandle}
            onSelectSourceFolder={handleSelectSourceFolder}
            onSelectDestinationFolder={handleSelectDestinationFolder}
            onStartSync={handleStartSync}
            onRescan={handleRescan}
            onInspect={() => setActiveTab('inspect')}
            onFilesDropped={handleFilesDropped}
            onFallbackFileInput={handleDirectoryFileInput}
            onSelectFiles={() => filesInputRef.current?.click()}
          />
        )}

        {activeTab === 'inspect' && (
          <MediaInspector
            items={scannedItems}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBackToSync={() => setActiveTab('sync')}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            sessions={sessions}
            onClearHistory={handleClearAllData}
            onBackToSync={() => setActiveTab('sync')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={async (newS) => {
              setSettings(newS);
              await syncDb.saveSettings(newS);
            }}
            onClearAllData={handleClearAllData}
            onBackToSync={() => setActiveTab('sync')}
          />
        )}
      </main>

      {/* Real-time sync progress modal */}
      {showProgressModal && (
        <SyncProgressModal
          progress={progress}
          destinationName={destinationName || 'iPhone Backup'}
          onPause={() => syncEngine.pauseSync()}
          onResume={() => syncEngine.resumeSync()}
          onCancel={() => syncEngine.cancelSync()}
          onClose={() => setShowProgressModal(false)}
        />
      )}
    </div>
  );
}
