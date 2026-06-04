'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
} from 'lucide-react';
import {
  filterMenuSectionsByAllowedPaths,
  findMenuTitleByPath,
  getMenuDisplayParts,
  isPathAllowed,
  resolveMenuHref,
} from '@/lib/menu-config';
import { toCanonicalPath } from '@/lib/menu-alias';
import { getCurrentUser } from '@/lib/auth/client';
import { fetchAllowedMenuPaths } from '@/lib/rbac-client';
import { devError } from '@/lib/dev-log';

interface TeacherLayoutProps {
  children: React.ReactNode;
}

export default function TeacherLayout({ children }: TeacherLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [extraAccessOpen, setExtraAccessOpen] = useState(true);
  const [userName, setUserName] = useState('Teacher');
  const [userRole, setUserRole] = useState<string>('TEACHER');
  const [allowedPaths, setAllowedPaths] = useState<string[] | null>(null);
  const [isRoleAuthorized, setIsRoleAuthorized] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const canonicalPathname = toCanonicalPath(pathname, userRole);

  // Detect screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auth guard + user info
  useEffect(() => {
    const parsedUser = getCurrentUser();
    if (!parsedUser) {
      router.replace('/login');
      return;
    }

    try {

      const timer = window.setTimeout(() => {
        setUserName(parsedUser.name || 'User');
        setUserRole(parsedUser.role || 'TEACHER');
        setIsRoleAuthorized(true);
      }, 0);

      return () => window.clearTimeout(timer);
    } catch (e) {
      devError('Error parsing user:', e);
      router.replace('/login');
    }
  }, [router]);

  // Fetch allowed menu paths for RBAC
  useEffect(() => {
    if (!isRoleAuthorized) return;

    async function fetchAllowedMenus() {
      try {
        const { allowedPaths, hasRestrictions } = await fetchAllowedMenuPaths('teacher');
        setAllowedPaths(hasRestrictions ? allowedPaths : null);
      } catch {
        // Fail closed on RBAC API error
        setAllowedPaths([]);
      }
    }
    fetchAllowedMenus();
  }, [isRoleAuthorized]);

  useEffect(() => {
    if (!isRoleAuthorized || allowedPaths === undefined) return;
    if (allowedPaths !== null && !isPathAllowed(pathname, allowedPaths, userRole)) {
      router.replace(resolveMenuHref(allowedPaths[0] || '/login', userRole));
    }
  }, [allowedPaths, isRoleAuthorized, pathname, router, userRole]);

  const filteredMenuItems = filterMenuSectionsByAllowedPaths(allowedPaths, userRole);

  function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    // Navigate to logout page which will handle the logout process
    window.location.href = '/logout';
  }

  if (!isRoleAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-600 text-sm">Memverifikasi akses...</div>
      </div>
    );
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
            <p className="text-xs text-slate-400">Guru</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-slate-700 rounded-lg transition-colors md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto py-2 sm:py-3 px-2 space-y-1 min-h-0">
          {filteredMenuItems.map((section, idx) => {
            const isExtraAccessSection = section.title === 'Akses Tambahan';
            const isSectionOpen = !isExtraAccessSection || extraAccessOpen;

            return (
            <div key={idx}>
              {/* Main Item atau Section Title */}
              {section.items ? (
                <>
                  {isExtraAccessSection ? (
                    <button
                      type="button"
                      onClick={() => setExtraAccessOpen((prev) => !prev)}
                      className="w-full px-2 sm:px-3 py-1 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
                    >
                      <span>{section.title}</span>
                      <ChevronDown size={14} className={`transition-transform ${isSectionOpen ? 'rotate-0' : '-rotate-90'}`} />
                    </button>
                  ) : (
                    <h3 className="px-2 sm:px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {section.title}
                    </h3>
                  )}
                  {isSectionOpen && (
                    <div className="space-y-0.5">
                      {section.items.map((item, itemIdx) => {
                        const Icon = item.icon;
                        const href = resolveMenuHref(item.href, userRole);
                        const isActive = canonicalPathname === item.href;
                        const { label, badge } = getMenuDisplayParts(item.title);
                        return (
                          <Link
                            key={itemIdx}
                            href={href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-lg'
                                : 'text-slate-300 hover:bg-slate-700'
                            }`}
                            title={item.title}
                          >
                            <Icon size={18} className="flex-shrink-0" />
                            <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm truncate">{label}</span>
                              {badge && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                                  isActive
                                    ? 'border-white/30 bg-white/15 text-white'
                                    : 'border-slate-600 bg-slate-800 text-slate-300'
                                }`}>
                                  {badge}
                                </span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={resolveMenuHref(section.href!, userRole)}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-lg transition-all ${
                    canonicalPathname === section.href
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                  title={section.title}
                >
                  {section.icon && <section.icon size={18} className="flex-shrink-0" />}
                  <span className="text-xs sm:text-sm">{section.title}</span>
                </Link>
              )}
            </div>
            );
          })}
        </nav>
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
                {findMenuTitleByPath(pathname, userRole)}
              </h2>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap flex-shrink-0 hidden sm:block">
                {new Date().toLocaleDateString('id-ID', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              
              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700 hidden md:block">{userName}</span>
                  <ChevronDown size={16} className="text-gray-500" />
                </button>
                
                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <Link
                        href="/teacher/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <User size={16} />
                        <span>Profile</span>
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          handleLogout();
                        }}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <LogOut size={16} />
                        <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
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
