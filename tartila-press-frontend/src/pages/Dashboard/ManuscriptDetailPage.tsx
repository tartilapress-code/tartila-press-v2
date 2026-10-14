import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Input from '@/components/Input/Input';
import ImageInput from '@/components/Input/ImageInput';
import Select from '@/components/Select/Select';
import Button from '@/components/Button/Button';
import { useAuth } from '@/context/useAuth';
import { hasAnyRole } from '@/context/AuthContext';
import { ApiError } from '@/lib/http';
import IsbnStartButton from '@/components/isbn/IsbnStartButton';
import SignaturePad from '@/components/isbn/SignaturePad';
import MouAgreeCheckbox from '@/components/mou/MouAgreeCheckbox';
import MouDocument from '@/components/mou/MouDocument';
import * as mouApi from '@/data/mou/mouApi';
import ManuscriptPublicationCard from '@/components/publication/ManuscriptPublicationCard';
import AutoLayoutOption, {
    type AutoLayoutValue,
} from '@/components/manuscriptTemplate/AutoLayoutOption';
import CompilationChaptersPanel from '@/components/bookChapter/CompilationChaptersPanel';
import CoverChoiceCard from '@/components/cover/CoverChoiceCard';
import DifficultyBadge from '@/components/manuscript/DifficultyBadge';
import FieldCategoryPicker from '@/components/manuscript/FieldCategoryPicker';
import {
    DIFFICULTY_OPTIONS,
    isDifficulty,
    type ManuscriptDifficulty,
} from '@/lib/manuscriptDifficulty';
import { CHAPTER_STATUS_LABELS } from '@/lib/manuscriptStatus';
import * as manuscriptApi from '@/data/manuscript/manuscriptApi';
import * as adminApi from '@/data/admin/adminApi';
import * as editorApi from '@/data/editor/editorApi';

type Category = { id: number; name: string };

type Revision = {
    id: number;
    revision_number: number;
    role: 'penulis' | 'coauthor' | 'editor' | 'layout' | 'compilation';
    original_filename: string;
    note: string | null;
    admin_status: 'pending' | 'approved' | 'rejected';
    admin_note: string | null;
    // Catatan penulis saat meminta revisi lagi (terpisah dari catatan admin).
    author_note?: string | null;
    uploader: { id: number; name: string };
};

type ManuscriptDetail = {
    id: number;
    title: string;
    authors: string[];
    co_authors: {
        id: number;
        name: string;
        has_approved: boolean;
        // Co-author layanan paket (penulis terakhir, bukan penulis asli).
        is_coauthor?: boolean;
    }[];
    status: string;
    wants_coauthor?: boolean;
    // Template naskah pilihan penulis saat mengirim naskah.
    manuscript_template_id?: number | null;
    coauthor: { id: number; name: string } | null;
    coauthor_fee: string | null;
    coauthor_source: 'admin' | 'pool' | 'author' | null;
    coauthor_requested_fee: string | null;
    coauthor_admin_fee: number | null;
    coauthor_deadline: string | null;
    coauthor_assignment_note: string | null;
    coauthor_open_for_claim: boolean;
    // Hanya dikirim ke admin: penulis memilih co-author langsung saat memesan.
    author_chosen_coauthor?: {
        id: number;
        name: string | null;
        requested_fee: number;
    } | null;
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
    // Diisi admin saat menerima naskah penulis.
    difficulty: ManuscriptDifficulty | null;
    // Kriteria editor pool (id Kategori Keilmuan); null = umum.
    pool_field_category_ids: number[] | null;
    open_for_claim: boolean;
    user: { id: number; name: string };
    editor: { id: number; name: string } | null;
    revisions: Revision[];
    book: { id: number } | null;
    isbn_application: {
        id: number;
        applicant_id: number;
        status: 'draft' | 'signed' | 'processed';
    } | null;
    book_chapter: {
        id: number;
        book: { id: number; is_chapter_offering: boolean };
    } | null;
    // Naskah gabungan semua bab proyek Book Chapter.
    compiled_book: { id: number; title: string } | null;
    // MOU distribusi buku (naskah selesai / naskah gabungan di review akhir).
    mou: mouApi.Mou | null;
    // Bab Book Chapter: catatan revisi dari editor/admin naskah gabungan.
    chapter_revision_requests?: {
        id: number;
        note: string;
        created_at: string;
        resolved_at: string | null;
        requester: { id: number; name: string } | null;
    }[];
};

type EditorItem = {
    user_id: number;
    name: string;
    fee: string;
    is_promoted?: boolean;
    under_monitoring?: boolean;
};

type CoauthorItem = EditorItem & { bio?: string | null };

