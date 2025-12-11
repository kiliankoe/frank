import { useEffect } from "react";

interface ShortcutGroup {
  title: string;
  shortcuts: { key: string; description: string }[];
}

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ShortcutGroup[];
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
  groups,
}: KeyboardShortcutsModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default"
        onClick={onClose}
        aria-label="Close modal"
      />

      {/* Modal */}
      <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden border border-white/10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              Keyboard Shortcuts
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center justify-between"
                    >
                      <span className="text-gray-300">{shortcut.description}</span>
                      <kbd className="bg-white/10 text-gray-200 text-sm px-2.5 py-1 rounded font-mono min-w-[2rem] text-center">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <span className="text-gray-500 text-sm">
              Press <kbd className="bg-white/10 text-gray-400 text-xs px-1.5 py-0.5 rounded font-mono">?</kbd> or{" "}
              <kbd className="bg-white/10 text-gray-400 text-xs px-1.5 py-0.5 rounded font-mono">Esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
