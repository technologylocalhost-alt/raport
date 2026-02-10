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
      title: 'Master Data',
      items: [
        { title: 'Daftar Kelas', icon: Users, href: '/wali-kelas/classes' },
        { title: 'Manajemen Kelas', icon: BookOpen, href: '/wali-kelas/management' },
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

  // Check if we're on detail report page - hide sidebar
  const isDetailReportPage = pathname.includes('/reports/detail');

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Hidden on detail report page */}
      {!isDetailReportPage && (
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-emerald-900 to-emerald-800 text-white transition-all duration-300 flex flex-col shadow-lg`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-emerald-700 flex items-center justify-between">
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold">Raport</h1>
              <p className="text-xs text-emerald-400">Wali Kelas</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-emerald-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-4">
          {menuItems.map((section, idx) => (
            <div key={idx}>
              {/* Main Item atau Section Title */}
              {section.items ? (
                <>
                  {sidebarOpen && (
                    <h3 className="px-4 py-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
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
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-lg'
                              : 'text-emerald-300 hover:bg-emerald-700'
                          }`}
                          title={item.title}
                        >
                          <Icon size={20} className="flex-shrink-0" />
                          {sidebarOpen && <span>{item.title}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </>
              ) : (
                <Link
                  href={section.href!}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    pathname === section.href
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'text-emerald-300 hover:bg-emerald-700'
                  }`}
                  title={section.title}
                >
                  {section.icon && <section.icon size={20} className="flex-shrink-0" />}
                  {sidebarOpen && <span>{section.title}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-emerald-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-emerald-300 hover:bg-red-600 hover:text-white transition-all"
            title="Logout"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className={`overflow-auto ${isDetailReportPage ? 'w-full' : 'flex-1'}`}>
        {isDetailReportPage ? children : <div className="p-8">{children}</div>}
      </main>
    </div>
  );
}
