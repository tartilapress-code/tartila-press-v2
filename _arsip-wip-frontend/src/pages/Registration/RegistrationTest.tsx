import { useActionState } from 'react';

type FormState = {
    success: boolean;
    message: string;
};

async function handleSubmit(
    previousState: FormState | null,
    formData: FormData
): Promise<FormState> {
    const nama = formData.get('nama');

    if (!nama || typeof nama !== 'string') {
        return {
            success: false,
            message: 'Nama wajib diisi.',
        };
    }

    return {
        success: true,
        message: `Halo, ${nama}!`,
    };
}

export default function MyForm() {
    const [state, formAction, isPending] = useActionState(handleSubmit, null);

    return (
        <form action={formAction}>
            <input name="nama" placeholder="Masukkan nama" />

            <button type="submit" disabled={isPending}>
                {isPending ? 'Menyimpan...' : 'Kirim'}
            </button>

            {state && <p>{state.message}</p>}
        </form>
    );
}
