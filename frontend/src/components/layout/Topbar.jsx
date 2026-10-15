import { LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS = {
  ADMIN: 'Admin',
  INVENTORY_MANAGER: 'Inventory Manager',
  PRODUCTION_MANAGER: 'Production Manager',
  STOREKEEPER: 'Storekeeper',
};

export default function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 shrink-0 border-b border-stone-200 bg-white flex items-center justify-end px-6 gap-4">
      <div className="text-right leading-tight">
        <p className="text-sm font-medium text-ink-900">{user.name}</p>
        <p className="text-xs text-ink-500">{ROLE_LABELS[user.role] || user.role}</p>
      </div>
      <button
        onClick={logout}
        title="Log out"
        className="p-2 rounded text-ink-500 hover:text-rust-600 hover:bg-stone-100 transition-colors"
      >
        <LogOut size={18} strokeWidth={1.75} />
      </button>
    </header>
  );
}
