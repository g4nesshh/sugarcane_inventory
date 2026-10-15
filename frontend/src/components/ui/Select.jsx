export default function Select({ value, onChange, options, placeholder, className = '' }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={`text-sm rounded border border-stone-300 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-cane-500 focus:border-cane-500 ${className}`}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
