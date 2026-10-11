<x-mail::message>
# Halo{{ $name ? ', '.$name : '' }}!

**{{ $title }}**

@foreach ($lines as $line)
{{ $line }}

@endforeach
@if ($url)
<x-mail::button :url="$url">
{{ $action }}
</x-mail::button>
@endif

Salam,<br>
Tim Tartila Press

@if ($url)
<x-slot:subcopy>
Email ini dikirim otomatis oleh Tartila Press. Jika tombol di atas tidak berfungsi, salin dan tempel alamat berikut ke browser Anda: <span class="break-all">[{{ $url }}]({{ $url }})</span>
</x-slot:subcopy>
@endif
</x-mail::message>
