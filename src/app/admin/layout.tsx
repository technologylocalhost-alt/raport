'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LogOut,
  Building2,
  GraduationCap,
  BookOpen,
  Users,
  BarChart3,
  Home,
  Layers,
  Clock,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Detect screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const menuItems = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/admin/dashboard',
    },
    {
      title: 'Master Data',
      items: [
        { title: 'Data Sekolah', icon: Building2, href: '/admin/schools' },
        { title: 'Struktur Akademik', icon: Clock, href: '/admin/academic-structure' },
        { title: 'Jenjang Pendidikan', icon: GraduationCap, href: '/admin/levels' },
        { title: 'Mata Pelajaran', icon: BookOpen, href: '/admin/subjects' },
        { title: 'Kelas', icon: Layers, href: '/admin/classes' },
      ],
    },
    {
      title: 'Penilaian',
      items: [
        { title: 'Penilian', icon: Users, href: '/admin/raports' },
        { title: 'Siswa', icon: BarChart3, href: '/admin/students' },
      ],
    },
    {
      title: 'Manajemen',
      items: [
        { title: 'Pengguna', icon: Users, href: '/admin/users' },
        { title: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
      ],
    },
  ];

  function handleLogout() {
    console.log('[Logout] Button clicked!');
    
    if (isLoggingOut) {
      console.log('[Logout] Already logging out, returning');
      return;
    }
    
    setIsLoggingOut(true);
    const token = localStorage.getItem('accessToken');
    
    console.log('[Logout] Token:', token ? `${token.substring(0, 20)}...` : 'null');
    console.log('[Logout] Starting logout process...');
    
    // Call logout API immediately - don't clear cookies yet
    const logoutPromise = fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`,
      },
      credentials: 'include', // Send cookies with request
    })
    .then(res => {
      console.log('[Logout] Response received, status:', res.status);
      return res.json();
    })
    .then(data => {
      console.log('[Logout] Response data:', data);
    })
    .catch((err) => {
      console.error('[Logout] Fetch error:', err.message);
    })
    .finally(() => {
      console.log('[Logout] Fetch complete, clearing storage...');
      // Clear storage AFTER API attempt
      localStorage.clear();
      sessionStorage.clear();
      
      console.log('[Logout] Redirecting to /login');
      // Use full page reload to ensure clean state
      window.location.replace('/login');
    });
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed md:static md:translate-x-0 md:w-64 w-64 h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-transform duration-300 flex flex-col shadow-lg z-50 md:z-auto`}
      >
        {/* Logo */}
        <div className="p-3 sm:p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base sm:text-lg font-bold">Raport</h1>
            <p className="text-xs text-slate-400">Admin</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-2 sm:py-3 px-2 space-y-1 sm:space-y-2 min-h-0">
          {menuItems.map((section, idx) => (
            <div key={idx}>
              {/* Main Item atau Section Title */}
              {section.items ? (
                <>
                  <h3 className="px-2 sm:px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {section.title}
                  </h3>
                  <div className="space-y-0.5">
                    {section.items.map((item, itemIdx) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={itemIdx}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-2 p-2 rounded-lg transition-all text-sm ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'text-slate-300 hover:bg-slate-700'
                          }`}
                          title={item.title}
                        >
                          <Icon size={18} className="flex-shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Link
                  href={section.href!}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all text-sm ${
                    pathname === section.href
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={section.title}
                >
                  {section.icon && <section.icon size={18} className="flex-shrink-0" />}
                  <span>{section.title}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-2 sm:p-3 border-t border-slate-700 flex-shrink-0">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center gap-2 p-2 rounded-lg transition-all text-sm ${
              isLoggingOut 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'text-slate-300 hover:bg-red-600 hover:text-white'
            }`}
            title="Logout"
          >
            <LogOut size={18} className={`flex-shrink-0 ${isLoggingOut ? 'animate-spin' : ''}`} />
            <span>
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors md:hidden flex-shrink-0"
              >
                <Menu size={20} />
              </button>
              <h2 className="text-base sm:text-xl font-semibold text-gray-800 truncate">
                {menuItems
                  .flatMap((section) => section.items || [section])
                  .find((item) => item.href === pathname)?.title || 'Dashboard'}
              </h2>
            </div>
            <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap flex-shrink-0">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