const statusLabels: Record<string, string> = {
    submitted: 'Menunggu Review Admin (Naskah Penulis)',
    revision_requested: 'Perlu Revisi dari Penulis',
    pending_coauthor_assignment: 'Menunggu Penugasan Co-author',
    in_coauthoring: 'Sedang Disusun Co-author',
    pending_admin_review_coauthor: 'Menunggu Review Admin (Hasil Co-author)',
    coauthor_revision_requested: 'Perlu Revisi dari Co-author',
    pending_author_review_coauthor:
        'Menunggu Persetujuan Penulis (Susunan Co-author)',
    pending_editor_assignment: 'Menunggu Penugasan Editor',
    in_editing: 'Sedang Diedit Editor',
    pending_admin_review_editor: 'Menunggu Review Admin (Hasil Editor)',
    editor_revision_requested: 'Perlu Revisi dari Editor',
    pending_penulis_review: 'Menunggu Review Akhir Penulis',
    completed: 'Selesai',
    ...CHAPTER_STATUS_LABELS,
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

    const [manuscript, setManuscript] = useState<ManuscriptDetail | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [statusMessage, setStatusMessage] = useState<string>('');

    const [revisionFile, setRevisionFile] = useState<File | null>(null);
    const [revisionNote, setRevisionNote] = useState<string>('');
    const [isUploading, setIsUploading] = useState<boolean>(false);

    const [reviewNote, setReviewNote] = useState<string>('');
    const [mouAgreed, setMouAgreed] = useState<boolean>(false);
    const [approveFee, setApproveFee] = useState<string>('');
    const [isReviewing, setIsReviewing] = useState<boolean>(false);
    // Tingkat kesulitan: '' = ikuti nilai naskah saat ini.
    const [approveDifficulty, setApproveDifficulty] = useState<
        ManuscriptDifficulty | ''
    >('');
    const [settingsDifficulty, setSettingsDifficulty] = useState<
        ManuscriptDifficulty | ''
    >('');
    const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
    const [autoLayout, setAutoLayout] = useState<AutoLayoutValue>({
        enabled: true,
        templateId: null,
    });

    const [editors, setEditors] = useState<EditorItem[]>([]);
    const [selectedEditorId, setSelectedEditorId] = useState<string>('');
    const [assignFee, setAssignFee] = useState<string>('');
    const [assignDeadline, setAssignDeadline] = useState<string>('');
    const [assignNote, setAssignNote] = useState<string>('');
    const [assignDifficulty, setAssignDifficulty] = useState<
        ManuscriptDifficulty | ''
    >('');
    // Kriteria editor saat dibuka ke pool; null = belum diubah.
    const [poolFields, setPoolFields] = useState<number[] | null>(null);
    const [isAssigning, setIsAssigning] = useState<boolean>(false);

    // Layanan co-author (admin): daftar co-author + fee dari admin untuk pilihan penulis.
    const [coauthors, setCoauthors] = useState<CoauthorItem[]>([]);
    const [selectedCoauthorId, setSelectedCoauthorId] = useState<string>('');
    const [approveCoauthorFee, setApproveCoauthorFee] = useState<string>('');

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
            adminApi
                .listFieldCategoriesAdmin()
                .then((response) => setFieldCategories(response.data));
        }

        if (isAdmin && manuscript?.status === 'pending_coauthor_assignment') {
            editorApi
                .coauthorDirectory()
                .then((response) => setCoauthors(response.data));
            adminApi
                .listFieldCategoriesAdmin()
                .then((response) => setFieldCategories(response.data));
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

    // "Penulis" = penulis asli naskah; co-author layanan paket punya tahapnya sendiri.
    const isCoAuthor = manuscript.co_authors.some(
        (a) => a.id === user?.id && !a.is_coauthor
    );
    const myCoAuthorEntry = manuscript.co_authors.find(
        (a) => a.id === user?.id && !a.is_coauthor
    );
    const isServiceCoauthor = manuscript.coauthor?.id === user?.id;
    const isAssignedEditor = manuscript.editor?.id === user?.id;
    const latestRevision =
        manuscript.revisions[manuscript.revisions.length - 1];
    // Book Chapter: bab digabung menjadi satu naskah buku untuk editor.
    const isChapter = Boolean(
        manuscript.book_chapter?.book.is_chapter_offering
    );
    const isCompilation = manuscript.compiled_book !== null;
    const openChapterNotes = (
        manuscript.chapter_revision_requests ?? []
    ).filter((item) => item.resolved_at === null);

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
                    coauthor_fee:
                        decision === 'approve' && needsCoauthorFee
                            ? approveCoauthorFee
                            : undefined,
                    auto_layout:
                        decision === 'approve' &&
                        canAutoLayout &&
                        autoLayout.enabled,
                    manuscript_template_id:
                        decision === 'approve' && canAutoLayout
                            ? autoLayout.templateId
                            : undefined,
                    difficulty:
                        decision === 'approve' &&
                        needsDifficulty &&
                        effectiveApproveDifficulty
                            ? effectiveApproveDifficulty
                            : undefined,
                }
            );
            setReviewNote('');
            setApproveFee('');
            setApproveCoauthorFee('');
            setApproveDifficulty('');
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

    async function handleFinalReview(
        decision: 'approve' | 'revise',
        signature?: string
    ) {
        setIsReviewing(true);
        setStatusMessage('');

        try {
            await manuscriptApi.finalReview(manuscript!.id, {
                decision,
                note: reviewNote || undefined,
                ...(signature ? { mou_agreed: true, signature } : {}),
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
                difficulty: effectiveAssignDifficulty || undefined,
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

    async function handleAssignCoauthor() {
        setIsAssigning(true);
        setStatusMessage('');

        try {
            await adminApi.assignManuscriptCoauthor(manuscript!.id, {
                coauthor_id: Number(selectedCoauthorId),
                fee: assignFee,
                deadline: assignDeadline || undefined,
                note: assignNote || undefined,
            });
            setAssignFee('');
            setAssignDeadline('');
            setAssignNote('');
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

    async function handleOpenCoauthorPool() {
        setIsAssigning(true);
        setStatusMessage('');

        try {
            await adminApi.openCoauthorPool(manuscript!.id, {
                fee: assignFee,
                deadline: assignDeadline || undefined,
                note: assignNote || undefined,
                difficulty: effectiveAssignDifficulty || undefined,
                pool_field_category_ids: effectivePoolFields,
            });
            setPoolFields(null);
            setAssignFee('');
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

    async function handleCoauthorReview(decision: 'approve' | 'revise') {
        setIsReviewing(true);
        setStatusMessage('');

        try {
            await manuscriptApi.coauthorReview(manuscript!.id, {
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

    async function handleOpenPool() {
        setIsAssigning(true);
        setStatusMessage('');

        try {
            await adminApi.openManuscriptPool(manuscript!.id, {
                fee: assignFee,
                deadline: assignDeadline || undefined,
                note: assignNote || undefined,
                difficulty: effectiveAssignDifficulty || undefined,
                pool_field_category_ids: effectivePoolFields,
            });
            setPoolFields(null);
            setAssignDifficulty('');
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

    async function handleSaveDifficulty() {
        if (!settingsDifficulty) return;

        setIsSavingSettings(true);
        setStatusMessage('');

        try {
            await adminApi.updateManuscriptPoolSettings(manuscript!.id, {
                difficulty: settingsDifficulty,
            });
            setSettingsDifficulty('');
            load();
        } catch (error) {
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : 'Terjadi kesalahan. Silakan coba lagi.'
            );
        } finally {
            setIsSavingSettings(false);
        }
    }

    const canPenulisUpload =
        isCoAuthor &&
        ['submitted', 'revision_requested'].includes(manuscript.status);
    const canEditorUpload =
        isAssignedEditor &&
        ['in_editing', 'editor_revision_requested'].includes(manuscript.status);
    const canCoauthorUpload =
        isServiceCoauthor &&
        ['in_coauthoring', 'coauthor_revision_requested'].includes(
            manuscript.status
        );
    const canAdminReview =
        isAdmin && latestRevision && latestRevision.admin_status === 'pending';
    // Auto layout hanya untuk naskah Word milik penulis.
    const canAutoLayout =
        Boolean(canAdminReview) &&
        !isChapter &&
        !manuscript.wants_coauthor &&
        latestRevision?.role === 'penulis' &&
        latestRevision.original_filename.toLowerCase().endsWith('.docx');

    // Penulis memilih editor langsung → saat approve naskah penulis, admin
    // wajib mengisi fee. Total fee editor = fee permintaan editor + fee admin.
    const chosenEditor = manuscript.author_chosen_editor ?? null;
    const needsAdminFee =
        Boolean(canAdminReview) &&
        latestRevision?.role === 'penulis' &&
        chosenEditor !== null;
    // Penulis memilih co-author langsung: admin juga wajib mengisi fee co-author.
    const chosenCoauthor = manuscript.author_chosen_coauthor ?? null;
    const needsCoauthorFee =
        Boolean(canAdminReview) &&
        latestRevision?.role === 'penulis' &&
        Boolean(manuscript.wants_coauthor) &&
        chosenCoauthor !== null;
    const approveCoauthorFeeAmount = Number(approveCoauthorFee);
    const isApproveCoauthorFeeValid =
        approveCoauthorFee.trim() !== '' &&
        Number.isFinite(approveCoauthorFeeAmount) &&
        approveCoauthorFeeAmount >= 0;
    const canAdminAssignCoauthor =
        isAdmin && manuscript.status === 'pending_coauthor_assignment';
    const canAuthorCoauthorReview =
        isCoAuthor && manuscript.status === 'pending_author_review_coauthor';
    const approveFeeAmount = Number(approveFee);
    const isApproveFeeValid =
        approveFee.trim() !== '' &&
        Number.isFinite(approveFeeAmount) &&
        approveFeeAmount >= 0;
    const canAdminAssign =
        isAdmin && manuscript.status === 'pending_editor_assignment';
    // Tingkat kesulitan wajib diisi saat menerima naskah penulis (bukan bab
    // Book Chapter: kesulitan diisi pada naskah gabungannya).
    const needsDifficulty =
        Boolean(canAdminReview) &&
        latestRevision?.role === 'penulis' &&
        !isChapter;
    const effectiveApproveDifficulty =
        approveDifficulty || manuscript.difficulty || '';
    const effectiveAssignDifficulty =
        assignDifficulty || manuscript.difficulty || '';
    const effectivePoolFields =
        poolFields ?? manuscript.pool_field_category_ids ?? [];
    const canPenulisFinalReview =
        isCoAuthor &&
        manuscript.status === 'pending_penulis_review' &&
        !myCoAuthorEntry?.has_approved;
    // Book Chapter: menyetujui naskah akhir = menyetujui & menandatangani MOU.
    const myMou = manuscript.mou?.me ?? null;
    const approvalSignsMou =
        myMou !== null &&
        !myMou.signed &&
        myMou.sign_via === 'final_review' &&
        myMou.blocked_reason === null;
    const approvalBlockedByMou =
        myMou !== null &&
        !myMou.signed &&
        myMou.sign_via === 'final_review' &&
        myMou.blocked_reason !== null;
    const isWaitingForOtherAuthors =
        isCoAuthor &&
        manuscript.status === 'pending_penulis_review' &&
        myCoAuthorEntry?.has_approved;
    // Penulis pertama (urutan pertama co-author) mengajukan ISBN setelah
    // naskah selesai disetujui; paket Book Chapter lewat editor proyek.
    const isbnApplication =
        manuscript.isbn_application?.applicant_id === user?.id
            ? manuscript.isbn_application
            : null;
    const canRequestIsbn =
        manuscript.status === 'completed' &&
        !manuscript.book &&
        !manuscript.book_chapter &&
        !isCompilation &&
        !manuscript.isbn_application &&
        manuscript.co_authors[0]?.id === user?.id;
    const canPublishAsBook =
        isAdmin &&
        manuscript.status === 'completed' &&
        !manuscript.book &&
        !manuscript.book_chapter &&
        !isCompilation;

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
                    Status:{' '}
                    {statusLabels[manuscript.status] ?? manuscript.status}
                </p>
                {(manuscript.difficulty || manuscript.open_for_claim) && (
                    <div className="flex flex-wrap items-center gap-2">
                        <DifficultyBadge difficulty={manuscript.difficulty} />
                        {manuscript.open_for_claim && (
                            <span className="rounded-full bg-forest-moss-50 px-2.5 py-0.5 text-xs font-medium text-forest-moss-800 ring-1 ring-forest-moss-200">
                                Terbuka di pool editor
                                {(manuscript.pool_field_category_ids ?? [])
                                    .length > 0
                                    ? ' (bidang tertentu)'
                                    : ' (umum)'}
                            </span>
                        )}
                    </div>
                )}
                {isAdmin && !canAdminReview && (
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="w-48">
                            <Select
                                name="difficulty_setting"
                                label="Tingkat Kesulitan (admin)"
                                option_data={[
                                    ...(manuscript.difficulty
                                        ? []
                                        : [
                                              {
                                                  value: '',
                                                  label: 'Belum diisi',
                                              },
                                          ]),
                                    ...DIFFICULTY_OPTIONS,
                                ]}
                                value={
                                    settingsDifficulty ||
                                    manuscript.difficulty ||
                                    ''
                                }
                                onChange={(e) =>
                                    setSettingsDifficulty(
                                        isDifficulty(e.target.value)
                                            ? e.target.value
                                            : ''
                                    )
                                }
                            />
                        </div>
                        {settingsDifficulty &&
                            settingsDifficulty !== manuscript.difficulty && (
                                <Button
                                    variant="primary"
                                    onClick={handleSaveDifficulty}
                                    disabled={isSavingSettings}
                                >
                                    Simpan
                                </Button>
                            )}
                        {manuscript.open_for_claim && (
                            <Link
                                to="/admin/pool-naskah"
                                className="pb-3 text-sm text-forest-moss-700 hover:text-forest-moss-800"
                            >
                                Ubah kriteria editor pool →
                            </Link>
                        )}
                    </div>
                )}
                {manuscript.editor && (
                    <div className="text-oxford-navy-900/70 text-sm">
                        <p>Editor: {manuscript.editor.name}</p>
                        {manuscript.editor_source && (
                            <p>
                                Sumber:{' '}
                                {editorSourceLabels[manuscript.editor_source]}
                            </p>
                        )}
                        {/* Fee editor hanya untuk admin dan editor itu sendiri (server tidak mengirimnya ke penulis). */}
                        {(isAdmin || isAssignedEditor) &&
                            manuscript.editor_fee != null && (
                                <p>
                                    Fee editor:{' '}
                                    {rupiahFormatter.format(
                                        Number(manuscript.editor_fee)
                                    )}
                                    {manuscript.editor_source === 'author' &&
                                        manuscript.editor_requested_fee !==
                                            null && (
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
                        {(isAdmin || isAssignedEditor) &&
                            manuscript.editor_assignment_note && (
                                <p>
                                    Catatan: {manuscript.editor_assignment_note}
                                </p>
                            )}
                    </div>
                )}
                {manuscript.wants_coauthor && (
                    <div className="text-oxford-navy-900/70 text-sm">
                        <p>
                            Co-author:{' '}
                            {manuscript.coauthor?.name ??
                                'belum ditentukan (admin menentukan atau dibuka ke pool co-author)'}
                        </p>
                        {manuscript.coauthor_open_for_claim && (
                            <p className="text-forest-moss-800">
                                Terbuka di pool co-author
                            </p>
                        )}
                        {manuscript.coauthor &&
                            (isAdmin || isServiceCoauthor) &&
                            manuscript.coauthor_fee !== null && (
                                <>
                                    {manuscript.coauthor_source && (
                                        <p>
                                            Sumber:{' '}
                                            {
                                                editorSourceLabels[
                                                    manuscript.coauthor_source
                                                ]
                                            }
                                        </p>
                                    )}
                                    <p>
                                        Fee co-author:{' '}
                                        {rupiahFormatter.format(
                                            Number(manuscript.coauthor_fee)
                                        )}
                                        {manuscript.coauthor_source ===
                                            'author' &&
                                            manuscript.coauthor_requested_fee !==
                                                null && (
                                                <>
                                                    {' '}
                                                    (fee permintaan co-author{' '}
                                                    {rupiahFormatter.format(
                                                        Number(
                                                            manuscript.coauthor_requested_fee
                                                        )
                                                    )}{' '}
                                                    + fee dari admin{' '}
                                                    {rupiahFormatter.format(
                                                        manuscript.coauthor_admin_fee ??
                                                            0
                                                    )}
                                                    )
                                                </>
                                            )}
                                    </p>
                                </>
                            )}
                        {manuscript.coauthor_deadline && (
                            <p>
                                Deadline co-author:{' '}
                                {manuscript.coauthor_deadline}
                            </p>
                        )}
                        {(isAdmin || isServiceCoauthor) &&
                            manuscript.coauthor_assignment_note && (
                                <p>
                                    Catatan co-author:{' '}
                                    {manuscript.coauthor_assignment_note}
                                </p>
                            )}
                    </div>
                )}
            </div>

            {manuscript.mou && !(canPenulisFinalReview && approvalSignsMou) && (
                <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                        <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                            MOU Distribusi Buku
                        </h5>
                        <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${mouApi.STATUS_CLASS[manuscript.mou.status]}`}
                        >
                            {manuscript.mou.status_label}
                        </span>
                    </div>
                    <p className="text-oxford-navy-900/70 text-sm">
                        {
                            manuscript.mou.signatories.filter(
                                (row) => row.signed_at
                            ).length
                        }{' '}
                        dari {manuscript.mou.signatories.length} penulis sudah
                        menandatangani. Buku baru bisa diterbitkan setelah semua
                        penulis menandatangani.
                        {myMou && !myMou.signed && myMou.blocked_reason && (
                            <span className="block text-amber-700">
                                {myMou.blocked_reason}
                            </span>
                        )}
                    </p>
                    {(myMou || isAdmin) && (
                        <Link
                            to={
                                myMou
                                    ? `/dashboard/mou/${manuscript.mou.id}`
                                    : `/admin/mou/${manuscript.mou.id}`
                            }
                            className="self-start bg-oxford-navy-700 hover:bg-oxford-navy-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                        >
                            {myMou &&
                            !myMou.signed &&
                            myMou.sign_via === 'direct'
                                ? 'Tinjau & tanda tangani MOU'
                                : 'Lihat MOU'}
                        </Link>
                    )}
                </div>
            )}

            {/* Cover buku: pilihan dari admin, voting penulis, hasil (admin juga melihat). */}
            {(isCoAuthor || isServiceCoauthor || isAdmin) && (
                <CoverChoiceCard manuscriptId={manuscript.id} />
            )}

            <ManuscriptPublicationCard
                key={`${manuscript.id}-${manuscript.status}`}
                manuscriptId={manuscript.id}
            />

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
                                {author.is_coauthor && (
                                    <span className="ml-2 rounded-full bg-forest-moss-50 px-2 py-0.5 text-xs font-medium text-forest-moss-800 ring-1 ring-forest-moss-200">
                                        Co-author
                                    </span>
                                )}
                            </span>
                            {author.is_coauthor ? (
                                <span className="text-oxford-navy-900/55">
                                    Tidak ikut ACC tinjauan
                                </span>
                            ) : (
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
                            )}
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
                                        : revision.role === 'coauthor'
                                          ? 'Co-author'
                                          : revision.role === 'layout'
                                            ? 'Auto layout'
                                            : revision.role === 'compilation'
                                              ? 'Gabungan semua bab'
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
                            {revision.author_note && (
                                <p className="text-oxford-navy-900/70 text-sm">
                                    Catatan penulis: {revision.author_note}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {isCompilation && (
                <div className="flex flex-col gap-2 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <p className="text-oxford-navy-900 text-sm">
                        Ini naskah <strong>gabungan semua bab</strong> buku Book
                        Chapter{' '}
                        <strong>{manuscript.compiled_book?.title}</strong>,
                        disusun menurut urutan bab. Editor mengerjakan berkas
                        ini; review akhir dilakukan semua penulis bab.
                    </p>
                    {isAdmin && (
                        <Link
                            to={`/admin/book-chapter-projects/${manuscript.compiled_book?.id}`}
                            className="text-forest-moss-700 text-sm hover:text-forest-moss-800 self-start"
                        >
                            Lihat di Kelola Proyek Book Chapter →
                        </Link>
                    )}
                </div>
            )}

            {isCompilation && (isAssignedEditor || isAdmin) && (
                <CompilationChaptersPanel
                    manuscriptId={manuscript.id}
                    isFinished={manuscript.status === 'completed'}
                />
            )}

            {isChapter &&
                ['awaiting_compilation', 'compiled'].includes(
                    manuscript.status
                ) && (
                    <div className="flex flex-col gap-1 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6 text-sm text-oxford-navy-900/80">
                        {manuscript.status === 'awaiting_compilation'
                            ? 'Naskah bab ini sudah disetujui admin. Setelah naskah semua bab terkumpul, admin menggabungkannya menjadi satu buku sesuai urutan bab lalu dikirim ke editor.'
                            : 'Naskah bab ini sudah digabung ke naskah buku dan sedang dikerjakan editor. Kalau editor meminta revisi untuk bab ini, catatannya muncul di halaman ini.'}
                    </div>
                )}

            {isChapter &&
                (manuscript.chapter_revision_requests ?? []).length > 0 && (
                    <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                        <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                            Catatan Revisi Bab dari Editor
                        </h5>
                        {openChapterNotes.length > 0 && isCoAuthor && (
                            <p className="text-amber-800 text-sm">
                                Perbaiki naskah bab Anda sesuai catatan lalu
                                unggah revisi (.docx) di bawah. Revisi diperiksa
                                admin sebelum dipakai editor.
                            </p>
                        )}
                        {(manuscript.chapter_revision_requests ?? []).map(
                            (item) => (
                                <div
                                    key={item.id}
                                    className={`rounded-lg p-4 text-sm ring-1 ${
                                        item.resolved_at
                                            ? 'bg-forest-moss-50 ring-forest-moss-100'
                                            : 'bg-amber-50 ring-amber-200'
                                    }`}
                                >
                                    <p className="whitespace-pre-line text-oxford-navy-900">
                                        {item.note}
                                    </p>
                                    <p className="mt-1 text-xs text-oxford-navy-900/60">
                                        {item.requester?.name ?? 'Editor'} ·{' '}
                                        {new Date(
                                            item.created_at
                                        ).toLocaleDateString('id-ID')}{' '}
                                        ·{' '}
                                        {item.resolved_at
                                            ? 'Sudah direvisi'
                                            : 'Menunggu revisi'}
                                    </p>
                                </div>
                            )
                        )}
                    </div>
                )}

            {statusMessage && (
                <p className="text-red-600 text-sm">{statusMessage}</p>
            )}

            {(canPenulisUpload || canEditorUpload || canCoauthorUpload) && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        {canCoauthorUpload
                            ? 'Unggah Hasil Susunan Co-author'
                            : 'Unggah Revisi'}
                    </h5>
                    <input
                        type="file"
                        accept={
                            isChapter && canPenulisUpload
                                ? '.docx'
                                : '.pdf,.doc,.docx,.odt'
                        }
                        onChange={(e) =>
                            setRevisionFile(e.target.files?.[0] ?? null)
                        }
                        className="text-oxford-navy-900 text-sm"
                    />
                    {isChapter && canPenulisUpload && (
                        <small className="text-oxford-navy-900/65 -mt-2">
                            Naskah bab Book Chapter wajib Word (.docx) karena
                            digabung dengan bab lain menjadi satu buku.
                        </small>
                    )}
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

                    {needsCoauthorFee && chosenCoauthor && (
                        <div className="flex flex-col gap-3 bg-forest-moss-50 ring-1 ring-forest-moss-100 rounded-lg p-4">
                            <p className="text-oxford-navy-900 text-sm">
                                Penulis memilih co-author{' '}
                                <strong>{chosenCoauthor.name}</strong> secara
                                langsung. Fee permintaan co-author{' '}
                                {rupiahFormatter.format(
                                    chosenCoauthor.requested_fee
                                )}{' '}
                                sudah dibayar penulis di pesanan. Fee dari admin
                                tetap wajib diisi saat approve.
                            </p>
                            <Input
                                label="Fee dari admin untuk co-author (Rp)"
                                type="number"
                                min="0"
                                value={approveCoauthorFee}
                                onChange={(e) =>
                                    setApproveCoauthorFee(e.target.value)
                                }
                                required
                            />
                            <p className="text-oxford-navy-900/70 text-sm">
                                Total fee co-author ={' '}
                                {rupiahFormatter.format(
                                    chosenCoauthor.requested_fee
                                )}{' '}
                                +{' '}
                                {rupiahFormatter.format(
                                    isApproveCoauthorFeeValid
                                        ? approveCoauthorFeeAmount
                                        : 0
                                )}{' '}
                                ={' '}
                                <strong className="text-forest-moss-700">
                                    {rupiahFormatter.format(
                                        chosenCoauthor.requested_fee +
                                            (isApproveCoauthorFeeValid
                                                ? approveCoauthorFeeAmount
                                                : 0)
                                    )}
                                </strong>
                            </p>
                        </div>
                    )}

                    {latestRevision.role === 'penulis' &&
                        manuscript.wants_coauthor && (
                            <p className="rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-3 text-oxford-navy-900 text-sm">
                                Penulis memakai layanan co-author: setelah
                                disetujui, naskah dikirim ke co-author (bukan
                                langsung ke editor), lalu kembali ke penulis
                                untuk disetujui sebelum dikerjakan editor.
                            </p>
                        )}

                    {latestRevision.role === 'coauthor' && (
                        <p className="rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-3 text-oxford-navy-900 text-sm">
                            Hasil susunan co-author: setelah disetujui, naskah
                            dikirim ke penulis untuk disetujui atau diminta
                            revisi. Baru setelah penulis setuju, naskah masuk ke
                            tahap editor.
                        </p>
                    )}

                    {latestRevision.role === 'penulis' && isChapter && (
                        <p className="rounded-lg bg-forest-moss-50 ring-1 ring-forest-moss-100 p-3 text-oxford-navy-900 text-sm">
                            Naskah bab Book Chapter: setelah disetujui, bab ini
                            menunggu bab lain. Penggabungan menjadi satu buku
                            (dengan auto layout) dilakukan di halaman Kelola
                            Proyek Book Chapter.
                        </p>
                    )}

                    {latestRevision.role === 'penulis' &&
                        !isChapter &&
                        !manuscript.wants_coauthor && (
                            <AutoLayoutOption
                                manuscriptId={manuscript.id}
                                revisionId={latestRevision.id}
                                filename={latestRevision.original_filename}
                                value={autoLayout}
                                onChange={setAutoLayout}
                                preferredTemplateId={
                                    manuscript.manuscript_template_id ?? null
                                }
                            />
                        )}

                    {needsDifficulty && (
                        <div className="flex flex-col gap-1">
                            <Select
                                name="difficulty"
                                label="Tingkat Kesulitan Naskah (wajib untuk approve)"
                                option_data={[
                                    {
                                        value: '',
                                        label: 'Pilih tingkat kesulitan',
                                    },
                                    ...DIFFICULTY_OPTIONS,
                                ]}
                                value={effectiveApproveDifficulty}
                                onChange={(e) =>
                                    setApproveDifficulty(
                                        isDifficulty(e.target.value)
                                            ? e.target.value
                                            : ''
                                    )
                                }
                            />
                            <small className="text-oxford-navy-900/65">
                                Tampil untuk editor di pool dan daftar naskah.
                            </small>
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
                                (needsAdminFee && !isApproveFeeValid) ||
                                (needsCoauthorFee &&
                                    !isApproveCoauthorFeeValid) ||
                                (needsDifficulty && !effectiveApproveDifficulty)
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
                            label: `${editor.is_promoted ? '★ ' : ''}${editor.name} (Rp ${editor.fee})${editor.under_monitoring ? ' — dalam pemantauan' : ''}`,
                        }))}
                        value={selectedEditorId}
                        onChange={(e) => setSelectedEditorId(e.target.value)}
                    />
                    {editors.find(
                        (editor) => String(editor.user_id) === selectedEditorId
                    )?.under_monitoring && (
                        <p
                            role="note"
                            className="-mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
                        >
                            Editor ini dalam pemantauan. Disarankan memilih
                            editor lain.
                        </p>
                    )}
                    <Input
                        label="Fee / Harga Pengerjaan Naskah (Rp)"
                        value={assignFee}
                        onChange={(e) => setAssignFee(e.target.value)}
                        required
                    />
                    <small className="text-oxford-navy-900/65 -mt-2">
                        Ditugaskan langsung: ini fee editor. Dibuka ke pool: ini
                        harga pengerjaan yang diterima editor yang mengambil
                        naskah.
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
                    <div className="w-56">
                        <Select
                            name="assign_difficulty"
                            label="Tingkat Kesulitan"
                            option_data={[
                                ...(effectiveAssignDifficulty
                                    ? []
                                    : [{ value: '', label: 'Belum diisi' }]),
                                ...DIFFICULTY_OPTIONS,
                            ]}
                            value={effectiveAssignDifficulty}
                            onChange={(e) =>
                                setAssignDifficulty(
                                    isDifficulty(e.target.value)
                                        ? e.target.value
                                        : ''
                                )
                            }
                        />
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100">
                        <FieldCategoryPicker
                            label="Kriteria Editor Pool (dipakai saat Buka ke Pool)"
                            categories={fieldCategories}
                            value={effectivePoolFields}
                            onChange={setPoolFields}
                            emptyLabel="Umum — semua editor bisa mengambil naskah ini."
                        />
                        <small className="text-oxford-navy-900/65">
                            Pilih bidang supaya hanya editor dengan bidang
                            keahlian itu yang bisa mengambil. Bidang keahlian
                            editor diatur di{' '}
                            <Link
                                to="/admin/pool-naskah"
                                className="text-forest-moss-700 underline"
                            >
                                Pengaturan Pool Naskah
                            </Link>
                            .
                        </small>
                    </div>

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

            {canAdminAssignCoauthor && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Tentukan Co-author (Admin)
                    </h5>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Penulis memakai layanan co-author tanpa memilih
                        orangnya. Tunjuk langsung salah satu editor yang
                        mencentang co-author, atau buka ke pool co-author.
                        Co-author dan editor harus orang yang berbeda.
                    </p>

                    <Select
                        name="coauthor"
                        label="Pilih Co-author"
                        option_data={[
                            { value: '', label: 'Pilih co-author' },
                            ...coauthors.map((coauthor) => ({
                                value: String(coauthor.user_id),
                                label: `${coauthor.name} (Rp ${coauthor.fee})${coauthor.under_monitoring ? ' — dalam pemantauan' : ''}`,
                            })),
                        ]}
                        value={selectedCoauthorId}
                        onChange={(e) => setSelectedCoauthorId(e.target.value)}
                    />
                    {coauthors.find(
                        (coauthor) =>
                            String(coauthor.user_id) === selectedCoauthorId
                    )?.under_monitoring && (
                        <p
                            role="note"
                            className="-mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
                        >
                            Co-author ini dalam pemantauan. Disarankan memilih
                            yang lain.
                        </p>
                    )}
                    <Input
                        label="Fee / Harga Pengerjaan Co-author (Rp)"
                        value={assignFee}
                        onChange={(e) => setAssignFee(e.target.value)}
                        required
                    />
                    <small className="text-oxford-navy-900/65 -mt-2">
                        Ditugaskan langsung: ini fee co-author. Dibuka ke pool:
                        ini harga pengerjaan yang diterima co-author yang
                        mengambil naskah.
                    </small>
                    <Input
                        label="Deadline"
                        type="date"
                        value={assignDeadline}
                        onChange={(e) => setAssignDeadline(e.target.value)}
                    />
                    <Input
                        label="Catatan untuk Co-author"
                        value={assignNote}
                        onChange={(e) => setAssignNote(e.target.value)}
                    />
                    <div className="flex flex-col gap-1 rounded-lg bg-forest-moss-50 p-4 ring-1 ring-forest-moss-100">
                        <FieldCategoryPicker
                            label="Kriteria Co-author Pool (dipakai saat Buka ke Pool)"
                            categories={fieldCategories}
                            value={effectivePoolFields}
                            onChange={setPoolFields}
                            emptyLabel="Umum — semua co-author bisa mengambil naskah ini."
                        />
                    </div>

                    <div className="flex flex-row gap-2">
                        <Button
                            variant="primary"
                            onClick={handleAssignCoauthor}
                            disabled={
                                isAssigning ||
                                !selectedCoauthorId ||
                                assignFee.trim() === ''
                            }
                        >
                            Tugaskan Co-author Ini
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={handleOpenCoauthorPool}
                            disabled={isAssigning || assignFee.trim() === ''}
                        >
                            Buka ke Pool Co-author
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

            {isbnApplication && (
                <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                        Surat Pengajuan ISBN
                    </h5>
                    <p className="text-oxford-navy-900/70 text-sm">
                        {isbnApplication.status === 'draft'
                            ? 'Surat sudah dibuat tetapi belum Anda tandatangani.'
                            : isbnApplication.status === 'signed'
                              ? 'Sudah Anda tandatangani, menunggu tanda tangan dan stempel dari penanggung jawab.'
                              : 'Sudah diproses penanggung jawab penerbit.'}
                    </p>
                    <Link
                        to={`/dashboard/isbn/${isbnApplication.id}`}
                        className="self-start bg-oxford-navy-700 hover:bg-oxford-navy-600 text-white rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
                    >
                        {isbnApplication.status === 'draft'
                            ? 'Lanjutkan & Tandatangani Surat'
                            : 'Buka Surat Pengajuan ISBN'}
                    </Link>
                </div>
            )}

            {canRequestIsbn && (
                <div className="flex flex-col gap-3 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-lg font-bold">
                        Ajukan ISBN
                    </h5>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Naskah Anda sudah selesai. Surat permohonan ISBN dan
                        surat keaslian karya akan terisi otomatis dari Data
                        Pribadi Anda untuk ditinjau dan ditandatangani.
                    </p>
                    <IsbnStartButton
                        target={{ manuscript_id: manuscript.id }}
                    />
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
                        Judul &amp; penulis akan otomatis diambil dari naskah
                        ini.
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
                    {approvalSignsMou && manuscript.mou && (
                        <div className="flex flex-col gap-3">
                            <p className="text-oxford-navy-900/80 text-sm">
                                Menyetujui naskah akhir Book Chapter sekaligus
                                menyetujui <strong>MOU distribusi buku</strong>{' '}
                                berikut. Tinjau isinya, centang pernyataan, lalu
                                tanda tangani.
                            </p>
                            <MouDocument mou={manuscript.mou} />
                            <MouAgreeCheckbox
                                checked={mouAgreed}
                                onChange={setMouAgreed}
                            />
                            <SignaturePad
                                onSave={(signature) =>
                                    handleFinalReview('approve', signature)
                                }
                                isSaving={isReviewing}
                                disabled={!mouAgreed}
                                label="Setujui naskah & tanda tangani MOU"
                            />
                        </div>
                    )}
                    {approvalBlockedByMou && (
                        <p className="text-amber-700 text-sm">
                            {manuscript.mou?.me?.blocked_reason}
                        </p>
                    )}
                    <div className="flex flex-row gap-2">
                        {!approvalSignsMou && !approvalBlockedByMou && (
                            <Button
                                variant="primary"
                                onClick={() => handleFinalReview('approve')}
                                disabled={isReviewing}
                            >
                                Setujui (Selesai)
                            </Button>
                        )}
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

            {canAuthorCoauthorReview && (
                <div className="flex flex-col gap-4 bg-white shadow-[0_2px_14px_-8px_rgba(1,26,44,0.18)] ring-1 ring-forest-moss-100 rounded-2xl p-6">
                    <h5 className="font-display text-oxford-navy-700 text-xl font-bold">
                        Tinjau Hasil Susunan Co-author
                    </h5>
                    <p className="text-oxford-navy-900/70 text-sm">
                        Co-author{' '}
                        <strong>{manuscript.coauthor?.name ?? '-'}</strong>{' '}
                        sudah menyusun naskah Anda dan admin sudah
                        menyetujuinya. Unduh hasil terbaru di Riwayat Revisi.
                        Jika Anda setuju, naskah dilanjutkan ke editor; jika
                        tidak, minta revisi dan tulis catatannya.
                    </p>
                    <Input
                        label="Catatan (kalau minta revisi)"
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                    />
                    <div className="flex flex-row gap-2">
                        <Button
                            variant="primary"
                            onClick={() => handleCoauthorReview('approve')}
                            disabled={isReviewing}
                        >
                            Setujui, Lanjut ke Editor
                        </Button>
                        <Button
                            variant="outline2"
                            onClick={() => handleCoauthorReview('revise')}
                            disabled={isReviewing}
                        >
                            Minta Revisi ke Co-author
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
                        Anda sudah menyetujui. Menunggu penulis lain menyetujui
                        sebelum naskah berstatus selesai.
                    </p>
                </div>
            )}
        </div>
    );
}
