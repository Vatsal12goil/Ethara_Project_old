import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../services/authContext';
import { LayoutDashboard, FolderKanban, LogOut, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Projects', icon: FolderKanban, path: '/projects' },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Left Sidebar: Navigation */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col fixed h-screen">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">P</div>
            <span className="font-bold text-lg tracking-tight">CollabGrid</span>
          </div>
          
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link 
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-[10px] font-bold text-indigo-700">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-slate-900">{user?.name}</p>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all font-medium text-sm"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-60 flex flex-col min-h-screen overflow-hidden">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className="p-8"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
