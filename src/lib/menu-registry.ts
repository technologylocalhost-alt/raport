import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Building2,
  GraduationCap,
  BookOpen,
  Users,
  BarChart3,
  Layers,
  Clock,
  TrendingUp,
  Brain,
  ClipboardList,
  Library,
  CheckCircle,
  FileText,
} from 'lucide-react';

export type MenuSourceRole = 'admin' | 'teacher' | 'wali-kelas';
export type MenuKind = 'menu' | 'utility';

export interface MenuItemConfig {
  title: string;
  icon: LucideIcon;
  href: string;
  kind?: MenuKind;
  sourceRole?: MenuSourceRole;
  order?: number;
  aliasEnabled?: boolean;
}

export interface MenuSectionConfig {
  title: string;
  href?: string;
  icon?: LucideIcon;
  items?: MenuItemConfig[];
  kind?: MenuKind;
  sourceRole?: MenuSourceRole;
  order?: number;
  aliasEnabled?: boolean;
}

export interface MenuPermissionSeed {
  menuPath: string;
  menuTitle: string;
  menuGroup: string;
}

export interface FlatMenuItem extends MenuItemConfig {
  menuGroup: string;
  sectionTitle: string;
}

export const allMenuSections: MenuSectionConfig[] = [
  {
    title: 'Dashboard',
    icon: Home,
    href: '/admin/dashboard',
  },
  {
    title: 'Dashboard',
    icon: Home,
    href: '/teacher/dashboard',
  },
  {
    title: 'Dashboard',
    icon: Home,
    href: '/wali-kelas/dashboard',
  },
  {
    title: 'Admin · Master Data',
    items: [
      { title: 'Data Sekolah', icon: Building2, href: '/admin/schools' },
      { title: 'Struktur Akademik', icon: Clock, href: '/admin/academic-structure' },
      { title: 'Jenjang Pendidikan', icon: GraduationCap, href: '/admin/levels' },
      { title: 'Mata Pelajaran', icon: BookOpen, href: '/admin/subjects' },
      { title: 'Kelas', icon: Layers, href: '/admin/classes' },
      { title: 'Master Data Santri', icon: Users, href: '/admin/santri' },
    ],
  },
  {
    title: 'Admin · Penilaian',
    items: [
      { title: 'Per Mata Pelajaran', icon: BookOpen, href: '/admin/penilaian' },
      { title: 'Penilaian', icon: Users, href: '/admin/raports' },
      { title: 'Siswa', icon: BarChart3, href: '/admin/students' },
      { title: 'Raport', icon: BookOpen, href: '/admin/raport-sampul' },
      { title: 'Naik Kelas', icon: TrendingUp, href: '/admin/naik-kelas' },
    ],
  },
  {
    title: 'Admin · Raport Mental',
    items: [
      { title: 'Master Data (Seksi & Aspek)', icon: Brain, href: '/admin/raport-mental' },
      { title: 'Penilaian Santri', icon: ClipboardList, href: '/admin/raport-mental/penilaian' },
    ],
  },
  {
    title: 'Admin · Manajemen',
    items: [
      { title: 'Pengguna', icon: Users, href: '/admin/users' },
      { title: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
      { title: 'Activity Logs', icon: Clock, href: '/admin/activity-logs' },
      { title: 'Pengaturan RBAC', icon: ClipboardList, href: '/admin/settings/rbac' },
    ],
  },
  {
    title: 'Guru · Fitur Utama',
    items: [
      { title: 'Mata Pelajaran', icon: Library, href: '/teacher/subjects' },
      { title: 'Daftar Nilai', icon: BookOpen, href: '/teacher/grades' },
      { title: 'Absensi', icon: CheckCircle, href: '/teacher/attendance' },
    ],
  },
  {
    title: 'Guru · Laporan',
    items: [
      { title: 'Analytics', icon: BarChart3, href: '/teacher/analytics' },
    ],
  },
  {
    title: 'Guru · Raport Mental',
    items: [
      { title: 'Master Data (Seksi & Aspek)', icon: Brain, href: '/teacher/raport-mental' },
      { title: 'Penilaian Santri', icon: ClipboardList, href: '/teacher/raport-mental/penilaian' },
    ],
  },
  {
    title: 'Wali Kelas · Master Data Kelas',
    items: [
      { title: 'Daftar Kelas', icon: Users, href: '/wali-kelas/classes' },
      { title: 'Daftar Mata Pelajaran', icon: BookOpen, href: '/wali-kelas/management' },
    ],
  },
  {
    title: 'Wali Kelas · Mata Pelajaran & Kelas',
    items: [
      { title: 'Mata Pelajaran', icon: Library, href: '/wali-kelas/subjects' },
      { title: 'Absensi', icon: CheckCircle, href: '/wali-kelas/attendance' },
    ],
  },
  {
    title: 'Wali Kelas · Laporan',
    items: [
      { title: 'Raport Siswa', icon: FileText, href: '/wali-kelas/reports' },
      { title: 'Penilaian', icon: CheckCircle, href: '/wali-kelas/penilaian' },
      { title: 'Raport Arab', icon: Home, href: '/wali-kelas/raport-arab' },
    ],
  },
  {
    title: 'Wali Kelas · Raport Mental',
    items: [
      { title: 'Master Data (Seksi & Aspek)', icon: Brain, href: '/wali-kelas/raport-mental' },
      { title: 'Penilaian Santri', icon: ClipboardList, href: '/wali-kelas/raport-mental/penilaian' },
    ],
  },
];

export function getMenuGroupFromHref(href: string): MenuSourceRole {
  return (href.split('/').filter(Boolean)[0] || 'admin') as MenuSourceRole;
}

export function getFlatMenuItems(): FlatMenuItem[] {
  return allMenuSections.flatMap((section, sectionIndex) => {
    if (section.items) {
      return section.items.map((item, itemIndex) => ({
        ...item,
        kind: item.kind || section.kind || 'menu',
        sourceRole: item.sourceRole || section.sourceRole || getMenuGroupFromHref(item.href),
        order: item.order ?? ((section.order ?? sectionIndex + 1) * 100 + itemIndex + 1),
        aliasEnabled: item.aliasEnabled ?? section.aliasEnabled ?? true,
        menuGroup: getMenuGroupFromHref(item.href),
        sectionTitle: section.title,
      }));
    }

    if (section.href && section.icon) {
      return [{
        title: section.title,
        icon: section.icon,
        href: section.href,
        kind: section.kind || 'menu',
        sourceRole: section.sourceRole || getMenuGroupFromHref(section.href),
        order: section.order ?? ((sectionIndex + 1) * 100),
        aliasEnabled: section.aliasEnabled ?? true,
        menuGroup: getMenuGroupFromHref(section.href),
        sectionTitle: section.title,
      }];
    }

    return [];
  });
}

export function getMenuPermissionSeeds(): MenuPermissionSeed[] {
  return getFlatMenuItems().map((item) => ({
    menuPath: item.href,
    menuTitle: item.title,
    menuGroup: item.menuGroup,
  }));
}
