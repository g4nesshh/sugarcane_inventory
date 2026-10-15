import { NavLink } from 'react-router-dom';
import { visibleNavGroups } from '../../config/navigation';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();
  const groups = visibleNavGroups(user.role);

  return (
    <aside className="w-60 shrink-0 bg-cane-700 text-stone-100 flex flex-col">
      <div className="px-5 py-5 border-b border-cane-600">
        <p className="font-display font-semibold text-lg leading-tight text-white">Sugar Factory</p>
        <p className="text-xs text-cane-100/70 mt-0.5">Inventory System</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-5 text-xs text-cane-100/50 mb-1.5">{group.label}</p>
            {group.items.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-5 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-cane-600 text-white border-r-2 border-clay-400'
                      : 'text-stone-200/80 hover:bg-cane-600/60 hover:text-white'
                  }`
                }
              >
                <Icon size={17} strokeWidth={1.75} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
