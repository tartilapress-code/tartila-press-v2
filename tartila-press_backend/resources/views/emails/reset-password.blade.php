<x-mail::message>
# Halo, {{ $name }}!

Kami menerima permintaan untuk membuat ulang password akun Tartila Press Anda. Klik tombol di bawah ini untuk memilih password baru.

<x-mail::button :url="$url">
Buat Password Baru
</x-mail::button>

Link ini berlaku selama {{ $expireMinutes }} menit dan hanya bisa dipakai sekali. Jika Anda tidak merasa meminta reset password, abaikan saja email ini — password Anda tidak akan berubah.

Salam,<br>
Tim Tartila Press

<x-slot:subcopy>
Jika tombol di atas tidak berfungsi, salin dan tempel alamat berikut ke browser Anda: <span class="break-all">[{{ $url }}]({{ $url }})</span>
</x-slot:subcopy>
</x-mail::message>
