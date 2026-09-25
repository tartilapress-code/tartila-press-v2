<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Menyaring respons JSON endpoint publik (tanpa login) sebelum dikirim.
 *
 * Endpoint publik menyerialisasi model beserta relasinya — editor, penulis,
 * pemilik buku, pengomentar, dan seterusnya — baik yang di-eager-load maupun
 * yang ikut termuat lewat accessor model. Relasi `User` membawa email dan
 * status verifikasinya, sedangkan relasi `manuscript` membawa fee editor,
 * catatan penugasan admin, tenggat editor, dan id akun/pesanan yang terkait.
 * Data itu hanya dipakai halaman dashboard/admin lewat endpoint
 * terautentikasi, bukan halaman publik.
 *
 * Penyaringan dilakukan pada hasil akhir (bukan di tiap controller) supaya
 * relasi baru, atau relasi yang termuat secara lazy, tidak bisa lolos.
 *
 * Catatan: menyembunyikan id hanyalah lapisan tambahan. Endpoint yang
 * menerima aksi atas uang (penarikan royalti/fee, dsb.) tetap wajib
 * menentukan pemilik dari token login dan memeriksa kepemilikan di server,
 * tidak boleh mempercayai id dari klien. Id di dalam objek user bersarang
 * (`user.id`) sengaja tidak disaring: frontend memakainya untuk mengenali
 * komentar milik sendiri.
 */
class SanitizePublicResponse
{
    /**
     * Kunci yang dibuang dari objek JSON mana pun pada respons publik.
     */
    private const HIDDEN_KEYS = [
        // Kontak dan status akun.
        'email',
        'email_verified_at',

        // Data fee dan penugasan editor.
        'editor_fee',
        'editor_admin_fee',
        'editor_requested_fee',
        'editor_assignment_note',
        'editor_deadline',

        // Id internal yang menunjuk akun, pesanan, dan pembuat data.
        'user_id',
        'editor_id',
        'owner_editor_id',
        'order_id',
        'created_by',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $response instanceof JsonResponse) {
            return $response;
        }

        // Didekode sebagai objek (bukan array asosiatif) supaya `{}` dan `[]`
        // tetap dibedakan saat di-encode ulang.
        $data = json_decode($response->getContent());

        if (! is_object($data) && ! is_array($data)) {
            return $response;
        }

        $response->setData($this->scrub($data));

        return $response;
    }

    private function scrub(mixed $node): mixed
    {
        if (is_array($node)) {
            return array_map(fn ($item) => $this->scrub($item), $node);
        }

        if (! is_object($node)) {
            return $node;
        }

        foreach (get_object_vars($node) as $key => $value) {
            if (in_array($key, self::HIDDEN_KEYS, true)) {
                unset($node->{$key});

                continue;
            }

            $node->{$key} = $this->scrub($value);
        }

        return $node;
    }
}
