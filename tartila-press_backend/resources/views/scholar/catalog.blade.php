@extends('scholar.layout')

@section('title', 'Daftar Buku — Tartila Press')

@section('head')
    <meta name="description" content="Daftar buku terbitan Tartila Press beserta abstrak dan metadata bibliografinya.">
    <link rel="canonical" href="{{ route('scholar.catalog', $page > 1 ? ['halaman' => $page] : []) }}">
@endsection

@section('content')
    <h1>Daftar Buku Tartila Press</h1>
    <p class="lead">
        Setiap judul menuju halaman abstrak yang memuat penulis, tanggal terbit, ISBN,
        abstrak, dan tautan cuplikan buku.
    </p>

    @if ($total === 0)
        <p>Belum ada buku yang siap ditampilkan.</p>
    @else
        <ol class="books" start="{{ ($page - 1) * 100 + 1 }}">
            @foreach ($books as $book)
                <li>
                    <a href="{{ route('scholar.abstract', $book) }}">{{ $book->title }}</a>
                    <span class="by">{{ implode(', ', $book->citation_authors) }} · {{ $book->citation_publication_date->format('Y') }}</span>
                </li>
            @endforeach
        </ol>

        @if ($lastPage > 1)
            <nav class="pager" aria-label="Halaman daftar">
                @if ($page > 1)
                    <a href="{{ route('scholar.catalog', $page > 2 ? ['halaman' => $page - 1] : []) }}" rel="prev">&larr; Sebelumnya</a>
                @else
                    <span></span>
                @endif

                <span>Halaman {{ $page }} dari {{ $lastPage }}</span>

                @if ($page < $lastPage)
                    <a href="{{ route('scholar.catalog', ['halaman' => $page + 1]) }}" rel="next">Berikutnya &rarr;</a>
                @else
                    <span></span>
                @endif
            </nav>
        @endif
    @endif
@endsection
