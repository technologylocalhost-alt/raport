'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, GitBranch } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { devError } from '@/lib/dev-log';

interface MenuPermission {
  id: string;
  menuPath: string;
  menuTitle: string;
  menuGroup: string;
  roles: string;
  bagian: string | null;
  isActive: boolean;
}

const ROLES = ['ADMIN', 'TEACHER', 'PRINCIPAL', 'WALI_KELAS'];
const BAGIAN_OPTIONS = ['PENGASUHAN', 'MABIKORI', 'PUSDAC', 'LAC', 'EKSKUL'];

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  TEACHER: 'Guru',
  PRINCIPAL: 'Kepsek',
  WALI_KELAS: 'Wali Kelas',
};

const bagianLabels: Record<string, string> = {
  PENGASUHAN: 'Pengasuhan',
  MABIKORI: 'Mabikori',
  PUSDAC: 'PUSDAC',
  LAC: 'LAC',
  EKSKUL: 'Ekskul',
};

const groupLabels: Record<string, string> = {
  admin: 'Admin',
  teacher: 'Guru',
  'wali-kelas': 'Wali Kelas',
};

export default function RBACSettingsPage() {
  const [permissions, setPermissions] = useState<MenuPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    void fetchPermissions();
  }, []);

  async function fetchPermissions() {
    try {
      setIsLoading(true);
      const res = await apiFetch('/api/admin/rbac/menu-permissions');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.data || []);
      }
    } catch (error) {
      devError('Failed to fetch permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function updatePermission<K extends keyof MenuPermission>(id: string, field: K, value: MenuPermission[K]) {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
    setHasChanges(true);
  }

  function toggleRole(perm: MenuPermission, role: string) {
    const currentRoles = perm.roles === 'ALL' ? [...ROLES] : perm.roles.split(',').map((r) => r.trim());

    let newRoles: string[];
    if (currentRoles.includes(role)) {
      newRoles = currentRoles.filter((r) => r !== role);
    } else {
      newRoles = [...currentRoles, role];
    }

    // If all roles selected, use 'ALL'
    const rolesValue = newRoles.length === ROLES.length ? 'ALL' : newRoles.join(',');
    updatePermission(perm.id, 'roles', rolesValue || 'ALL');
  }

  function isRoleChecked(perm: MenuPermission, role: string): boolean {
    if (perm.roles === 'ALL') return true;
    return perm.roles.split(',').map((r) => r.trim()).includes(role);
  }

  function toggleBagian(perm: MenuPermission, bagian: string) {
    const currentBagian = perm.bagian ? perm.bagian.split(',').map((b) => b.trim()) : [];

    let newBagian: string[];
    if (currentBagian.includes(bagian)) {
      newBagian = currentBagian.filter((b) => b !== bagian);
    } else {
      newBagian = [...currentBagian, bagian];
    }

    updatePermission(perm.id, 'bagian', newBagian.length > 0 ? newBagian.join(',') : null);
  }

  function isBagianChecked(perm: MenuPermission, bagian: string): boolean {
    if (!perm.bagian) return false;
    return perm.bagian.split(',').map((b) => b.trim()).includes(bagian);
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      const res = await apiFetch('/api/admin/rbac/menu-permissions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permissions: permissions.map((p) => ({
            id: p.id,
            roles: p.roles,
            bagian: p.bagian,
            isActive: p.isActive,
          })),
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        setPermissions(data?.data || []);
        setHasChanges(false);
        alert('Pengaturan RBAC berhasil disimpan!');
      } else {
        alert(data?.error || 'Gagal menyimpan pengaturan RBAC');
      }
    } catch (error) {
      devError('Save error:', error);
      alert('Gagal menyimpan pengaturan RBAC');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncPermissions() {
    try {
      setIsSyncing(true);
      const res = await apiFetch('/api/admin/rbac/menu-permissions', {
        method: 'POST',
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || 'Gagal sync menu permissions');
        return;
      }

      setPermissions(data?.data?.permissions || []);
      setHasChanges(false);

      const summary = data?.data?.summary;
      const staleText = summary?.staleCount
        ? `\nMenu stale (tidak ada di registry): ${summary.stalePermissions.join(', ')}`
        : '';

      alert(
        `Sync berhasil. Dibuat: ${summary?.createdCount ?? 0}, diperbarui: ${summary?.updatedCount ?? 0}, stale: ${summary?.staleCount ?? 0}.${staleText}`
      );
    } catch (error) {
      devError('Sync error:', error);
      alert('Gagal sync menu permissions');
    } finally {
      setIsSyncing(false);
    }
  }

  // Group permissions by menuGroup
  const grouped = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.menuGroup]) acc[perm.menuGroup] = [];
      acc[perm.menuGroup].push(perm);
      return acc;
    },
    {} as Record<string, MenuPermission[]>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pengaturan RBAC</h1>
          <p className="text-gray-600 text-sm mt-1">
            Atur akses menu berdasarkan role dan bagian. Centang role/bagian yang diizinkan mengakses menu.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={fetchPermissions}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button
            onClick={handleSyncPermissions}
            disabled={isSyncing || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GitBranch size={18} />
            {isSyncing ? 'Syncing...' : 'Sync Menu'}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || isSyncing}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Save size={18} />
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Panduan:</strong>
        <ul className="mt-1 list-disc list-inside space-y-1">
          <li><strong>Role:</strong> Centang role yang boleh mengakses menu. Jika semua dicentang = ALL (semua role).</li>
          <li><strong>Bagian:</strong> Opsional. Jika dicentang, hanya user dengan bagian tersebut yang bisa mengakses. Kosong = tidak ada batasan bagian.</li>
          <li><strong>Aktif:</strong> Nonaktifkan untuk menyembunyikan menu dari semua user.</li>
          <li><strong>Sync Menu:</strong> Sinkronkan daftar menu dari registry ke database sebelum mengatur permission baru.</li>
        </ul>
      </div>

      {/* Permission Tables by Group */}
      {Object.entries(grouped).map(([group, perms]) => (
        <div key={group} className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Layout: {groupLabels[group] || group}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 min-w-[180px]">Menu</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Aktif</th>
                  {ROLES.map((role) => (
                    <th key={role} className="px-2 py-3 text-center font-semibold text-gray-700 min-w-[70px]">
                      {roleLabels[role]}
                    </th>
                  ))}
                  <th className="px-2 py-3 text-center font-semibold text-gray-600 border-l" colSpan={BAGIAN_OPTIONS.length}>
                    Bagian (Opsional)
                  </th>
                </tr>
                <tr className="border-b bg-gray-50">
                  <th colSpan={2 + ROLES.length}></th>
                  {BAGIAN_OPTIONS.map((b) => (
                    <th key={b} className="px-1 py-1 text-center text-xs font-medium text-gray-500 border-l first:border-l">
                      {bagianLabels[b]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {perms.map((perm) => (
                  <tr key={perm.id} className={`hover:bg-gray-50 transition-colors ${!perm.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{perm.menuTitle}</div>
                      <div className="text-xs text-gray-400">{perm.menuPath}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={perm.isActive}
                        onChange={(e) => updatePermission(perm.id, 'isActive', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </td>
                    {ROLES.map((role) => (
                      <td key={role} className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isRoleChecked(perm, role)}
                          onChange={() => toggleRole(perm, role)}
                          disabled={!perm.isActive}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                      </td>
                    ))}
                    {BAGIAN_OPTIONS.map((b) => (
                      <td key={b} className="px-1 py-3 text-center border-l first:border-l">
                        <input
                          type="checkbox"
                          checked={isBagianChecked(perm, b)}
                          onChange={() => toggleBagian(perm, b)}
                          disabled={!perm.isActive}
                          className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
