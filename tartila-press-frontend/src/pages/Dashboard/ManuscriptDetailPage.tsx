import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import { ApiError } from '@/lib/http';
import * as manuscriptApi from '@/data/manuscript/manuscriptApi';
import * as adminApi from '@/data/admin/adminApi';
import * as editorApi from '@/data/editor/editorApi';

type Category = { id: number; name: string };

type Revision = {
    id: number;
    revision_number: number;
    role: 'penulis' | 'editor';
    original_filename: string;
    note: string | null;
    admin_status: 'pending' | 'approved' | 'rejected';
    admin_note: string | null;
    uploader: { id: number; name: string };
};

type ManuscriptDetail = {
    id: number;
    title: string;
    authors: string[];
    co_authors: { id: number; name: string; has_approved: boolean }[];
    status: string;
    editor_fee: string | null;
    editor_source: 'admin' | 'pool' | 'author' | 'project_owner' | null;
    editor_requested_fee: string | null;
    editor_admin_fee: number | null;
    // Hanya dikirim ke admin: penulis memilih editor langsung saat memesan.
    author_chosen_editor?: {
        id: number;
        name: string | null;
        requested_fee: number;
    } | null;
    editor_deadline: string | null;
    editor_assignment_note: string | null;
    user: { id: number; name: string };
    editor: { id: number; name: string } | null;
    revisions: Revision[];
    book: { id: number } | null;
    book_chapter: {
        id: number;
        book: { id: number; is_chapter_offering: boolean };
    } | null;
};

type EditorItem = {
    user_id: number;
    name: string;
    fee: string;
};

const statusLabels: Record<string, string> = {
    submitted: 'Menunggu Review Admin (Naskah Penulis)',
    revision_requested: 'Perlu Revisi dari Penulis',
    pending_editor_assignment: 'Menunggu Penugasan Editor',
    in_editing: 'Sedang Diedit Editor',
    pending_admin_review_editor: 'Menunggu Review Admin (Hasil Editor)',
    editor_revision_requested: 'Perlu Revisi dari Editor',
    pending_penulis_review: 'Menunggu Review Akhir Penulis',
    completed: 'Selesai',
};

const editorSourceLabels: Record<string, string> = {
    admin: 'Ditunjuk admin',
    pool: 'Diambil dari pool',
    author: 'Dipilih langsung oleh penulis',
    project_owner: 'Pemilik proyek Book Chapter',
};

const rupiahFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
});

function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

