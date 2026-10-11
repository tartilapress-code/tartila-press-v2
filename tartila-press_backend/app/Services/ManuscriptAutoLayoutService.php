<?php

namespace App\Services;

use App\Models\Book;
use App\Models\Manuscript;
use App\Models\ManuscriptRevision;
use App\Models\ManuscriptTemplate;
use App\Models\User;
use App\Support\Isbn\IsbnLetterRenderer;
use App\Support\ManuscriptTemplates\DocxLayout;
use App\Support\ManuscriptTemplates\TemplateSchema;
use App\Support\PublicStorageUrl;
use App\Support\SafeImageFetcher;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Auto layout naskah penulis (.docx) dengan template naskah. Hasilnya
 * disimpan sebagai revisi baru berperan "layout" sehingga editor menerima
 * berkas Word yang sudah rapi.
 */
class ManuscriptAutoLayoutService
{
    private const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

    /** Sisi terpanjang foto biodata (piksel) — cukup tajam untuk cetak ±8 cm. */
    private const MAX_PHOTO_PIXELS = 1000;

    /** Hanya dokumen Word modern (.docx) yang bisa ditata otomatis. */
    public function supports(ManuscriptRevision $revision): bool
    {
        return strtolower(pathinfo((string) $revision->original_filename, PATHINFO_EXTENSION)) === 'docx'
            && Storage::disk('local')->exists($revision->file_path);
    }

    /** Hasil auto layout sebagai isi berkas .docx (tidak disimpan). */
    public function render(Manuscript $manuscript, ManuscriptRevision $source, ManuscriptTemplate $template): string
    {
        $config = TemplateSchema::normalize($template->config ?? []);

        return (new DocxLayout($config, $this->data($manuscript)))
            ->apply(Storage::disk('local')->path($source->file_path));
    }

    /** Simpan hasil auto layout sebagai revisi baru untuk editor. */
    public function storeRevision(
        Manuscript $manuscript,
        ManuscriptTemplate $template,
        string $docx,
        User $admin
    ): ManuscriptRevision {
        $path = 'manuscripts/'.$manuscript->id.'/auto-layout-'.Str::random(10).'.docx';
        Storage::disk('local')->put($path, $docx);

        $manuscript->update(['manuscript_template_id' => $template->id]);

        return $manuscript->revisions()->create([
            'revision_number' => ($manuscript->revisions()->max('revision_number') ?? 0) + 1,
            'uploaded_by' => $admin->id,
            'role' => 'layout',
            'file_path' => $path,
            'original_filename' => $this->filename($manuscript),
            'note' => 'Auto layout dengan template: '.$template->name,
            'admin_status' => 'approved',
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
        ]);
    }

    public function filename(Manuscript $manuscript): string
    {
        return (Str::slug(Str::limit($manuscript->title, 80, '')) ?: 'naskah').'-auto-layout.docx';
    }

    /**
     * Data untuk halaman judul, balik halaman judul, header/footer, biodata.
     *
     * @return array{title: string, authors: list<string>, editor: string|null, isbn: string|null, month_year: string, publisher: string, author_bio: list<array{name: string, bio: string, photo: string|null}>}
     */
    public function data(Manuscript $manuscript): array
    {
        $manuscript->loadMissing(['authorLinks.user.publicProfile', 'user.publicProfile', 'editor', 'book']);

        $users = $manuscript->authorLinks->pluck('user')->filter()->values();

        if ($users->isEmpty() && $manuscript->user) {
            $users = collect([$manuscript->user]);
        }

        $authors = $users->map(fn (User $user) => $user->name)->all();

        if ($authors === []) {
            $authors = array_values(array_filter((array) $manuscript->authors));
        }

        // Biodata: isian penulis saat upload naskah (khusus pengunggah), kalau
        // kosong dari Profil Publik. Penulis tanpa bio dan tanpa foto dilewati.
        $bios = $users->map(fn (User $user) => $this->bio($user, $manuscript->user_id === $user->id ? $manuscript : null))
            ->filter(fn (array $bio) => $bio['bio'] !== '' || $bio['photo'] !== null)->values()->all();

        return [
            'title' => (string) $manuscript->title,
            'authors' => array_values($authors),
            'editor' => $manuscript->editor?->name,
            'isbn' => $manuscript->book?->isbn,
            'month_year' => IsbnLetterRenderer::formatMonthYear(now()),
            'publisher' => 'Tartila Press',
            'author_bio' => $bios,
        ];
    }

