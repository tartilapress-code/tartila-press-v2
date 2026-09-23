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
        <div className="flex flex-col gap-3 bg-oxford-navy-900/40 rounded-lg p-4">
            <div>
                <p className="text-white font-semibold">{user.name}</p>
                <p className="text-white/60 text-sm">{user.email}</p>
            </div>

            <div className="flex flex-row flex-wrap gap-4">
                {ALL_ROLES.map((role) => (
                    <label
                        key={role.name}
                        className="flex flex-row items-center gap-2 text-white text-sm"
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
                    <p className="text-forest-moss-300 text-sm">
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
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <h5 className="text-white text-xl font-semibold">Kelola User</h5>

            {isLoading ? (
                <p className="text-white/70 text-sm">Memuat...</p>
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
