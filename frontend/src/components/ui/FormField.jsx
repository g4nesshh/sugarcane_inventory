export const inputClass =
  'mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cane-500 focus:border-cane-500';

export default function FormField({ label, error, children, required }) {
  return (
    <label className="block text-sm font-medium text-ink-700">
      {label}
      {required && <span className="text-rust-500"> *</span>}
      {children}
      {error && <span className="block mt-1 text-xs text-rust-600 font-normal">{error}</span>}
    </label>
  );
}