    /**
     * Data naskah gabungan Book Chapter: penulis = penulis tiap bab (urut
     * bab), biodata dari isian upload naskah babnya atau Profil Publik.
     *
     * @param  list<Manuscript>  $chapterManuscripts  urut menurut nomor bab
     * @return array<string, mixed>
     */
    public function compilationData(Book $book, array $chapterManuscripts, ?string $editor): array
    {
        $authors = [];
        $bios = [];

        foreach ($chapterManuscripts as $chapter) {
            $chapter->loadMissing('user.publicProfile');
            $user = $chapter->user;

            if (! $user || isset($authors[$user->id])) {
                continue;
            }

            $authors[$user->id] = $user->name;
            $bio = $this->bio($user, $chapter);

            if ($bio['bio'] !== '' || $bio['photo'] !== null) {
                $bios[] = $bio;
            }
        }

        return [
            'title' => (string) $book->title,
            'authors' => array_values($authors),
            'editor' => $editor,
            'isbn' => $book->isbn,
            'month_year' => IsbnLetterRenderer::formatMonthYear(now()),
            'publisher' => 'Tartila Press',
            'author_bio' => $bios,
            'compilation' => true,
        ];
    }

    /** Auto layout berkas .docx $path dengan template dan data siap pakai. */
    public function layoutFile(string $path, ManuscriptTemplate $template, array $data): string
    {
        return (new DocxLayout(TemplateSchema::normalize($template->config ?? []), $data))->apply($path);
    }

    /**
     * Biodata satu penulis. $manuscript = naskah yang diunggahnya (isian
     * biodata saat upload menang atas Profil Publik).
     *
     * @return array{name: string, bio: string, photo: string|null}
     */
    private function bio(User $user, ?Manuscript $manuscript): array
    {
        $profile = $user->publicProfile;
        $source = $manuscript !== null
            ? $manuscript->resolvedAuthorBio()
            : ['name' => $profile?->pen_name, 'bio' => $profile?->bio, 'photo' => $profile?->profile_photo];

        return [
            'name' => trim((string) ($source['name'] ?? '')) ?: $user->name,
            'bio' => trim((string) ($source['bio'] ?? '')),
            'photo' => $this->photoBytes((string) ($source['photo'] ?? '')),
        ];
    }

    /**
     * Isi berkas foto penulis (JPEG/PNG/GIF) — dari disk publik kalau hasil
     * upload, atau diunduh kalau tautan luar. Gagal = tanpa foto.
     */
    private function photoBytes(string $source): ?string
    {
        $source = trim($source);

        if ($source === '') {
            return null;
        }

        try {
            $local = PublicStorageUrl::localPath($source);

            if ($local !== null) {
                $bytes = Storage::disk('public')->exists($local) ? Storage::disk('public')->get($local) : null;
            } else {
                $bytes = $this->download($source);
            }
        } catch (Throwable) {
            return null;
        }

        return $bytes === null || $bytes === '' ? null : $this->wordImage($bytes);
    }

    /** Unduh foto dari tautan luar (aman SSRF, lihat SafeImageFetcher). */
    private function download(string $url): ?string
    {
        return SafeImageFetcher::fetch($url, self::MAX_PHOTO_BYTES)['bytes'] ?? null;
    }

    /**
     * Word hanya pasti bisa membuka JPEG/PNG/GIF. Bila GD tersedia, foto
     * besar diperkecil (foto biodata dicetak ±3 cm) dan WebP diubah ke JPEG.
     */
    private function wordImage(string $bytes): ?string
    {
        $info = @getimagesizefromstring($bytes);

        if ($info === false) {
            return null;
        }

        $supported = in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF], true);
        $tooBig = max($info[0], $info[1]) > self::MAX_PHOTO_PIXELS;

        if ($supported && ! $tooBig) {
            return $bytes;
        }

        if (! function_exists('imagecreatefromstring') || ! function_exists('imagejpeg')) {
            return $supported ? $bytes : null;
        }

        $image = @imagecreatefromstring($bytes);

        if ($image === false) {
            return $supported ? $bytes : null;
        }

        if ($tooBig) {
            $scale = self::MAX_PHOTO_PIXELS / max($info[0], $info[1]);
            $image = imagescale($image, max(1, (int) round($info[0] * $scale)), max(1, (int) round($info[1] * $scale))) ?: $image;
        }

        // Latar putih untuk bagian transparan sebelum disimpan sebagai JPEG.
        $canvas = imagecreatetruecolor(imagesx($image), imagesy($image));
        imagefill($canvas, 0, 0, (int) imagecolorallocate($canvas, 255, 255, 255));
        imagecopy($canvas, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));

        ob_start();
        imagejpeg($canvas, null, 88);

        return (string) ob_get_clean() ?: null;
    }
}
