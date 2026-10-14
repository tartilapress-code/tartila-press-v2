<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Satu pekerjaan cover: paket (naskah) atau Book Chapter (proyek), lengkap dengan pilihan, suara, dan riwayat. */
class CoverProject extends Model
{
    protected $fillable = [
        'source', 'stage', 'manuscript_id', 'book_id', 'title', 'status', 'round',
        'voting_opened_at', 'voting_deadline_at', 'chosen_cover_id', 'approved_at',
        'published_at', 'purge_warned_at', 'files_purged_at',
    ];

    protected function casts(): array
    {
        return [
            'round' => 'integer',
            'voting_opened_at' => 'datetime',
            'voting_deadline_at' => 'datetime',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
            'purge_warned_at' => 'datetime',
            'files_purged_at' => 'datetime',
        ];
    }

    public function manuscript(): BelongsTo
    {
        return $this->belongsTo(Manuscript::class);
    }

    public function book(): BelongsTo
    {
        return $this->belongsTo(Book::class)->withoutGlobalScopes();
    }

    public function covers(): HasMany
    {
        return $this->hasMany(Cover::class)->orderBy('round')->orderBy('position');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(CoverVote::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(CoverEvent::class)->orderByDesc('id');
    }

    public function chosenCover(): BelongsTo
    {
        return $this->belongsTo(Cover::class, 'chosen_cover_id');
    }

    /** Cover pada ronde berjalan. */
    public function currentCovers()
    {
        return $this->covers->where('round', $this->round)->values();
    }
}
