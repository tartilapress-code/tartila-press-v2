import { useEffect, useState } from 'react';
import Input from '@/components/Input/Input';
import * as profileApi from '@/data/profile/profileApi';

const textareaClass = `
    w-full p-3 outline-none rounded-xl ring-1 ring-white/30 placeholder:text-white
    focus:ring-1 focus:ring-oxford-navy-500 focus:bg-oxford-navy-900/70`;

export type ShippingAddressValue = {
    recipient_name: string;
    recipient_phone: string;
    recipient_address: string;
};

type SavedProfile = {
    name: string;
    phone: string | null;
    domicile_address: string | null;
};

export default function ShippingAddressFields({
    value,
    onChange,
}: {
    value: ShippingAddressValue;
    onChange: (value: ShippingAddressValue) => void;
}) {
    const [profile, setProfile] = useState<SavedProfile | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        profileApi
            .getProfile()
            .then((response) => {
                setProfile({
                    name: response.data.user.name,
                    phone: response.data.profile?.phone ?? null,
                    domicile_address:
                        response.data.profile?.domicile_address ?? null,
                });
            })
            .catch(() => setProfile(null))
            .finally(() => setIsLoading(false));
    }, []);

    function update(field: keyof ShippingAddressValue, fieldValue: string) {
        onChange({ ...value, [field]: fieldValue });
    }

    if (isLoading) {
        return (
            <p className="text-white/60 text-sm">
                Memuat data pengiriman...
            </p>
        );
    }

    const hasSavedAddress = Boolean(
        profile?.phone && profile?.domicile_address
    );
    const mark = hasSavedAddress ? '' : ' *';

    return (
        <div className="flex flex-col gap-3">
            <h6 className="text-white font-semibold">Alamat Pengiriman</h6>
            <p className="text-white/60 text-sm">
                {hasSavedAddress
                    ? 'Kosongkan untuk memakai data yang sudah tersimpan di Data Pribadi Anda.'
                    : 'Data pengiriman Anda belum lengkap. Isi di bawah ini, atau lengkapi dulu di Data Pribadi.'}
            </p>

            <Input
                label={`Nama Penerima${mark}`}
                value={value.recipient_name}
                placeholder={profile?.name ?? ''}
                onChange={(e) => update('recipient_name', e.target.value)}
                required={!hasSavedAddress}
            />
            <Input
                label={`No. WhatsApp${mark}`}
                value={value.recipient_phone}
                placeholder={profile?.phone ?? ''}
                onChange={(e) => update('recipient_phone', e.target.value)}
                required={!hasSavedAddress}
            />
            <div className="flex flex-col gap-2">
                <label className="text-white">Alamat Pengiriman{mark}</label>
                <textarea
                    className={textareaClass}
                    value={value.recipient_address}
                    placeholder={profile?.domicile_address ?? ''}
                    onChange={(e) =>
                        update('recipient_address', e.target.value)
                    }
                    required={!hasSavedAddress}
                />
            </div>
        </div>
    );
}
