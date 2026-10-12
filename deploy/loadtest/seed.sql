-- Data uji beban Tartila (Press + Book). Jalankan di database KOSONG hasil migrate + RoleSeeder.
-- $2y$04$oqmZ/S5oWAIJmbrwM6GLHOCmz3u2eBrCjfGDXZsFIKPE4f1ZWLvw. diganti dengan hash bcrypt kata sandi uji (cost 12).
SET FOREIGN_KEY_CHECKS=0; SET UNIQUE_CHECKS=0; SET autocommit=0;
SET @now = NOW();

-- ---------- users: 1 admin + 100.000 (Press) + 1.000.000 (Book) ----------
INSERT INTO users (id,name,email,email_verified_at,password,created_at,updated_at)
SELECT seq, CONCAT('User ', seq), CONCAT('u', seq, '@perf.test'), @now, '$2y$04$oqmZ/S5oWAIJmbrwM6GLHOCmz3u2eBrCjfGDXZsFIKPE4f1ZWLvw.', DATE_SUB(@now, INTERVAL FLOOR(RAND()*700) DAY), @now
FROM seq_1_to_1100000;
COMMIT;
INSERT INTO role_user (user_id,role_id,created_at,updated_at) SELECT seq, 1, @now, @now FROM seq_1_to_1100000; COMMIT;
INSERT INTO role_user (user_id,role_id,created_at,updated_at) VALUES (1,4,@now,@now);
INSERT INTO role_user (user_id,role_id,created_at,updated_at) SELECT seq, 2, @now, @now FROM seq_2_to_6000;
INSERT INTO role_user (user_id,role_id,created_at,updated_at) SELECT seq, 3, @now, @now FROM seq_6001_to_6100;
COMMIT;

INSERT INTO payment_methods (id,bank_name,account_number,account_holder_name,is_active,created_at,updated_at) VALUES
 (1,'BRI','111','Tartila',1,@now,@now),(2,'BNI','222','Tartila',1,@now,@now),(3,'BCA','333','Tartila',1,@now,@now);

-- ---------- Press: naskah, buku, pesanan ----------
INSERT INTO manuscripts (id,user_id,title,authors,status,created_at,updated_at)
SELECT seq, 2+MOD(seq,5998), CONCAT('Naskah ', seq), '["Penulis"]', IF(seq<=5000,'completed',ELT(1+MOD(seq,3),'submitted','in_review','editing')), DATE_SUB(@now, INTERVAL MOD(seq,600) DAY), @now FROM seq_1_to_20000;
INSERT INTO manuscript_authors (manuscript_id,user_id,position,created_at,updated_at) SELECT seq, 2+MOD(seq,5998), 1, @now, @now FROM seq_1_to_5000;
COMMIT;
INSERT INTO books (id,manuscript_id,title,slug,authors_text,description,about,languages,price,discount,front_cover,is_active,created_by,created_at,updated_at,ebook_file,ebook_name,ebook_uploaded_at,ebook_pages)
SELECT seq, seq, CONCAT('Buku Uji Performa ', seq), CONCAT('buku-uji-performa-', seq), CONCAT('Penulis ', 2+MOD(seq,5998)),
  'Deskripsi buku uji performa yang cukup panjang untuk mensimulasikan isi nyata sebuah deskripsi buku di katalog.',
  'Tentang buku uji.', '["id"]', 50000+MOD(seq,50)*1000, MOD(seq,20), NULL, 1, 1, DATE_SUB(@now, INTERVAL MOD(seq,500) DAY), @now,
  IF(seq<=3000,'ebooks/perf/sample.pdf',NULL), IF(seq<=3000,'sample.pdf',NULL), IF(seq<=3000,@now,NULL), IF(seq<=3000,300,NULL)
FROM seq_1_to_5000;
COMMIT;

INSERT INTO orders (id,order_number,invoice_number,user_id,status,subtotal,discount_total,editor_fee,total,payment_method_id,created_at,updated_at)
SELECT seq, CONCAT('ORD-', seq), CONCAT('INV-', seq), 1+MOD(seq,100000), ELT(1+MOD(seq,4),'completed','confirmed','pending','completed'), 100000, 0, 0, 100000, 1+MOD(seq,3), DATE_SUB(@now, INTERVAL MOD(seq,700) DAY), @now FROM seq_1_to_60000;
INSERT INTO order_items (order_id,itemable_type,itemable_id,name,quantity,unit_price,subtotal,created_at,updated_at)
SELECT seq, 'App\\Models\\Book', 1+MOD(seq,5000), 'Buku', 1, 100000, 100000, @now, @now FROM seq_1_to_60000;
INSERT INTO user_notifications (user_id,category,title,body,link,read_at,created_at,updated_at)
SELECT 1+MOD(seq,100000), 'order', 'Pesanan diperbarui', 'Status pesanan berubah.', '/dashboard/pesanan', IF(MOD(seq,3)=0,@now,NULL), DATE_SUB(@now, INTERVAL MOD(seq,300) DAY), @now FROM seq_1_to_300000;
COMMIT;

