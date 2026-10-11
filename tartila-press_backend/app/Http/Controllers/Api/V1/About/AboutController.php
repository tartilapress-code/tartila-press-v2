<?php

namespace App\Http\Controllers\Api\V1\About;

use App\Http\Controllers\Controller;
use App\Models\AboutLegality;
use App\Models\AboutProfile;
use App\Models\AboutTeamMember;
use Illuminate\Http\JsonResponse;

/**
 * Halaman publik "Tentang Kami" (juga sumber kontak & sosial media di footer).
 * Anggota tim yang disembunyikan tidak pernah ikut terkirim.
 */
class AboutController extends Controller
{
    public function show(): JsonResponse
    {
        $profile = AboutProfile::current();

        return response()->json([
            'success' => true,
            'message' => 'Halaman Tentang Kami berhasil diambil.',
            'data' => [
                'profile' => self::publicProfile($profile),
                'legalities' => AboutLegality::ordered()->get(['id', 'name', 'description', 'image_url']),
                'team' => $profile->show_team
                    ? AboutTeamMember::ordered()->where('is_visible', true)->get(['id', 'name', 'photo_url', 'position', 'expertise'])
                    : [],
            ],
        ]);
    }

    /** @return array<string, mixed> */
    public static function publicProfile(AboutProfile $profile): array
    {
        return [
            'vision' => $profile->vision,
            'mission' => $profile->mission,
            'profile' => $profile->profile,
            'contact_email' => $profile->contact_email,
            'phone' => $profile->phone,
            'whatsapp' => $profile->whatsapp,
            'address' => $profile->address,
            'map_query' => $profile->map_query,
            'social_links' => self::socialLinks($profile),
            'show_team' => $profile->show_team,
        ];
    }

    /**
     * Sosial media terisi, dalam urutan tetap.
     *
     * @return array<string, string>
     */
    public static function socialLinks(AboutProfile $profile): array
    {
        $links = (array) $profile->social_links;

        return collect(AboutProfile::SOCIAL_PLATFORMS)
            ->filter(fn (string $platform) => filled($links[$platform] ?? null))
            ->mapWithKeys(fn (string $platform) => [$platform => $links[$platform]])
            ->all();
    }
}
