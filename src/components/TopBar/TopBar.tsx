import React from 'react';

type Props = {
  onOpenFiles: () => void;
};

export default function TopBar({ onOpenFiles }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b bg-white">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">RestFlow</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenFiles}
          className="rounded bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-700"
        >
          Open Files
        </button>
      </div>
    </header>
  );
}
