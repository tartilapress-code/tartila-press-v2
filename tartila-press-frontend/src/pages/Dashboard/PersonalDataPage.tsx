import { useEffect, useState, type FormEvent } from 'react';
import Input from '@/components/Input/Input';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import { ApiError } from '@/lib/http';
import * as profileApi from '@/data/profile/profileApi';
import registerOption from '@/data/registration/registration_option.json';

const educationOptions =
    registerOption.find((option) => option.id === 'education_level')
        ?.value ?? [];
const genderOptions =
    registerOption.find((option) => option.id === 'gender')?.value ?? [];

const textareaClass = `
    w-full p-3 outline-none rounded-xl ring-1 ring-white/30 placeholder:text-white
    focus:ring-1 focus:ring-oxford-navy-500 focus:bg-oxford-navy-900/70`;

type PersonalData = {
    education_level: string;
    institution: string;
    age: string;
    gender: string;
    occupation: string;
    phone: string;
    nik: string;
    ktp_address: string;
    domicile_address: string;
    birth_place: string;
    birth_date: string;
};

const emptyData: PersonalData = {
    education_level: '',
    institution: '',
    age: '',
    gender: '',
    occupation: '',
    phone: '',
    nik: '',
    ktp_address: '',
    domicile_address: '',
    birth_place: '',
    birth_date: '',
};

export default function PersonalDataPage() {
    const { user } = useAuth();
    const isPenulis = hasAnyRole(user, ['penulis']);

    const [data, setData] = useState<PersonalData>(emptyData);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');

    useEffect(() => {
        profileApi
            .getProfile()
            .then((response) => {
                const profile = response.data.profile;
                if (!profile) {
                    return;
                }
                setData({
                    education_level: profile.education_level ?? '',
                    institution: profile.institution ?? '',
                    age: profile.age?.toString() ?? '',
                    gender: profile.gender ?? '',
                    occupation: profile.occupation ?? '',
                    phone: profile.phone ?? '',
                    nik: profile.nik ?? '',
                    ktp_address: profile.ktp_address ?? '',
                    domicile_address: profile.domicile_address ?? '',
                    birth_place: profile.birth_place ?? '',
                    birth_date: profile.birth_date ?? '',
                });
            })
            .finally(() => setIsLoading(false));
    }, []);

    function updateField(field: keyof PersonalData, value: string) {
        setData((prev) => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setIsSubmitting(true);
        setStatusMessage('');

        try {
            await profileApi.updateProfile(data);
            setStatusMessage('Data pribadi berhasil disimpan.');
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    return (
        <div className="flex flex-col gap-4 bg-oxford-navy-900/70 backdrop-blur-lg rounded-xl p-6">
            <div>
                <h5 className="text-white text-xl font-semibold">
                    Data Pribadi
                </h5>
                <p className="text-white/70 text-sm">
                    Digunakan untuk keperluan administrasi, termasuk
                    pendaftaran ISBN.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Select
                    name="education_level"
                    label="Tingkat Pendidikan"
                    option_data={educationOptions}
                    value={data.education_level}
                    onChange={(e) =>
                        updateField('education_level', e.target.value)
                    }
                />
                <Input
                    label="Institusi / Sekolah"
                    name="institution"
                    value={data.institution}
                    onChange={(e) =>
                        updateField('institution', e.target.value)
                    }
                />
                <Input
                    label="Umur"
                    name="age"
                    value={data.age}
                    onChange={(e) => updateField('age', e.target.value)}
                />
                <Select
                    name="gender"
                    label="Jenis Kelamin"
                    option_data={genderOptions}
                    value={data.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                />
                <Input
                    label="Pekerjaan / Profesi"
                    name="occupation"
                    value={data.occupation}
                    onChange={(e) =>
                        updateField('occupation', e.target.value)
                    }
                />
                <Input
                    label="Nomor Telepon"
                    name="phone"
                    value={data.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                />

                <hr className="border-white/20" />
                <p className="text-white/70 text-sm">
                    Field di bawah ini{' '}
                    {isPenulis
                        ? 'wajib diisi untuk Penulis (dipakai untuk pendaftaran ISBN).'
                        : 'opsional.'}
                </p>

                <Input
                    label={`NIK${isPenulis ? ' *' : ''}`}
                    name="nik"
                    value={data.nik}
                    onChange={(e) => updateField('nik', e.target.value)}
                    required={isPenulis}
                    maxLength={16}
                />

                <div className="flex flex-col gap-2">
                    <label className="text-white">
                        Alamat KTP{isPenulis ? ' *' : ''}
                    </label>
                    <textarea
                        className={textareaClass}
                        value={data.ktp_address}
                        onChange={(e) =>
                            updateField('ktp_address', e.target.value)
                        }
                        required={isPenulis}
                    />
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-white">
                        Alamat Domisili{isPenulis ? ' *' : ''}
                    </label>
                    <textarea
                        className={textareaClass}
                        value={data.domicile_address}
                        onChange={(e) =>
                            updateField('domicile_address', e.target.value)
                        }
                        required={isPenulis}
                    />
                </div>

                <Input
                    label={`Tempat Lahir${isPenulis ? ' *' : ''}`}
                    name="birth_place"
                    value={data.birth_place}
                    onChange={(e) =>
                        updateField('birth_place', e.target.value)
                    }
                    required={isPenulis}
                />
                <Input
                    label={`Tanggal Lahir${isPenulis ? ' *' : ''}`}
                    name="birth_date"
                    type="date"
                    value={data.birth_date}
                    onChange={(e) =>
                        updateField('birth_date', e.target.value)
                    }
                    required={isPenulis}
                />

                {statusMessage && (
                    <p className="text-sm text-forest-moss-300">
                        {statusMessage}
                    </p>
                )}

                <Button
                    type="submit"
                    variant="primary"
                    className="self-start"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </Button>
            </form>
        </div>
    );
}
