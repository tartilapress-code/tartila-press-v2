for u in "dashboard/summary" "admin/finance/summary" "admin/orders?per_page=20" "admin/reader/orders?per_page=20" "admin/books?per_page=20" "admin/reader/books?per_page=20" "admin/reader/royalties?from=2026-10-12&to=2026-10-12" "admin/finance/transactions" "admin/users?per_page=20" "admin/royalties"; do
  curl -s -o /dev/null -w "%{http_code} %{time_total}s %{size_download}B  $u\n" -H "Accept: application/json" -H "Authorization: Bearer 1|perf1" "http://localhost:8090/api/v1/$u"
done
