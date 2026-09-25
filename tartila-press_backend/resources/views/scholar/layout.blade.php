<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'Tartila Press')</title>
    @yield('head')
    <style>
        :root {
            --navy: #003153;
            --navy-dark: #011a2c;
            --moss-50: #f3f8f1;
            --moss-100: #e5f0e1;
            --moss-200: #cbe1c3;
            --moss-700: #557650;
            --ink: #1b2b37;
            --muted: #5b6b77;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            color: var(--ink);
            background: #fff;
            font: 16px/1.7 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        a { color: var(--moss-700); }
        a:hover { color: var(--navy); }
        .wrap { max-width: 880px; margin: 0 auto; padding: 0 20px; }
        .site-header { background: var(--navy); color: #fff; }
        .site-header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 14px; padding-bottom: 14px; }
        .brand { color: #fff; font: 700 1.15rem Georgia, "Times New Roman", serif; text-decoration: none; }
        .brand small { display: block; font: 400 .75rem/1.3 system-ui, sans-serif; opacity: .75; }
        .site-header nav a { color: #fff; font-size: .95rem; text-decoration: none; opacity: .9; }
        .site-header nav a:hover { opacity: 1; text-decoration: underline; }
        main { padding: 32px 0 56px; }
        h1, h2 { font-family: Georgia, "Times New Roman", serif; color: var(--navy); line-height: 1.25; }
        h1 { font-size: clamp(1.7rem, 4vw, 2.3rem); margin: .3em 0 .2em; }
        h2 { font-size: 1.35rem; margin: 1.8em 0 .5em; padding-left: 12px; border-left: 4px solid var(--moss-700); }
        .eyebrow { margin: 0; color: var(--moss-700); font-size: .85rem; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
        .authors { margin: 0 0 1.2em; color: var(--muted); font-size: 1.1rem; }
        .lead { color: var(--muted); }
        dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 6px 20px; margin: 0; padding: 16px 20px; background: var(--moss-50); border: 1px solid var(--moss-100); border-radius: 12px; }
        dl.meta dt { color: var(--muted); font-size: .9rem; }
        dl.meta dd { margin: 0; font-weight: 600; }
        .abstract p { margin: 0 0 1em; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; padding: 0; margin: 0; list-style: none; }
        .button { display: inline-block; padding: 10px 18px; border-radius: 10px; font-weight: 600; text-decoration: none; border: 1px solid var(--navy); }
        .button.primary { background: var(--navy); color: #fff; }
        .button.primary:hover { background: var(--navy-dark); color: #fff; }
        .button.secondary { color: var(--navy); background: #fff; }
        .button.secondary:hover { background: var(--moss-100); }
        ol.books { padding-left: 1.4em; }
        ol.books li { margin: 0 0 .9em; }
        ol.books .by { display: block; color: var(--muted); font-size: .92rem; }
        .pager { display: flex; justify-content: space-between; gap: 16px; margin-top: 28px; }
        .site-footer { border-top: 1px solid var(--moss-100); background: var(--moss-50); color: var(--muted); font-size: .9rem; }
        .site-footer .wrap { padding-top: 20px; padding-bottom: 20px; }
    </style>
</head>
<body>
    <header class="site-header">
        <div class="wrap">
            <a class="brand" href="{{ $frontendUrl ?: route('scholar.catalog') }}">
                Tartila Press
                <small>Menata Ilmu, Menguatkan Peradaban</small>
            </a>
            <nav aria-label="Navigasi utama">
                <a href="{{ route('scholar.catalog') }}">Daftar buku</a>
            </nav>
        </div>
    </header>

    <main>
        <div class="wrap">
            @yield('content')
        </div>
    </main>

    <footer class="site-footer">
        <div class="wrap">
            &copy; {{ date('Y') }} Tartila Press. Halaman ini memuat abstrak dan metadata bibliografi buku terbitan Tartila Press.
        </div>
    </footer>
</body>
</html>
