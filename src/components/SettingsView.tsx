import React from 'react';
import { SyncSettings } from '../types';
import { ShieldCheck, Cpu, Copy, RefreshCw, AlertOctagon } from 'lucide-react';

interface SettingsViewProps {
  settings: SyncSettings;
  onUpdateSettings: (newSettings: SyncSettings) => void;
  onClearAllData: () => void;
  onBackToSync: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onClearAllData,
  onBackToSync,
}) => {
  return (
    <div className="max-w-2xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-neutral-800">
        <button
          onClick={onBackToSync}
          className="text-xs text-neutral-400 hover:text-white mb-1 transition-colors flex items-center space-x-1"
        >
          <span>← Back to Sync</span>
        </button>
        <h2 className="text-xl font-bold tracking-tight text-neutral-100">Sync Settings</h2>
        <p className="text-xs text-neutral-400">
          Configure backup verification, concurrency, and duplicate collision strategies.
        </p>
      </div>

      <div className="space-y-4">
        {/* Verification Mode */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2.5 text-neutral-200">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold">Post-Transfer Verification</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Choose how strictly written destination files are verified before being marked as safely backed up.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onUpdateSettings({ ...settings, verificationMode: 'checksum' })}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                settings.verificationMode === 'checksum'
                  ? 'bg-blue-950/30 border-blue-500/50 text-neutral-100'
                  : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold text-neutral-200 mb-0.5">SHA-256 Checksum (Recommended)</div>
              <div className="text-[11px] text-neutral-400">Bit-for-bit cryptographic verification</div>
            </button>

            <button
              onClick={() => onUpdateSettings({ ...settings, verificationMode: 'size_only' })}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                settings.verificationMode === 'size_only'
                  ? 'bg-blue-950/30 border-blue-500/50 text-neutral-100'
                  : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold text-neutral-200 mb-0.5">Fast Size Check</div>
              <div className="text-[11px] text-neutral-400">Compares byte size for fastest transfer</div>
            </button>
          </div>
        </div>

        {/* Duplicate Behavior */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2.5 text-neutral-200">
            <Copy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Collision & Duplicate Handling</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            What happens if a file with the same filename already exists in your destination folder.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onUpdateSettings({ ...settings, duplicateBehavior: 'skip_identical' })}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                settings.duplicateBehavior === 'skip_identical'
                  ? 'bg-blue-950/30 border-blue-500/50 text-neutral-100'
                  : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold text-neutral-200 mb-0.5">Skip Identical (Clean)</div>
              <div className="text-[11px] text-neutral-400">Prevents creating duplicate files</div>
            </button>

            <button
              onClick={() => onUpdateSettings({ ...settings, duplicateBehavior: 'rename_conflict' })}
              className={`p-3 rounded-lg border text-left text-xs transition-all ${
                settings.duplicateBehavior === 'rename_conflict'
                  ? 'bg-blue-950/30 border-blue-500/50 text-neutral-100'
                  : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:border-neutral-700'
              }`}
            >
              <div className="font-semibold text-neutral-200 mb-0.5">Rename Conflicting (Safe)</div>
              <div className="text-[11px] text-neutral-400">Appends (1) if contents differ</div>
            </button>
          </div>
        </div>

        {/* Transfer Concurrency */}
        <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 text-neutral-200">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Concurrent Transfer Streams</h3>
            </div>
            <span className="font-mono text-xs text-neutral-300 font-bold bg-neutral-800 px-2.5 py-1 rounded-md">
              {settings.concurrency} streams
            </span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Number of simultaneous files streamed. 2-4 is optimal for USB 2.0/3.0 and SSDs.
          </p>
          <input
            type="range"
            min="1"
            max="6"
            step="1"
            value={settings.concurrency}
            onChange={(e) => onUpdateSettings({ ...settings, concurrency: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-500 bg-neutral-800 cursor-pointer h-2 rounded-lg"
          />
          <div className="flex justify-between text-[10px] font-mono text-neutral-500">
            <span>1 (Sequential)</span>
            <span>3 (Balanced)</span>
            <span>6 (Maximum I/O)</span>
          </div>
        </div>

        {/* Reset Database / State */}
        <div className="bg-red-950/10 border border-red-500/20 rounded-xl p-5 space-y-3">
          <div className="flex items-center space-x-2.5 text-red-400">
            <AlertOctagon className="w-4 h-4" />
            <h3 className="text-sm font-semibold">Reset Sync History</h3>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Clears the local sync registry database. Your actual backed up files on Windows and iPhone remain completely untouched.
          </p>
          <button
            onClick={onClearAllData}
            className="px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-200 border border-red-500/30 text-xs font-semibold transition-all flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Local Registry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
