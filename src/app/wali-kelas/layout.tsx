'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LogOut,
  Home,
  Users,
  BookOpen,
  CheckCircle,
  FileText,
  Library,
  Target,
} from 'lucide-react';

interface WaliKelasLayoutProps {
  children: React.ReactNode;
}

export default function WaliKelasLayout({ children }: WaliKelasLayoutProps) {
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
      href: '/wali-kelas/dashboard',
    },
    {
      title: 'Master Data Kelas',
      items: [
        { title: 'Daftar Kelas', icon: Users, href: '/wali-kelas/classes' },
        { title: 'Daftar Mata Pelajaran', icon: BookOpen, href: '/wali-kelas/management' },
      ],
    },
    {
      title: 'Mata Pelajaran & Kelas',
      items: [
        { title: 'Mata Pelajaran', icon: Library, href: '/wali-kelas/subjects' },
        { title: 'Kompetensi', icon: Target, href: '/wali-kelas/competencies' },
        { title: 'Absensi', icon: CheckCircle, href: '/wali-kelas/attendance' },
      ],
    },
    {
      title: 'Laporan',
      items: [
        { title: 'Raport Siswa', icon: FileText, href: '/wali-kelas/reports' },
        { title: 'Penilaian', icon: CheckCircle, href: '/wali-kelas/penilaian' },
        { title: 'Raport Arab', icon: Home, href: '/wali-kelas/raport-arab' },
      ],
    },
  ];

  function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    
    const token = localStorage.getItem('accessToken');
    
    // Clear storage FIRST
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    
    // Call logout API in background (fire and forget)
    if (token && token !== 'null' && token !== 'undefined' && token.length > 20) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => {});
    }
    
    // Redirect immediately - do NOT use setTimeout or await
    window.location.href = '/login';
  }

  // Check if we're on pages that need full width without sidebar
  const isFullWidthPage = pathname.includes('/reports/detail') || 
                          pathname.includes('/raport-arab/detail') ||
                          pathname.includes('/raport-arab/cover-preview') ||
                          pathname.includes('/raport-arab/bulk-review') ||
                          pathname.includes('/raport-arab/bulk-download');

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && isMobile && !isFullWidthPage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Hidden on full width pages */}
      {!isFullWidthPage && (
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed md:static md:translate-x-0 md:w-64 w-64 h-screen bg-gradient-to-b from-emerald-900 to-emerald-800 text-white transition-transform duration-300 flex flex-col shadow-lg z-50 md:z-auto`}
      >
        {/* Logo */}
        <div className="p-3 sm:p-4 border-b border-emerald-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-base sm:text-lg font-bold">Raport</h1>
            <p className="text-xs text-emerald-400">Wali Kelas</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-emerald-700 rounded-lg transition-colors md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-2 sm:py-3 px-2 space-y-1 min-h-0">
          {menuItems.map((section, idx) => (
            <div key={idx}>
              {/* Main Item atau Section Title */}
              {section.items ? (
                <>
                  <h3 className="px-2 sm:px-3 py-1 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
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
                          className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg transition-all ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-lg'
                              : 'text-emerald-300 hover:bg-emerald-700'
                          }`}
                          title={item.title}
                        >
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="text-xs sm:text-sm">{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Link
                  href={section.href!}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg transition-all ${
                    pathname === section.href
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'text-emerald-300 hover:bg-emerald-700'
                  }`}
                  title={section.title}
                >
                  {section.icon && <section.icon size={18} className="flex-shrink-0" />}
                  <span className="text-xs sm:text-sm">{section.title}</span>
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-2 sm:p-3 border-t border-emerald-700 flex-shrink-0">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center gap-2 p-2 sm:p-2.5 rounded-lg transition-all ${
              isLoggingOut 
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                : 'text-emerald-300 hover:bg-red-600 hover:text-white'
            }`}
            title="Logout"
          >
            <LogOut size={18} className={`flex-shrink-0 ${isLoggingOut ? 'animate-spin' : ''}`} />
            <span className="text-xs sm:text-sm">
              {isLoggingOut ? 'Logging out...' : 'Logout'}
            </span>
          </button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto w-full ${!isFullWidthPage && 'flex flex-col'}`}>
        {!isFullWidthPage && (
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
        )}
        <div className={isFullWidthPage ? '' : 'p-3 sm:p-4 md:p-8'}>
          {children}
        </div>
      </main>
    </div>
  );
}
