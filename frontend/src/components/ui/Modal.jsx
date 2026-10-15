import { X } from 'lucide-react';

export default function Modal({ title, onClose, children, width = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className={`w-full ${width} bg-white rounded border border-stone-200 shadow-lg`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="font-display font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-900 p-1 rounded hover:bg-stone-100">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
