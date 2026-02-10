'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LogOut,
  Home,
  BookOpen,
  FileText,
  CheckCircle,
  BarChart3,
  Library,
  Target,
} from 'lucide-react';

interface TeacherLayoutProps {
  children: React.ReactNode;
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    {
      title: 'Dashboard',
      icon: Home,
      href: '/teacher/dashboard',
    },
    {
      title: 'Fitur Utama',
      items: [
        { title: 'Mata Pelajaran', icon: Library, href: '/teacher/subjects' },
        { title: 'Daftar Nilai', icon: BookOpen, href: '/teacher/grades' },
        { title: 'Absensi', icon: CheckCircle, href: '/teacher/attendance' },
        { title: 'Kompetensi', icon: Target, href: '/teacher/competencies' },
      ],
    },
    {
      title: 'Laporan',
      items: [
        { title: 'Analytics', icon: BarChart3, href: '/teacher/analytics' },
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

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 flex flex-col shadow-lg`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between">
          {sidebarOpen && (
            <div>
              <h1 className="text-xl font-bold">Raport</h1>
              <p className="text-xs text-slate-400">Guru</p>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
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
                    <h3 className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                              ? 'bg-indigo-600 text-white shadow-lg'
                              : 'text-slate-300 hover:bg-slate-700'
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
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-700'
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
        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white transition-all"
            title="Logout"
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">
              {menuItems
                .flatMap((section) => section.items || [section])
                .find((item) => item.href === pathname)?.title || 'Dashboard'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('id-ID', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