-- ---------- Tartila Book ----------
INSERT INTO reader_terms (id,type,name,pustaka,created_at,updated_at) SELECT seq, ELT(1+MOD(seq,3),'education_field','category','genre'), CONCAT('Istilah ', seq), NULL, @now, @now FROM seq_1_to_30;
INSERT INTO reader_plans (name,period,price,is_active,created_at,updated_at) VALUES ('Harian','daily',5000,1,@now,@now),('Mingguan','weekly',20000,1,@now,@now),('Bulanan','monthly',50000,1,@now,@now),('Tahunan','yearly',500000,1,@now,@now);
INSERT INTO reader_books (id,book_id,is_published,pustaka,education_field_id,category_id,genre_id,age_limit,language,version,price,access_days,read_events,created_at,updated_at)
SELECT seq, seq, 1, IF(MOD(seq,2)=0,'fiksi','non_fiksi'), 1+MOD(seq,10)*3, 2+MOD(seq,10)*3, 3+MOD(seq,10)*3, 'all', 'id', 1, 15000+MOD(seq,10)*5000, 30, 0, DATE_SUB(@now, INTERVAL MOD(seq,400) DAY), @now FROM seq_1_to_3000;
INSERT INTO reader_access_rules (reader_book_id,action,starts_at,ends_at,created_at,updated_at) SELECT seq,'open',DATE_SUB(@now, INTERVAL 1 DAY),DATE_ADD(@now, INTERVAL 30 DAY),@now,@now FROM seq_1_to_150;
COMMIT;

-- pembaca = user 100.001..1.100.000; buku populer di id kecil (sebaran miring)
INSERT INTO reader_orders (order_number,user_id,kind,reader_book_id,reader_plan_id,title,amount,status,payment_method_id,confirmed_at,created_at,updated_at)
SELECT CONCAT('RB-', seq), 100000+seq, IF(MOD(seq,5)=0,'plan','book'), IF(MOD(seq,5)=0,NULL,1+FLOOR(3000*POW(RAND(),3))), IF(MOD(seq,5)=0,1+MOD(seq,4),NULL), 'Pesanan uji', 20000, IF(MOD(seq,10)=0,'pending','confirmed'), 1+MOD(seq,3), DATE_SUB(@now, INTERVAL MOD(seq,300) DAY), DATE_SUB(@now, INTERVAL MOD(seq,300) DAY), @now FROM seq_1_to_400000;
INSERT INTO reader_entitlements (user_id,kind,reader_book_id,reader_plan_id,reader_order_id,starts_at,ends_at,created_at,updated_at)
SELECT user_id, kind, reader_book_id, reader_plan_id, id, DATE_SUB(@now, INTERVAL 3 DAY), DATE_ADD(@now, INTERVAL 20 DAY), @now, @now FROM reader_orders WHERE status='confirmed';
COMMIT;
INSERT IGNORE INTO reader_saves (user_id,reader_book_id,created_at) SELECT 100001+FLOOR(RAND()*1000000), 1+FLOOR(3000*POW(RAND(),3)), @now FROM seq_1_to_3000000;
INSERT IGNORE INTO reader_likes (user_id,reader_book_id,created_at) SELECT 100001+FLOOR(RAND()*1000000), 1+FLOOR(3000*POW(RAND(),3)), @now FROM seq_1_to_3000000;
COMMIT;
INSERT INTO reader_comments (reader_book_id,user_id,body,created_at,updated_at) SELECT 1+FLOOR(3000*POW(RAND(),3)), 100001+FLOOR(RAND()*1000000), 'Buku yang bagus sekali, sangat bermanfaat untuk dibaca.', DATE_SUB(@now, INTERVAL FLOOR(RAND()*300) DAY), @now FROM seq_1_to_600000;
INSERT INTO reader_bookmarks (user_id,reader_book_id,page,note,created_at,updated_at) SELECT 100001+FLOOR(RAND()*1000000), 1+FLOOR(3000*POW(RAND(),3)), 1+FLOOR(RAND()*300), 'catatan', @now, @now FROM seq_1_to_1500000;
COMMIT;
INSERT IGNORE INTO reader_progress (user_id,reader_book_id,last_page,last_read_at,created_at,updated_at) SELECT 100001+FLOOR(RAND()*1000000), 1+FLOOR(3000*POW(RAND(),3)), 1+FLOOR(RAND()*300), DATE_SUB(@now, INTERVAL FLOOR(RAND()*30) DAY), @now, @now FROM seq_1_to_4000000;
COMMIT;
-- 20 juta bacaan-halaman (kira-kira satu hari ramai: 1 juta pembaca x 20 halaman)
INSERT IGNORE INTO reader_page_reads (reader_book_id,user_id,page,read_date,counted,created_at) SELECT 1+FLOOR(3000*POW(RAND(),3)), 100001+FLOOR(RAND()*1000000), 1+FLOOR(RAND()*300), DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND()*3) DAY), 1, @now FROM seq_1_to_20000000;
COMMIT;
INSERT INTO reader_page_stats (reader_book_id,page,readers,events) SELECT reader_book_id, page, COUNT(DISTINCT user_id), COUNT(*) FROM reader_page_reads GROUP BY reader_book_id, page;
UPDATE reader_books rb SET read_events=(SELECT COALESCE(SUM(events),0) FROM reader_page_stats s WHERE s.reader_book_id=rb.id), top_page_readers=(SELECT COALESCE(MAX(readers),0) FROM reader_page_stats s WHERE s.reader_book_id=rb.id);
COMMIT;
SET UNIQUE_CHECKS=1; SET FOREIGN_KEY_CHECKS=1;
