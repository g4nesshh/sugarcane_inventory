const VARIANTS = {
  primary: 'bg-cane-500 text-white hover:bg-cane-600',
  secondary: 'border border-stone-300 text-ink-700 hover:bg-stone-50',
  danger: 'bg-rust-500 text-white hover:bg-rust-600',
  ghost: 'text-ink-700 hover:bg-stone-100',
};

export default function Button({ variant = 'primary', icon: Icon, children, className = '', ...props }) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={15} strokeWidth={2} />}
      {children}
    </button>
  );
}
