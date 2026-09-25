-- Dipakai HANYA kalau database dari komputer lokal dibawa ke server.
--
-- Gambar yang diunggah saat pengembangan tersimpan di database sebagai alamat
-- lengkap "http://127.0.0.1:8000/storage/...", yang tentu tidak bisa dibuka di
-- server. Skrip ini menggantinya dengan alamat domain sungguhan. Unggahan baru
-- di server otomatis memakai domain server, jadi cukup dijalankan sekali.
--
--   psql -h 127.0.0.1 -U tartila -d tartila_press \
--        -v base='https://DOMAIN_ANDA' -f deploy/ganti-url-lokal.sql
--
-- Kolom yang berisi alamat lokal (hasil pemindaian database pengembangan
-- 2026-09-25): articles.photo, books.front_cover, books.back_cover,
-- events.banner, packages.photo, public_profiles.profile_photo.

UPDATE articles
   SET photo = replace(photo, 'http://127.0.0.1:8000', :'base')
 WHERE photo LIKE 'http://127.0.0.1:8000%';

UPDATE books
   SET front_cover = replace(front_cover, 'http://127.0.0.1:8000', :'base')
 WHERE front_cover LIKE 'http://127.0.0.1:8000%';

UPDATE books
   SET back_cover = replace(back_cover, 'http://127.0.0.1:8000', :'base')
 WHERE back_cover LIKE 'http://127.0.0.1:8000%';

UPDATE events
   SET banner = replace(banner, 'http://127.0.0.1:8000', :'base')
 WHERE banner LIKE 'http://127.0.0.1:8000%';

UPDATE packages
   SET photo = replace(photo, 'http://127.0.0.1:8000', :'base')
 WHERE photo LIKE 'http://127.0.0.1:8000%';

UPDATE public_profiles
   SET profile_photo = replace(profile_photo, 'http://127.0.0.1:8000', :'base')
 WHERE profile_photo LIKE 'http://127.0.0.1:8000%';

-- Token login lama dari komputer lokal tidak perlu dibawa; semua orang cukup
-- login ulang di server.
TRUNCATE personal_access_tokens;
