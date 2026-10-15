import { Search } from 'lucide-react';

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-8 pr-3 py-1.5 text-sm rounded border border-stone-300 w-56 focus:outline-none focus:ring-2 focus:ring-cane-500 focus:border-cane-500"
      />
    </div>
  );
}
