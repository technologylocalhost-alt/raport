'use client';

import { useState } from 'react';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

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

  async function handleLogout() {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // Check if we're on pages that need full width without sidebar
  const isFullWidthPage = pathname.includes('/reports/detail') || 
                          pathname.includes('/raport-arab/detail') ||
                          pathname.includes('/raport-arab/cover-preview') ||
                          pathname.includes('/raport-arab/bulk-review') ||
                          pathname.includes('/raport-arab/bulk-download');

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Hidden on full width pages */}
      {!isFullWidthPage && (
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-emerald-900 to-emerald-800 text-white transition-all duration-300 flex flex-col shadow-lg`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-emerald-700 flex items-center justify-between">
          {sidebarOpen && (
            <div>
              <h1 className="text-lg font-bold">Raport</h1>
              <p className="text-xs text-emerald-400">Wali Kelas</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
          {menuItems.map((section, idx) => (
            <div key={idx}>
              {/* Main Item atau Section Title */}
              {section.items ? (
                <>
                  {sidebarOpen && (
                    <h3 className="px-3 py-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      {section.title}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item, itemIdx) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={itemIdx}
                          href={item.href}
                          className={`flex items-center gap-2 p-2.5 rounded-lg transition-all ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-lg'
                              : 'text-emerald-300 hover:bg-emerald-700'
                          }`}
                          title={item.title}
                        >
                          <Icon size={18} className="flex-shrink-0" />
                          {sidebarOpen && <span className="text-sm">{item.title}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Link
                  href={section.href!}
                  className={`flex items-center gap-2 p-2.5 rounded-lg transition-all ${
                    pathname === section.href
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'text-emerald-300 hover:bg-emerald-700'
                  }`}
                  title={section.title}
                >
                  {section.icon && <section.icon size={18} className="flex-shrink-0" />}
                  {sidebarOpen && <span className="text-sm">{section.title}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-emerald-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 p-2.5 rounded-lg text-emerald-300 hover:bg-red-600 hover:text-white transition-all"
            title="Logout"
          >
            <LogOut size={18} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className={`overflow-auto ${isFullWidthPage ? 'w-full' : 'flex-1'}`}>
        {isFullWidthPage ? children : <div className="p-8">{children}</div>}
      </main>
    </div>
  );
}
