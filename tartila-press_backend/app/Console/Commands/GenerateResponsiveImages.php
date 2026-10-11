<?php

namespace App\Console\Commands;

use App\Support\ResponsiveImages;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class GenerateResponsiveImages extends Command
{
    protected $signature = 'images:responsive {--force : Buat ulang varian yang sudah ada}';

    protected $description = 'Buat versi kecil (WebP 400/900 px) untuk semua gambar unggahan yang belum punya. Berkas asli tidak diubah.';

    public function handle(ResponsiveImages $images): int
    {
        if (! ResponsiveImages::supported()) {
            $this->error('Ekstensi PHP GD (dengan dukungan WebP) belum aktif. Pasang/aktifkan dulu, mis. php8.2-gd.');

            return self::FAILURE;
        }

        $sources = collect(Storage::disk('public')->allFiles('uploads'))
            ->filter(fn (string $path) => ResponsiveImages::isSource($path))
            ->values();

        $created = 0;
        $bar = $this->output->createProgressBar($sources->count());

        foreach ($sources as $path) {
            $created += $images->generate($path, (bool) $this->option('force'));
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("{$sources->count()} gambar diperiksa, {$created} varian dibuat.");

        return self::SUCCESS;
    }
}
