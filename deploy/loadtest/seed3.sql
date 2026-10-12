SET autocommit=0; SET UNIQUE_CHECKS=0; SET FOREIGN_KEY_CHECKS=0;
SET @now = NOW();
INSERT INTO reader_comments (reader_book_id,user_id,body,created_at,updated_at) SELECT 1+FLOOR(3000*POW(RAND(),3)), 100001+FLOOR(RAND()*1000000), 'Buku yang bagus sekali, sangat bermanfaat untuk dibaca.', DATE_SUB(@now, INTERVAL FLOOR(RAND()*300) DAY), @now FROM seq_1_to_600000;
-- semua buku terbuka untuk semua pembaca (jendela gratis), supaya skenario baca tidak terkunci
INSERT INTO reader_access_rules (reader_book_id,action,starts_at,ends_at,created_at,updated_at) VALUES (NULL,'open',DATE_SUB(@now, INTERVAL 1 DAY),DATE_ADD(@now, INTERVAL 30 DAY),@now,@now);
INSERT INTO reader_settings (purchase_royalty_percent,read_fee,created_at,updated_at) VALUES (20,100,@now,@now);
COMMIT;
ANALYZE TABLE reader_page_reads, reader_progress, reader_saves, reader_likes, reader_comments, reader_bookmarks, reader_orders, reader_entitlements, users, personal_access_tokens, books, orders, reader_books, reader_page_stats;
