import React from 'react';

interface HeaderProps {
  activeTab: 'room' | 'tracks' | 'simulator' | 'android';
  onSelectTab: (tab: 'room' | 'tracks' | 'simulator' | 'android') => void;
  onQuickHost: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onQuickHost,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800 bg-[#0b0f17]/90 backdrop-blur-md sticky top-0 z-40">
      {/* Zone 1: Wordmark */}
      <button
        onClick={() => onSelectTab('room')}
        className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer text-left"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm shadow-purple-500" />
        <span>Party Speaker</span>
      </button>

      {/* Zone 2: Navigation Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => onSelectTab('room')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'room' ? 'text-white font-semibold' : ''
          }`}
        >
          Music Speaker
        </button>
        <button
          onClick={() => onSelectTab('simulator')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'simulator' ? 'text-white font-semibold' : ''
          }`}
        >
          4-Phone Lab
        </button>
        <button
          onClick={() => onSelectTab('android')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'android' ? 'text-white font-semibold' : ''
          }`}
        >
          Android Code
        </button>
      </nav>

      {/* Zone 3: Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onQuickHost}
          className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-500 transition-colors whitespace-nowrap shrink-0 shadow-md shadow-purple-900/30 cursor-pointer"
        >
          New Room Code
        </button>
      </div>
    </header>
  );
};
