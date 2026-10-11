import { useState } from 'react';
import Button from '@/components/Button/Button';
import TargetPicker from '@/components/voucher/TargetPicker';
import StatusBadge from '@/components/voucher/StatusBadge';
import {
    formatDate,
    percent,
    targetsText,
} from '@/components/voucher/voucherFormat';
import * as voucherApi from '@/data/voucher/voucherApi';
import { describeApiError } from '@/lib/apiErrors';
import { toIso } from '@/lib/dateInput';

type EligibleUser = { id: number; name: string; email: string };

const fieldClass =
    'w-full rounded-xl border border-oxford-navy-900/15 bg-white p-3 text-sm text-oxford-navy-900 outline-none transition placeholder:text-oxford-navy-900/40 hover:border-oxford-navy-900/30 focus:border-forest-moss-500 focus:ring-2 focus:ring-forest-moss-500/30';

export default function GrantsTab({
    grants,
    items,
    onChanged,
}: {
    grants: voucherApi.VoucherGrant[];
    items: voucherApi.DiscountRow[];
    onChanged: () => Promise<unknown>;
}) {
    const [message, setMessage] = useState<string>('');
    const [isError, setIsError] = useState<boolean>(false);
    const [isBusy, setIsBusy] = useState<boolean>(false);

    // form
    const [userQuery, setUserQuery] = useState<string>('');
    const [candidates, setCandidates] = useState<EligibleUser[] | null>(null);
    const [recipients, setRecipients] = useState<EligibleUser[]>([]);
    const [allEligible, setAllEligible] = useState<boolean>(false);
    const [name, setName] = useState<string>('');
    const [targets, setTargets] = useState<voucherApi.VoucherTarget[]>([]);
    const [pool, setPool] = useState<string>('');
    const [maxVouchers, setMaxVouchers] = useState<string>('');
    const [periodDays, setPeriodDays] = useState<string>('30');
    const [startsAt, setStartsAt] = useState<string>('');
    const [endsAt, setEndsAt] = useState<string>('');

    async function run(action: () => Promise<{ message?: string }>) {
        setIsBusy(true);
        setMessage('');
        setIsError(false);

        try {
            const response = await action();
            setMessage(response.message ?? 'Berhasil.');
            await onChanged();

            return true;
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));

            return false;
        } finally {
            setIsBusy(false);
        }
    }

    async function searchUsers() {
        setIsError(false);
        setMessage('');

        try {
            const response = await voucherApi.adminEligibleUsers(userQuery);
            setCandidates(response.data);
        } catch (caught) {
            setIsError(true);
            setMessage(describeApiError(caught));
        }
    }

    async function handleCreate() {
        const ok = await run(() =>
            voucherApi.adminCreateGrant({
                ...(allEligible
                    ? { all_eligible: true }
                    : { user_ids: recipients.map((user) => user.id) }),
                name: name.trim() || null,
                targets,
                pool_percent: Number(pool),
                max_vouchers: Number(maxVouchers),
                period_days: Number(periodDays),
                starts_at: toIso(startsAt),
                ends_at: toIso(endsAt),
            })
        );

        if (ok) {
            setRecipients([]);
            setAllEligible(false);
            setCandidates(null);
            setUserQuery('');
            setName('');
            setTargets([]);
            setPool('');
            setMaxVouchers('');
            setStartsAt('');
            setEndsAt('');
        }
    }

    const canCreate =
        (allEligible || recipients.length > 0) &&
        targets.length > 0 &&
        Number(pool) > 0 &&
        Number(maxVouchers) >= 1 &&
        Number(periodDays) >= 1;

    return (
        <div className="flex flex-col gap-6">
            <p className="text-oxford-navy-900/80 text-sm">
                Beri penulis/editor yang sudah punya naskah terbit hak membuat
                kode voucher. Kolam persen dibagi pembuatnya menjadi diskon
                untuk pembeli + fee untuknya (mis. kolam 30% → diskon 10% + fee
                20%). Tiap periode, kuota kembali penuh dan voucher periode
                sebelumnya tidak bisa dipakai lagi.
            </p>

            <div className="flex flex-col gap-3 rounded-xl ring-1 ring-forest-moss-100 p-4">
                <p className="text-oxford-navy-900 font-semibold">
                    Beri hak voucher
                </p>

                <div className="flex flex-col gap-2">
                    <p className="text-oxford-navy-900 text-sm font-medium">
                        Penerima (penulis/editor dengan naskah terbit):{' '}
                        {allEligible
                            ? 'semua yang berhak'
                            : `${recipients.length} dipilih`}
                    </p>
                    <label className="flex flex-row items-center gap-2 text-sm text-oxford-navy-900">
                        <input
                            type="checkbox"
                            checked={allEligible}
                            onChange={(e) => setAllEligible(e.target.checked)}
                        />
                        <span className="font-semibold">
                            Semua penulis/editor yang berhak
                        </span>
                        <span className="text-oxford-navy-900/60">
                            (yang punya naskah terbit saat ini)
                        </span>
                    </label>

                    {!allEligible && (
                        <>
                            {recipients.length > 0 && (
                                <div className="flex flex-row flex-wrap gap-2">
                                    {recipients.map((recipient) => (
                                        <span
                                            key={recipient.id}
                                            className="inline-flex items-center gap-2 rounded-full bg-forest-moss-50 ring-1 ring-forest-moss-200 px-3 py-1 text-sm text-oxford-navy-900"
                                        >
                                            {recipient.name}
                                            <button
                                                type="button"
                                                aria-label={`Hapus ${recipient.name}`}
                                                className="text-red-600 hover:cursor-pointer"
                                                onClick={() =>
                                                    setRecipients((prev) =>
                                                        prev.filter(
                                                            (item) =>
                                                                item.id !==
                                                                recipient.id
                                                        )
                                                    )
                                                }
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-row gap-2">
                                <input
                                    className={fieldClass}
                                    value={userQuery}
                                    placeholder="Cari nama atau email"
                                    onChange={(e) =>
                                        setUserQuery(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            searchUsers();
                                        }
                                    }}
                                />
                                <Button
                                    variant="outline2"
                                    className="shrink-0"
                                    onClick={searchUsers}
                                >
                                    Cari
                                </Button>
                            </div>
                            {candidates && candidates.length === 0 && (
                                <p className="text-oxford-navy-900/60 text-sm">
                                    Tidak ada penulis/editor berhak yang cocok.
                                </p>
                            )}
                            {candidates && candidates.length > 0 && (
                                <div className="flex flex-col gap-1">
                                    <button
                                        type="button"
                                        className="self-start text-sm text-forest-moss-700 hover:underline hover:cursor-pointer"
                                        onClick={() =>
                                            setRecipients((prev) => [
                                                ...prev,
                                                ...candidates.filter(
                                                    (candidate) =>
                                                        !prev.some(
                                                            (item) =>
                                                                item.id ===
                                                                candidate.id
                                                        )
                                                ),
                                            ])
                                        }
                                    >
                                        Tambahkan semua hasil pencarian (
                                        {candidates.length})
                                    </button>
                                    {candidates.map((candidate) => {
                                        const added = recipients.some(
                                            (item) => item.id === candidate.id
                                        );

                                        return (
                                            <button
                                                key={candidate.id}
                                                type="button"
                                                disabled={added}
                                                onClick={() =>
                                                    setRecipients((prev) => [
                                                        ...prev,
                                                        candidate,
                                                    ])
                                                }
                                                className="text-left rounded-lg ring-1 ring-forest-moss-100 p-2 text-sm hover:bg-forest-moss-50 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {added && '✓ '}
                                                {candidate.name}{' '}
                                                <span className="text-oxford-navy-900/60">
                                                    {candidate.email}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70 sm:col-span-2">
                        Nama hak (opsional, mis. "Voucher Paket A")
                        <input
                            className={fieldClass}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Kolam diskon + fee (%)
                        <input
                            className={fieldClass}
                            type="number"
                            min={0}
                            max={100}
                            step="0.5"
                            value={pool}
                            onChange={(e) => setPool(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Maksimal jumlah voucher per periode
                        <input
                            className={fieldClass}
                            type="number"
                            min={1}
                            value={maxVouchers}
                            onChange={(e) => setMaxVouchers(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Lama berlaku tiap periode (hari)
                        <input
                            className={fieldClass}
                            type="number"
                            min={1}
                            value={periodDays}
                            onChange={(e) => setPeriodDays(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70">
                        Mulai (kosong = sekarang)
                        <input
                            className={fieldClass}
                            type="datetime-local"
                            value={startsAt}
                            onChange={(e) => setStartsAt(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-oxford-navy-900/70 sm:col-span-2">
                        Hak berakhir (kosong = berulang terus sampai
                        dinonaktifkan)
                        <input
                            className={fieldClass}
                            type="datetime-local"
                            value={endsAt}
                            onChange={(e) => setEndsAt(e.target.value)}
                        />
                    </label>
                </div>

                <p className="text-oxford-navy-900 text-sm font-medium">
                    Produk yang boleh dibuat voucher
                </p>
                <TargetPicker
                    items={items}
                    value={targets}
                    onChange={setTargets}
                />

                <Button
                    variant="primary"
                    className="self-start"
                    disabled={isBusy || !canCreate}
                    onClick={handleCreate}
                >
                    Beri Hak Voucher
                </Button>
            </div>

            {message && (
                <p
                    className={`text-sm ${isError ? 'text-red-600' : 'text-forest-moss-700'}`}
                >
                    {message}
                </p>
            )}

            <div className="flex flex-col gap-3">
                {grants.length === 0 ? (
                    <p className="text-oxford-navy-900/60 text-sm">
                        Belum ada hak voucher.
                    </p>
                ) : (
                    grants.map((grant) => (
                        <div
                            key={grant.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-3"
                        >
                            <div className="flex flex-col gap-1 min-w-0">
                                <div className="flex flex-row flex-wrap items-center gap-2">
                                    <span className="text-oxford-navy-900 font-semibold">
                                        {grant.user_name}
                                    </span>
                                    <StatusBadge status={grant.status} />
                                </div>
                                <p className="text-oxford-navy-900/70 text-xs">
                                    {grant.name && `${grant.name} • `}
                                    {targetsText(grant.targets)}
                                </p>
                                <p className="text-oxford-navy-900/70 text-xs">
                                    Kolam {percent(grant.pool_percent)} • maks.{' '}
                                    {grant.max_vouchers} voucher per{' '}
                                    {grant.period_days} hari • periode ini{' '}
                                    {grant.used_quota}/{grant.max_vouchers}
                                    {grant.cycle_ends_at &&
                                        ` (berakhir ${formatDate(grant.cycle_ends_at)})`}
                                </p>
                                <p className="text-oxford-navy-900/60 text-xs">
                                    Mulai {formatDate(grant.starts_at)} •{' '}
                                    {grant.ends_at
                                        ? `berakhir ${formatDate(grant.ends_at)}`
                                        : 'berulang tanpa batas'}{' '}
                                    • {grant.vouchers_count} voucher dibuat
                                </p>
                            </div>
                            <div className="flex flex-row gap-2 shrink-0">
                                <Button
                                    variant="outline2"
                                    disabled={isBusy}
                                    onClick={() =>
                                        run(() =>
                                            voucherApi.adminUpdateGrant(
                                                grant.id,
                                                { is_active: !grant.is_active }
                                            )
                                        )
                                    }
                                >
                                    {grant.is_active ? 'Matikan' : 'Aktifkan'}
                                </Button>
                                <Button
                                    variant="outline2"
                                    disabled={isBusy}
                                    onClick={() => {
                                        if (
                                            window.confirm(
                                                'Cabut hak voucher ini? Hak yang sudah punya voucher hanya dinonaktifkan.'
                                            )
                                        ) {
                                            run(() =>
                                                voucherApi.adminDeleteGrant(
                                                    grant.id
                                                )
                                            );
                                        }
                                    }}
                                >
                                    Cabut
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
