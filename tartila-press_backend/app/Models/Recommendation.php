<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Satu konten yang di-pin admin sebagai rekomendasi pada sebuah menu (lihat RecommendationService). */
class Recommendation extends Model
{
    protected $fillable = ['section', 'item_id', 'position'];
}
