import React from 'react';

export function Sidebar() {
  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 p-4">
      <h2 className="text-lg font-semibold mb-4">Sources</h2>
      <p className="text-neutral-400 text-sm">
        Indexed MkDocs, repos, and local files will show here.
      </p>
    </div>
  );
}
