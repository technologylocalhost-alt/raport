import type { ComponentType } from 'react';

import AdminDashboardPage from '@/app/admin/dashboard/page';
import AdminSchoolsPage from '@/app/admin/schools/page';
import AdminAcademicStructurePage from '@/app/admin/academic-structure/page';
import AdminLevelsPage from '@/app/admin/levels/page';
import AdminSubjectsPage from '@/app/admin/subjects/page';
import AdminClassesPage from '@/app/admin/classes/page';
import AdminSantriPage from '@/app/admin/santri/page';
import AdminPenilaianPage from '@/app/admin/penilaian/page';
import AdminRaportsPage from '@/app/admin/raports/page';
import AdminStudentsPage from '@/app/admin/students/page';
import AdminRaportSampulPage from '@/app/admin/raport-sampul/page';
import AdminNaikKelasPage from '@/app/admin/naik-kelas/page';
import AdminRaportMentalPage from '@/app/admin/raport-mental/page';
import AdminRaportMentalPenilaianPage from '@/app/admin/raport-mental/penilaian/page';
import AdminUsersPage from '@/app/admin/users/page';
import AdminAnalyticsPage from '@/app/admin/analytics/page';
import AdminActivityLogsPage from '@/app/admin/activity-logs/page';
import AdminRbacSettingsPage from '@/app/admin/settings/rbac/page';

import TeacherDashboardPage from '@/app/teacher/dashboard/page';
import TeacherSubjectsPage from '@/app/teacher/subjects/page';
import TeacherGradesPage from '@/app/teacher/grades/page';
import TeacherAttendancePage from '@/app/teacher/attendance/page';
import TeacherAnalyticsPage from '@/app/teacher/analytics/page';
import TeacherRaportMentalPage from '@/app/teacher/raport-mental/page';
import TeacherRaportMentalPenilaianPage from '@/app/teacher/raport-mental/penilaian/page';

import WaliKelasDashboardPage from '@/app/wali-kelas/dashboard/page';
import WaliKelasClassesPage from '@/app/wali-kelas/classes/page';
import WaliKelasManagementPage from '@/app/wali-kelas/management/page';
import WaliKelasSubjectsPage from '@/app/wali-kelas/subjects/page';
import WaliKelasAttendancePage from '@/app/wali-kelas/attendance/page';
import WaliKelasReportsPage from '@/app/wali-kelas/reports/page';
import WaliKelasPenilaianPage from '@/app/wali-kelas/penilaian/page';
import WaliKelasRaportArabPage from '@/app/wali-kelas/raport-arab/page';
import WaliKelasRaportMentalPage from '@/app/wali-kelas/raport-mental/page';
import WaliKelasRaportMentalPenilaianPage from '@/app/wali-kelas/raport-mental/penilaian/page';

export const aliasedPageRegistry: Record<string, ComponentType> = {
  '/admin/dashboard': AdminDashboardPage,
  '/admin/schools': AdminSchoolsPage,
  '/admin/academic-structure': AdminAcademicStructurePage,
  '/admin/levels': AdminLevelsPage,
  '/admin/subjects': AdminSubjectsPage,
  '/admin/classes': AdminClassesPage,
  '/admin/santri': AdminSantriPage,
  '/admin/penilaian': AdminPenilaianPage,
  '/admin/raports': AdminRaportsPage,
  '/admin/students': AdminStudentsPage,
  '/admin/raport-sampul': AdminRaportSampulPage,
  '/admin/naik-kelas': AdminNaikKelasPage,
  '/admin/raport-mental': AdminRaportMentalPage,
  '/admin/raport-mental/penilaian': AdminRaportMentalPenilaianPage,
  '/admin/users': AdminUsersPage,
  '/admin/analytics': AdminAnalyticsPage,
  '/admin/activity-logs': AdminActivityLogsPage,
  '/admin/settings/rbac': AdminRbacSettingsPage,

  '/teacher/dashboard': TeacherDashboardPage,
  '/teacher/subjects': TeacherSubjectsPage,
  '/teacher/grades': TeacherGradesPage,
  '/teacher/attendance': TeacherAttendancePage,
  '/teacher/analytics': TeacherAnalyticsPage,
  '/teacher/raport-mental': TeacherRaportMentalPage,
  '/teacher/raport-mental/penilaian': TeacherRaportMentalPenilaianPage,

  '/wali-kelas/dashboard': WaliKelasDashboardPage,
  '/wali-kelas/classes': WaliKelasClassesPage,
  '/wali-kelas/management': WaliKelasManagementPage,
  '/wali-kelas/subjects': WaliKelasSubjectsPage,
  '/wali-kelas/attendance': WaliKelasAttendancePage,
  '/wali-kelas/reports': WaliKelasReportsPage,
  '/wali-kelas/penilaian': WaliKelasPenilaianPage,
  '/wali-kelas/raport-arab': WaliKelasRaportArabPage,
  '/wali-kelas/raport-mental': WaliKelasRaportMentalPage,
  '/wali-kelas/raport-mental/penilaian': WaliKelasRaportMentalPenilaianPage,
};
