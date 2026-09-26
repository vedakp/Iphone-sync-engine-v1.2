import React from 'react';
import { DeviceInfo } from '../types';
import { Smartphone, HardDrive, History, Settings as SettingsIcon, Image as ImageIcon } from 'lucide-react';

interface NavbarProps {
  device: DeviceInfo | null;
  activeTab: 'sync' | 'inspect' | 'history' | 'settings';
  onTabChange: (tab: 'sync' | 'inspect' | 'history' | 'settings') => void;
  scannedCount: number;
  newCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  device,
  activeTab,
  onTabChange,
  scannedCount,
  newCount,
}) => {
  return (
    <header className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand & Device Status */}
        <div className="flex items-center space-x-3.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-neutral-200 shadow-inner">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold tracking-tight text-neutral-100">
                {device ? device.name : 'iPhone Media Sync'}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wide uppercase ${
                  device?.connected
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700/50'
                }`}
              >
                {device?.connected ? 'Connected' : 'Ready'}
              </span>
            </div>
            {device?.sourcePath && (
              <p className="text-[11px] font-mono text-neutral-400 truncate max-w-xs">
                {device.sourcePath}
              </p>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-neutral-950/80 p-1 rounded-lg border border-neutral-800 text-xs font-medium">
          <button
            onClick={() => onTabChange('sync')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 ${
              activeTab === 'sync'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Sync</span>
            {newCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-mono">
                {newCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('inspect')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 ${
              activeTab === 'inspect'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Review</span>
            {scannedCount > 0 && (
              <span className="text-[10px] text-neutral-500 font-mono">({scannedCount})</span>
            )}
          </button>

          <button
            onClick={() => onTabChange('history')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 ${
              activeTab === 'settings'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
