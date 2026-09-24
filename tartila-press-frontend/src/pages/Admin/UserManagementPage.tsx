import { useEffect, useState } from 'react';
import * as adminApi from '@/data/admin/adminApi';
import Button from '@/components/Button/Button';
import { ApiError } from '@/lib/http';

type Role = {
    name: string;
    display_name: string;
};

type UserItem = {
    id: number;
    name: string;
    email: string;
    roles: Role[];
};

const ALL_ROLES = [
    { name: 'user', label: 'User' },
    { name: 'penulis', label: 'Penulis' },
    { name: 'editor', label: 'Editor' },
    { name: 'admin', label: 'Admin' },
    { name: 'owner', label: 'Owner' },
];

function UserRolesRow({ user }: { user: UserItem }) {
    const [selectedRoles, setSelectedRoles] = useState<string[]>(
        user.roles.map((role) => role.name)
    );
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    function toggleRole(roleName: string) {
        setSelectedRoles((prev) =>
            prev.includes(roleName)
                ? prev.filter((name) => name !== roleName)
                : [...prev, roleName]
        );
    }

    async function handleSave() {
        setIsSaving(true);
        setStatusMessage('');

        try {
            await adminApi.updateUserRoles(user.id, selectedRoles);
            setStatusMessage('Tersimpan.');
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
            <div>
                <p className="text-oxford-navy-900 font-semibold">{user.name}</p>
                <p className="text-oxford-navy-900/65 text-sm">{user.email}</p>
            </div>

            <div className="flex flex-row flex-wrap gap-4">
                {ALL_ROLES.map((role) => (
                    <label
                        key={role.name}
                        className="flex flex-row items-center gap-2 text-oxford-navy-900 text-sm"
                    >
                        <input
                            type="checkbox"
                            checked={selectedRoles.includes(role.name)}
                            onChange={() => toggleRole(role.name)}
                        />
                        {role.label}
                    </label>
                ))}
            </div>

            <div className="flex flex-row items-center gap-3">
                <Button
                    variant="primary"
                    className="self-start"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                </Button>
                {statusMessage && (
                    <p className="text-forest-moss-700 text-sm">
                        {statusMessage}
                    </p>
                )}
            </div>
        </div>
    );
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        adminApi
            .listUsers()
            .then((response) => setUsers(response.data))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
            <h5 className="font-display text-oxford-navy-700 text-xl font-bold">Kelola User</h5>

            {isLoading ? (
                <p className="text-oxford-navy-900/70 text-sm">Memuat...</p>
            ) : (
                <div className="flex flex-col gap-3">
                    {users.map((user) => (
                        <UserRolesRow key={user.id} user={user} />
                    ))}
                </div>
            )}
        </div>
    );
}
