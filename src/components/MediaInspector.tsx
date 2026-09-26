import React, { useState, useMemo } from 'react';
import { MediaItem } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import {
  Video,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
  CheckSquare,
  Square,
  FileQuestion,
} from 'lucide-react';

interface MediaInspectorProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
  onBackToSync: () => void;
}

export const MediaInspector: React.FC<MediaInspectorProps> = ({
  items,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onBackToSync,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'new' | 'synced' | 'photos' | 'videos'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterType === 'new' && item.isSynced) return false;
      if (filterType === 'synced' && !item.isSynced) return false;
      if (filterType === 'photos' && item.mediaType !== 'photo') return false;
      if (filterType === 'videos' && item.mediaType !== 'video') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return item.filename.toLowerCase().includes(q) || item.sourceIdentifier.toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, filterType, searchQuery]);

  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      onDeselectAll();
    } else {
      onSelectAll(filteredItems.map((i) => i.id));
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 space-y-6">
      {/* Top Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <button
            onClick={onBackToSync}
            className="text-xs text-neutral-400 hover:text-white mb-1 transition-colors flex items-center space-x-1"
          >
            <span>← Back to Sync</span>
          </button>
          <h2 className="text-xl font-bold tracking-tight text-neutral-100">Media Review</h2>
          <p className="text-xs font-mono text-neutral-400">
            {filteredItems.length} of {items.length} items shown · {selectedIds.size} selected for sync
          </p>
        </div>

        {/* Filter Badges & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Filter by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-neutral-700 w-40 sm:w-48"
            />
          </div>

          <div className="flex items-center space-x-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded ${
                filterType === 'all' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('new')}
              className={`px-2.5 py-1 rounded ${
                filterType === 'new' ? 'bg-neutral-800 text-blue-400' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              New
            </button>
            <button
              onClick={() => setFilterType('synced')}
              className={`px-2.5 py-1 rounded ${
                filterType === 'synced' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Synced
            </button>
            <button
              onClick={() => setFilterType('photos')}
              className={`px-2.5 py-1 rounded ${
                filterType === 'photos' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Photos
            </button>
            <button
              onClick={() => setFilterType('videos')}
              className={`px-2.5 py-1 rounded ${
                filterType === 'videos' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Videos
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      <div className="flex items-center justify-between bg-neutral-900/60 p-3 rounded-xl border border-neutral-800 text-xs">
        <button
          onClick={handleToggleSelectAll}
          className="flex items-center space-x-2 text-neutral-300 hover:text-white transition-colors"
        >
          {allFilteredSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-500" />
          ) : (
            <Square className="w-4 h-4 text-neutral-500" />
          )}
          <span>{allFilteredSelected ? 'Deselect All' : 'Select All in View'}</span>
        </button>

        <div className="text-neutral-400 font-mono text-[11px]">
          {selectedIds.size} items ready to transfer
        </div>
      </div>

      {/* Grid of Media Items */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16 border border-neutral-800/80 rounded-2xl bg-neutral-900/30">
          <Filter className="w-8 h-8 mx-auto mb-3 text-neutral-600" />
          <p className="text-sm text-neutral-400">No media matches the active filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => onToggleSelect(item.id)}
                onMouseEnter={() => setActiveItem(item)}
                className={`group relative aspect-square rounded-xl border overflow-hidden cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 bg-neutral-900'
                    : 'border-neutral-800/80 bg-neutral-950 hover:border-neutral-700'
                }`}
              >
                {/* Media representation */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                  {item.mediaType === 'video' ? (
                    <Video className="w-8 h-8 text-neutral-500 mb-1" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-neutral-800/80 flex items-center justify-center text-xs font-mono text-neutral-400 mb-1 uppercase font-bold">
                      {item.extension || 'IMG'}
                    </div>
                  )}
                  <span className="text-[11px] font-mono text-neutral-300 truncate w-full px-1">
                    {item.filename}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500">
                    {formatBytes(item.size)}
                  </span>
                </div>

                {/* Status Badges */}
                <div className="absolute top-2 left-2 flex items-center space-x-1 z-10">
                  {item.isSynced ? (
                    <span className="p-1 rounded-md bg-emerald-500/20 text-emerald-400 backdrop-blur-sm border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-blue-500/20 text-blue-400 backdrop-blur-sm border border-blue-500/30">
                      NEW
                    </span>
                  )}
                  {item.livePhotoPairId && (
                    <span
                      title="Live Photo Pair"
                      className="p-1 rounded-md bg-amber-500/20 text-amber-400 backdrop-blur-sm border border-amber-500/30"
                    >
                      <Sparkles className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Selection Checkbox on Hover/Selected */}
                <div className="absolute top-2 right-2 z-10">
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-900/80 border border-neutral-700 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Metadata Detail Footer Inspector */}
      {activeItem && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-xl w-full px-4 z-20">
          <div className="bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-xl p-3.5 shadow-2xl flex items-center justify-between text-xs font-mono">
            <div className="truncate pr-4">
              <div className="text-neutral-100 font-semibold truncate">{activeItem.filename}</div>
              <div className="text-[11px] text-neutral-400 truncate">
                {activeItem.sourceIdentifier} · {formatBytes(activeItem.size)} ·{' '}
                {formatDate(activeItem.modifiedAt)}
              </div>
            </div>
            <div className="shrink-0 flex items-center space-x-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                  activeItem.isSynced
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}
              >
                {activeItem.isSynced ? 'Synced' : 'New'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