export default function ManuscriptDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const isAdmin = hasAnyRole(user, ['admin']);

    const [manuscript, setManuscript] = useState<ManuscriptDetail | null>(
        null
    );
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const [revisionFile, setRevisionFile] = useState<File | null>(null);
    const [revisionNote, setRevisionNote] = useState<string>('');
    const [isUploading, setIsUploading] = useState<boolean>(false);

    const [reviewNote, setReviewNote] = useState<string>('');
    const [approveFee, setApproveFee] = useState<string>('');
    const [isReviewing, setIsReviewing] = useState<boolean>(false);

    const [editors, setEditors] = useState<EditorItem[]>([]);
    const [selectedEditorId, setSelectedEditorId] = useState<string>('');
    const [assignFee, setAssignFee] = useState<string>('');
    const [assignDeadline, setAssignDeadline] = useState<string>('');
    const [assignNote, setAssignNote] = useState<string>('');
    const [isAssigning, setIsAssigning] = useState<boolean>(false);

    const [showPublishForm, setShowPublishForm] = useState<boolean>(false);
    const [bookCategories, setBookCategories] = useState<Category[]>([]);
    const [fieldCategories, setFieldCategories] = useState<Category[]>([]);
    const [publishForm, setPublishForm] = useState({
        isbn: '',
        front_cover: '',
        back_cover: '',
        description: '',
        book_category_id: '',
        field_category_id: '',
        price: '',
        discount: '0',
    });
    const [isPublishing, setIsPublishing] = useState<boolean>(false);

    function load() {
        manuscriptApi
            .show(id ?? '')
            .then((response) => setManuscript(response.data))
            .finally(() => setIsLoading(false));
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (isAdmin && manuscript?.status === 'pending_editor_assignment') {
            editorApi.directory().then((response) => setEditors(response.data));
        }
    }, [isAdmin, manuscript?.status]);

    useEffect(() => {
        if (showPublishForm) {
            Promise.all([
                adminApi.listBookCategoriesAdmin(),
                adminApi.listFieldCategoriesAdmin(),
            ]).then(([bookCategoryRes, fieldCategoryRes]) => {
                setBookCategories(bookCategoryRes.data);
                setFieldCategories(fieldCategoryRes.data);
            });
        }
    }, [showPublishForm]);

    if (isLoading) {
        return <p className="text-oxford-navy-900">Memuat...</p>;
    }

    if (!manuscript) {
        return <p className="text-oxford-navy-900">Naskah tidak ditemukan.</p>;
    }

    const isCoAuthor = manuscript.co_authors.some((a) => a.id === user?.id);
    const myCoAuthorEntry = manuscript.co_authors.find(
        (a) => a.id === user?.id
    );
    const isAssignedEditor = manuscript.editor?.id === user?.id;
    const latestRevision = manuscript.revisions[manuscript.revisions.length - 1];

    async function handleDownload(revision: Revision) {
        try {
            const blob = await manuscriptApi.downloadRevision(
                manuscript!.id,
                revision.id
            );
            downloadFile(blob, revision.original_filename);
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Gagal mengunduh file.'
            );
        }
    }

    async function handleUploadRevision() {
        if (!revisionFile) {
            setStatusMessage('Pilih file terlebih dahulu.');
            return;
        }

        setIsUploading(true);
        setStatusMessage('');

        const formData = new FormData();
        formData.append('file', revisionFile);
        if (revisionNote) formData.append('note', revisionNote);

        try {
            await manuscriptApi.addRevision(manuscript!.id, formData);
            setRevisionFile(null);
            setRevisionNote('');
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsUploading(false);
        }
    }

    async function handleAdminReview(decision: 'approve' | 'reject') {
        setIsReviewing(true);
        setStatusMessage('');

        try {
            await adminApi.reviewManuscriptRevision(
                manuscript!.id,
                latestRevision.id,
                {
                    decision,
                    note: reviewNote || undefined,
                    fee:
                        decision === 'approve' && needsAdminFee
                            ? approveFee
                            : undefined,
                }
            );
            setReviewNote('');
            setApproveFee('');
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsReviewing(false);
        }
    }

    async function handleFinalReview(decision: 'approve' | 'revise') {
        setIsReviewing(true);
        setStatusMessage('');

        try {
            await manuscriptApi.finalReview(manuscript!.id, {
                decision,
                note: reviewNote || undefined,
            });
            setReviewNote('');
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsReviewing(false);
        }
    }

    async function handleAssignEditor() {
        setIsAssigning(true);
        setStatusMessage('');

        try {
            await adminApi.assignManuscriptEditor(manuscript!.id, {
                editor_id: Number(selectedEditorId),
                fee: assignFee,
                deadline: assignDeadline || undefined,
                note: assignNote || undefined,
            });
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsAssigning(false);
        }
    }

    async function handleOpenPool() {
        setIsAssigning(true);
        setStatusMessage('');

        try {
            await adminApi.openManuscriptPool(manuscript!.id, {
                fee: assignFee,
                deadline: assignDeadline || undefined,
                note: assignNote || undefined,
            });
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsAssigning(false);
        }
    }

    const canPenulisUpload =
        isCoAuthor &&
        ['submitted', 'revision_requested'].includes(manuscript.status);
    const canEditorUpload =
        isAssignedEditor &&
        ['in_editing', 'editor_revision_requested'].includes(
            manuscript.status
        );
    const canAdminReview =
        isAdmin && latestRevision && latestRevision.admin_status === 'pending';

    // Penulis memilih editor langsung → saat approve naskah penulis, admin
    // wajib mengisi fee. Total fee editor = fee permintaan editor + fee admin.
    const chosenEditor = manuscript.author_chosen_editor ?? null;
    const needsAdminFee =
        Boolean(canAdminReview) &&
        latestRevision?.role === 'penulis' &&
        chosenEditor !== null;
    const approveFeeAmount = Number(approveFee);
    const isApproveFeeValid =
        approveFee.trim() !== '' &&
        Number.isFinite(approveFeeAmount) &&
        approveFeeAmount >= 0;
    const canAdminAssign =
        isAdmin && manuscript.status === 'pending_editor_assignment';
    const canPenulisFinalReview =
        isCoAuthor &&
        manuscript.status === 'pending_penulis_review' &&
        !myCoAuthorEntry?.has_approved;
    const isWaitingForOtherAuthors =
        isCoAuthor &&
        manuscript.status === 'pending_penulis_review' &&
        myCoAuthorEntry?.has_approved;
    const canPublishAsBook =
        isAdmin &&
        manuscript.status === 'completed' &&
        !manuscript.book &&
        !manuscript.book_chapter;

    async function handlePublish() {
        setIsPublishing(true);
        setStatusMessage('');

        try {
            await adminApi.publishFromManuscript(manuscript!.id, {
                isbn: publishForm.isbn || undefined,
                front_cover: publishForm.front_cover || undefined,
                back_cover: publishForm.back_cover || undefined,
                description: publishForm.description || undefined,
                book_category_id: publishForm.book_category_id || undefined,
                field_category_id: publishForm.field_category_id || undefined,
                price: publishForm.price,
                discount: Number(publishForm.discount) || 0,
            });
            setShowPublishForm(false);
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsPublishing(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    {manuscript.title}
                </h5>
                <p className="text-oxford-navy-900/70 text-sm">
                    Penulis: {manuscript.authors.join(', ')}
                </p>
                <p className="text-oxford-navy-900/70 text-sm">
                    Diajukan oleh: {manuscript.user.name}
                </p>
                <p className="text-forest-moss-700 font-semibold">
                    Status: {statusLabels[manuscript.status] ?? manuscript.status}
                </p>
                {manuscript.editor && (
                    <div className="text-oxford-navy-900/70 text-sm">
                        <p>Editor: {manuscript.editor.name}</p>
                        {manuscript.editor_source && (
                            <p>
                                Sumber:{' '}
                                {editorSourceLabels[manuscript.editor_source]}
                            </p>
                        )}
                        {manuscript.editor_fee !== null && (
                            <p>
                                Fee editor:{' '}
                                {rupiahFormatter.format(
                                    Number(manuscript.editor_fee)
                                )}
                                {manuscript.editor_source === 'author' &&
                                    manuscript.editor_requested_fee !== null && (
                                        <>
                                            {' '}
                                            (fee permintaan editor{' '}
                                            {rupiahFormatter.format(
                                                Number(
                                                    manuscript.editor_requested_fee
                                                )
                                            )}{' '}
                                            + fee dari admin{' '}
                                            {rupiahFormatter.format(
                                                manuscript.editor_admin_fee ??
                                                    0
                                            )}
                                            )
                                        </>
                                    )}
                            </p>
                        )}
                        {manuscript.editor_deadline && (
                            <p>Deadline: {manuscript.editor_deadline}</p>
                        )}
                        {manuscript.editor_assignment_note && (
                            <p>Catatan: {manuscript.editor_assignment_note}</p>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Daftar Penulis
                </h5>
                <ul className="flex flex-col gap-1">
                    {manuscript.co_authors.map((author, index) => (
                        <li
                            key={author.id}
                            className="flex flex-row items-center justify-between text-sm bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded px-3 py-2"
                        >
                            <span className="text-oxford-navy-900/80">
                                {index + 1}. {author.name}
                            </span>
                            <span
                                className={
                                    author.has_approved
                                        ? 'text-forest-moss-700'
                                        : 'text-oxford-navy-900/55'
                                }
                            >
                                {author.has_approved
                                    ? 'Sudah ACC'
                                    : 'Belum ACC'}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                    Riwayat Revisi
                </h5>
                <div className="flex flex-col gap-3">
                    {manuscript.revisions.map((revision) => (
                        <div
                            key={revision.id}
                            className="flex flex-col gap-1 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4"
                        >
                            <div className="flex flex-row items-center justify-between">
                                <p className="text-oxford-navy-900 font-semibold">
                                    Revisi {revision.revision_number} —{' '}
                                    {revision.role === 'penulis'
                                        ? 'Penulis'
                                        : 'Editor'}{' '}
                                    ({revision.uploader.name})
                                </p>
                                <button
                                    onClick={() => handleDownload(revision)}
                                    className="text-forest-moss-700 text-sm hover:text-forest-moss-800"
                                >
                                    Download
                                </button>
                            </div>
                            <p className="text-oxford-navy-900/65 text-sm">
                                {revision.original_filename}
                            </p>
                            {revision.note && (
                                <p className="text-oxford-navy-900/70 text-sm">
                                    Catatan pengunggah: {revision.note}
                                </p>
                            )}
                            <p className="text-sm">
                                Status admin:{' '}
                                <span
                                    className={
                                        revision.admin_status === 'approved'
                                            ? 'text-forest-moss-700'
                                            : revision.admin_status ===
                                                'rejected'
                                              ? 'text-red-600'
                                              : 'text-oxford-navy-900/65'
                                    }
                                >
                                    {revision.admin_status}
                                </span>
                            </p>
                            {revision.admin_note && (
                                <p className="text-oxford-navy-900/70 text-sm">
                                    Catatan admin: {revision.admin_note}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {statusMessage && (
                <p className="text-red-600 text-sm">{statusMessage}</p>
            )}

            {(canPenulisUpload || canEditorUpload) && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Unggah Revisi
                    </h5>
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx,.odt"
                        onChange={(e) =>
                            setRevisionFile(e.target.files?.[0] ?? null)
                        }
                        className="text-oxford-navy-900 text-sm"
                    />
                    <Input
                        label="Catatan (opsional)"
                        value={revisionNote}
                        onChange={(e) => setRevisionNote(e.target.value)}
                    />
                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={handleUploadRevision}
                        disabled={isUploading}
                    >
                        {isUploading ? 'Mengunggah...' : 'Unggah Revisi'}
                    </Button>
                </div>
            )}

            {canAdminReview && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Review Revisi Terbaru (Admin)
                    </h5>

                    {needsAdminFee && chosenEditor && (
                        <div className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
                            <p className="text-oxford-navy-900 text-sm">
                                Penulis memilih editor{' '}
                                <strong>{chosenEditor.name}</strong> secara
                                langsung. Fee permintaan editor{' '}
                                {rupiahFormatter.format(
                                    chosenEditor.requested_fee
                                )}{' '}
                                sudah dibayar penulis di pesanan. Fee dari admin
                                tetap wajib diisi saat approve.
                            </p>
                            <Input
                                label="Fee dari admin untuk editor (Rp)"
                                type="number"
                                min="0"
                                value={approveFee}
                                onChange={(e) => setApproveFee(e.target.value)}
                                required
                            />
                            <p className="text-oxford-navy-900/70 text-sm">
                                Total fee editor ={' '}
                                {rupiahFormatter.format(
                                    chosenEditor.requested_fee
                                )}{' '}
                                +{' '}
                                {rupiahFormatter.format(
                                    isApproveFeeValid ? approveFeeAmount : 0
                                )}{' '}
                                ={' '}
                                <strong className="text-forest-moss-700">
                                    {rupiahFormatter.format(
                                        chosenEditor.requested_fee +
                                            (isApproveFeeValid
                                                ? approveFeeAmount
                                                : 0)
                                    )}
                                </strong>
                            </p>
                        </div>
                    )}

                    <Input
                        label="Catatan (wajib kalau reject)"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                    />
                    <div className="flex flex-row gap-2">
                        <Button
                            variant="primary"
                            onClick={() => handleAdminReview('approve')}
                            disabled={
                                isReviewing ||
                                (needsAdminFee && !isApproveFeeValid)
                            }
                        >
                            Approve
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={() => handleAdminReview('reject')}
                            disabled={isReviewing}
                        >
                            Reject
                        </Button>
                    </div>
                </div>
            )}

            {canAdminAssign && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Tugaskan Editor (Admin)
                    </h5>

                    <Select
                        name="editor"
                        label="Pilih Editor"
                        option_data={editors.map((editor) => ({
                            value: String(editor.user_id),
                            label: `${editor.name} (Rp ${editor.fee})`,
                        }))}
                        value={selectedEditorId}
                        onChange={(e) => setSelectedEditorId(e.target.value)}
                    />
                    <Input
                        label="Fee / Harga Pengerjaan Naskah (Rp)"
                        value={assignFee}
                        onChange={(e) => setAssignFee(e.target.value)}
                        required
                    />
                    <small className="text-oxford-navy-900/65 -mt-2">
                        Ditugaskan langsung: ini fee editor. Dibuka ke pool:
                        ini harga pengerjaan yang diterima editor yang
                        mengambil naskah.
                    </small>
                    <Input
                        label="Deadline"
                        type="date"
                        value={assignDeadline}
                        onChange={(e) => setAssignDeadline(e.target.value)}
                    />
                    <Input
                        label="Catatan untuk Editor"
                        value={assignNote}
                        onChange={(e) => setAssignNote(e.target.value)}
                    />

                    <div className="flex flex-row gap-2">
                        <Button
                            variant="primary"
                            onClick={handleAssignEditor}
                            disabled={isAssigning || !selectedEditorId}
                        >
                            Tugaskan Editor Ini
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={handleOpenPool}
                            disabled={isAssigning}
                        >
                            Buka ke Pool Editor
                        </Button>
                    </div>
                </div>
            )}

            {isAdmin && manuscript.book_chapter?.book.is_chapter_offering && (
                <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <p className="text-forest-moss-700 text-sm">
                        Naskah ini mengisi salah satu slot bab di proyek Book
                        Chapter.
                    </p>
                    <Link
                        to={`/admin/book-chapter-projects/${manuscript.book_chapter.book.id}`}
                        className="text-forest-moss-700 text-sm hover:text-forest-moss-800 self-start"
                    >
                        Lihat di Kelola Proyek Book Chapter →
                    </Link>
                </div>
            )}

            {isAdmin &&
                (manuscript.book ||
                    (manuscript.book_chapter &&
                        !manuscript.book_chapter.book.is_chapter_offering)) && (
                    <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                        <p className="text-forest-moss-700 text-sm">
                            Naskah ini sudah diterbitkan sebagai buku.
                        </p>
                        <Link
                            to={`/admin/books`}
                            className="text-forest-moss-700 text-sm hover:text-forest-moss-800 self-start"
                        >
                            Lihat di Kelola Buku →
                        </Link>
                    </div>
                )}

            {canPublishAsBook && !showPublishForm && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <Button
                        variant="primary"
                        className="self-start"
                        onClick={() => setShowPublishForm(true)}
                    >
                        Terbitkan sebagai Buku
                    </Button>
                </div>
            )}

            {canPublishAsBook && showPublishForm && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Terbitkan sebagai Buku
                    </h5>
                    <p className="text-oxford-navy-900/65 text-sm">
                        Judul &amp; penulis akan otomatis diambil dari
                        naskah ini.
                    </p>

                    <Input
                        label="ISBN"
                        value={publishForm.isbn}
                        onChange={(e) =>
                            setPublishForm({
                                ...publishForm,
                                isbn: e.target.value,
                            })
                        }
                    />
                    <ImageInput
                        label="Sampul Depan"
                        value={publishForm.front_cover}
                        onChange={(value) =>
                            setPublishForm({
                                ...publishForm,
                                front_cover: value,
                            })
                        }
                        folder="covers"
                    />
                    <ImageInput
                        label="Sampul Belakang"
                        value={publishForm.back_cover}
                        onChange={(value) =>
                            setPublishForm({
                                ...publishForm,
                                back_cover: value,
                            })
                        }
                        folder="covers"
                    />
                    <Input
                        label="Deskripsi"
                        value={publishForm.description}
                        onChange={(e) =>
                            setPublishForm({
                                ...publishForm,
                                description: e.target.value,
                            })
                        }
                    />
                    <Select
                        name="book_category_id"
                        label="Kategori Buku"
                        option_data={[
                            { value: '', label: 'Tanpa Kategori' },
                            ...bookCategories.map((category) => ({
                                value: String(category.id),
                                label: category.name,
                            })),
                        ]}
                        value={publishForm.book_category_id}
                        onChange={(e) =>
                            setPublishForm({
                                ...publishForm,
                                book_category_id: e.target.value,
                            })
                        }
                    />
                    <Select
                        name="field_category_id"
                        label="Kategori Keilmuan"
                        option_data={[
                            { value: '', label: 'Tanpa Kategori' },
                            ...fieldCategories.map((category) => ({
                                value: String(category.id),
                                label: category.name,
                            })),
                        ]}
                        value={publishForm.field_category_id}
                        onChange={(e) =>
                            setPublishForm({
                                ...publishForm,
                                field_category_id: e.target.value,
                            })
                        }
                    />
                    <Input
                        label="Harga"
                        value={publishForm.price}
                        onChange={(e) =>
                            setPublishForm({
                                ...publishForm,
                                price: e.target.value,
                            })
                        }
                        required
                    />
                    <Input
                        label="Diskon (%)"
                        value={publishForm.discount}
                        onChange={(e) =>
                            setPublishForm({
                                ...publishForm,
                                discount: e.target.value,
                            })
                        }
                    />

                    <div className="flex flex-row gap-2">
                        <Button
                            variant="primary"
                            onClick={handlePublish}
                            disabled={isPublishing || !publishForm.price}
                        >
                            {isPublishing ? 'Menerbitkan...' : 'Terbitkan'}
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={() => setShowPublishForm(false)}
                        >
                            Batal
                        </Button>
                    </div>
                </div>
            )}

            {canPenulisFinalReview && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Review Akhir Naskah
                    </h5>
                    <Input
                        label="Catatan (kalau minta revisi)"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                    />
                    <div className="flex flex-row gap-2">
                        <Button
                            variant="primary"
                            onClick={() => handleFinalReview('approve')}
                            disabled={isReviewing}
                        >
                            Setujui (Selesai)
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={() => handleFinalReview('revise')}
                            disabled={isReviewing}
                        >
                            Minta Revisi Lagi
                        </Button>
                    </div>
                </div>
            )}

            {isWaitingForOtherAuthors && (
                <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Review Akhir Naskah
                    </h5>
                    <p className="text-forest-moss-700 text-sm">
                        Anda sudah menyetujui. Menunggu penulis lain
                        menyetujui sebelum naskah berstatus selesai.
                    </p>
                </div>
            )}
        </div>
    );
}
