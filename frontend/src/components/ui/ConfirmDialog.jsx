import Modal from './Modal';

export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  tone = 'default', // 'default' | 'danger'
  busy = false,
  onConfirm,
  onCancel,
}) {
  const confirmClasses =
    tone === 'danger' ? 'bg-rust-500 hover:bg-rust-600' : 'bg-cane-500 hover:bg-cane-600';

  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-ink-700">{message}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-3.5 py-2 text-sm rounded border border-stone-300 text-ink-700 hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={`px-3.5 py-2 text-sm rounded text-white font-medium disabled:opacity-60 ${confirmClasses}`}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
