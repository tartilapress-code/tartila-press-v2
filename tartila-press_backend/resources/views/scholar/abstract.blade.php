@php
    $pageUrl = route('scholar.abstract', $book);
    $storeUrl = $frontendUrl !== '' ? $frontendUrl.'/buku/'.$book->slug : null;
    // Harus sedirektori dengan halaman ini (aturan Google Scholar untuk citation_pdf_url).
    $pdfUrl = $book->preview_file ? route('scholar.pdf', $book) : null;
    $date = $book->citation_publication_date;
    $paragraphs = preg_split('/\R{2,}/u', trim((string) $book->description), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $summary = \Illuminate\Support\Str::limit(trim(preg_replace('/\s+/u', ' ', (string) $book->description)), 200);
    $eyebrow = collect([$book->category?->name, $book->fieldCategory?->name])->filter()->implode(' · ');

    $structured = array_filter([
        '@context' => 'https://schema.org',
        '@type' => 'Book',
        'name' => $book->title,
        'url' => $pageUrl,
        'inLanguage' => 'id',
        'author' => array_map(fn (string $name) => ['@type' => 'Person', 'name' => $name], $authors),
        'publisher' => $book->citation_publisher ? ['@type' => 'Organization', 'name' => $book->citation_publisher] : null,
        'datePublished' => $date?->toDateString(),
        'isbn' => $book->isbn,
        'description' => \Illuminate\Support\Str::limit(trim(preg_replace('/\s+/u', ' ', (string) $book->description)), 1000),
        'image' => filter_var($book->front_cover, FILTER_VALIDATE_URL) ?: null,
    ]);
@endphp
@extends('scholar.layout')

@section('title', $book->title.' — Tartila Press')

@section('head')
    <meta name="description" content="{{ $summary }}">
    <link rel="canonical" href="{{ $pageUrl }}">

    @if ($ready)
        {{-- Metadata bibliografi (Highwire Press tags) yang dibaca Google Scholar. --}}
        <meta name="citation_title" content="{{ $book->title }}">
        @foreach ($authors as $author)
            <meta name="citation_author" content="{{ $author }}">
        @endforeach
        <meta name="citation_publication_date" content="{{ $date->format('Y/m/d') }}">
        @if ($book->citation_publisher)
            <meta name="citation_publisher" content="{{ $book->citation_publisher }}">
        @endif
        @if ($book->isbn)
            <meta name="citation_isbn" content="{{ $book->isbn }}">
        @endif
        <meta name="citation_language" content="id">
        <meta name="citation_abstract_html_url" content="{{ $pageUrl }}">
        @if ($pdfUrl)
            <meta name="citation_pdf_url" content="{{ $pdfUrl }}">
        @endif
    @else
        <meta name="robots" content="noindex, nofollow">
    @endif

    <meta property="og:type" content="book">
    <meta property="og:site_name" content="Tartila Press">
    <meta property="og:title" content="{{ $book->title }}">
    <meta property="og:description" content="{{ $summary }}">
    <meta property="og:url" content="{{ $pageUrl }}">
    @if (! empty($structured['image']))
        <meta property="og:image" content="{{ $structured['image'] }}">
    @endif

    @if ($ready)
        <script type="application/ld+json">{!! json_encode($structured, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
    @endif
@endsection

@section('content')
    <article>
        @if ($eyebrow !== '')
            <p class="eyebrow">{{ $eyebrow }}</p>
        @endif

        <h1>{{ $book->title }}</h1>

        @if ($authors !== [])
            <p class="authors">{{ implode(', ', $authors) }}</p>
        @endif

        <dl class="meta">
            @if ($book->citation_publisher)
                <dt>Penerbit</dt>
                <dd>{{ $book->citation_publisher }}</dd>
            @endif
            @if ($date)
                <dt>Tanggal terbit</dt>
                <dd>{{ $date->locale('id')->translatedFormat('j F Y') }}</dd>
            @endif
            @if ($book->isbn)
                <dt>ISBN</dt>
                <dd>{{ $book->isbn }}</dd>
            @endif
            @if ($book->category)
                <dt>Kategori</dt>
                <dd>{{ $book->category->name }}</dd>
            @endif
            @if ($book->fieldCategory)
                <dt>Bidang keilmuan</dt>
                <dd>{{ $book->fieldCategory->name }}</dd>
            @endif
        </dl>

        @if ($paragraphs !== [])
            <h2 id="abstrak">Abstrak</h2>
            <div class="abstract" aria-labelledby="abstrak">
                @foreach ($paragraphs as $paragraph)
                    <p>{!! nl2br(e($paragraph)) !!}</p>
                @endforeach
            </div>
        @endif

        <h2>Dokumen</h2>
        <ul class="actions">
            @if ($pdfUrl)
                <li><a class="button secondary" href="{{ $pdfUrl }}">Baca cuplikan buku (PDF)</a></li>
            @endif
            @if ($storeUrl)
                <li><a class="button primary" href="{{ $storeUrl }}">Lihat &amp; beli di Tartila Press</a></li>
            @endif
        </ul>
    </article>
@endsection
