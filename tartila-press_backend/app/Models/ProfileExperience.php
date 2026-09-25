<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfileExperience extends Model
{
    use HasFactory;

    protected $fillable = [
        'public_profile_id',
        'title',
        'description',
        'year',
        'sort_order',
    ];

    public function publicProfile(): BelongsTo
    {
        return $this->belongsTo(PublicProfile::class);
    }
}