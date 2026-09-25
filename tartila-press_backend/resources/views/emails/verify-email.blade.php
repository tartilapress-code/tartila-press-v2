<x-mail::message>
# Halo, {{ $name }}!

Terima kasih sudah mendaftar di Tartila Press. Klik tombol di bawah ini untuk memverifikasi alamat email Anda.

<x-mail::button :url="$url">
Verifikasi Email
</x-mail::button>

Link ini berlaku selama {{ $expireMinutes }} menit. Jika Anda tidak merasa membuat akun di Tartila Press, abaikan saja email ini.

Salam,<br>
Tim Tartila Press

<x-slot:subcopy>
Jika tombol di atas tidak berfungsi, salin dan tempel alamat berikut ke browser Anda: <span class="break-all">[{{ $url }}]({{ $url }})</span>
</x-slot:subcopy>
</x-mail::message>
