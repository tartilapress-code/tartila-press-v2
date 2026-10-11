<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\CertificateTemplate;
use App\Models\Event;
use App\Models\EventAttendance;
use App\Models\EventAttendanceField;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EventAttendanceController extends Controller
{
    private const MAX_FIELDS = 25;

    /*
    |--------------------------------------------------------------------------
    | Show - Pengaturan absensi + kolom formulirnya
    |--------------------------------------------------------------------------
    */

    public function show(Event $event): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Pengaturan absensi berhasil diambil.',
            'data' => $this->payload($event),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Update - Simpan pengaturan absensi dan seluruh daftar kolom sekaligus
    |--------------------------------------------------------------------------
    | Kolom yang membawa `id` milik event ini diperbarui (kuncinya tetap,
    | supaya jawaban lama tidak yatim), kolom tanpa id dibuat baru, dan kolom
    | yang tidak ada di daftar dihapus.
    */

    public function update(Request $request, Event $event): JsonResponse
    {
        $validated = $request->validate([
            'attendance_enabled' => ['required', 'boolean'],
            'attendance_opens_at' => ['nullable', 'date', 'required_if:attendance_enabled,true,1'],
            'attendance_closes_at' => ['nullable', 'date', 'after:attendance_opens_at', 'required_if:attendance_enabled,true,1'],
            'certificate_template_id' => [
                'nullable',
                'integer',
                Rule::exists('certificate_templates', 'id')->where('type', CertificateTemplate::TYPE_EVENT),
            ],
            'fields' => ['present', 'array', 'max:'.self::MAX_FIELDS],
            'fields.*.id' => ['nullable', 'integer'],
            'fields.*.label' => ['required', 'string', 'max:150'],
            'fields.*.type' => ['required', Rule::in(EventAttendanceField::TYPES)],
            'fields.*.required' => ['sometimes', 'boolean'],
            'fields.*.options' => ['nullable', 'array', 'max:30'],
            'fields.*.options.*' => ['nullable', 'string', 'max:150'],
            'fields.*.help_text' => ['nullable', 'string', 'max:255'],
        ], [
            'attendance_opens_at.required_if' => 'Waktu mulai absensi wajib diisi.',
            'attendance_closes_at.required_if' => 'Waktu selesai absensi wajib diisi.',
            'attendance_closes_at.after' => 'Waktu selesai absensi harus setelah waktu mulainya.',
            'fields.*.label.required' => 'Setiap kolom absensi harus punya label.',
        ]);

        foreach ($validated['fields'] as $index => $field) {
            if (in_array($field['type'], EventAttendanceField::CHOICE_TYPES, true)
                && count($this->cleanOptions($field['options'] ?? [])) < 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'Kolom "'.$field['label'].'" butuh minimal 2 pilihan.',
                    'errors' => ["fields.{$index}.options" => ['Isi minimal 2 pilihan.']],
                ], 422);
            }
        }

        DB::transaction(function () use ($event, $validated) {
            $event->update([
                'attendance_enabled' => $validated['attendance_enabled'],
                'attendance_opens_at' => $validated['attendance_opens_at'] ?? null,
                'attendance_closes_at' => $validated['attendance_closes_at'] ?? null,
                'certificate_template_id' => $validated['certificate_template_id'] ?? null,
            ]);

            $existing = $event->attendanceFields()->get()->keyBy('id');
            $usedKeys = $existing->pluck('key')->all();
            $keep = [];

            foreach ($validated['fields'] as $position => $field) {
                $attributes = [
                    'label' => $field['label'],
                    'type' => $field['type'],
                    'options' => in_array($field['type'], EventAttendanceField::CHOICE_TYPES, true)
                        ? $this->cleanOptions($field['options'] ?? [])
                        : null,
                    'required' => $field['required'] ?? true,
                    'help_text' => $field['help_text'] ?? null,
                    'sort_order' => $position,
                ];

                $current = isset($field['id']) ? $existing->get($field['id']) : null;

                if ($current) {
                    $current->update($attributes);
                    $keep[] = $current->id;

                    continue;
                }

                $key = $this->uniqueKey($field['label'], $usedKeys);
                $usedKeys[] = $key;

                $keep[] = $event->attendanceFields()->create($attributes + ['key' => $key])->id;
            }

            $event->attendanceFields()->whereNotIn('id', $keep)->delete();
        });

        return response()->json([
            'success' => true,
            'message' => 'Pengaturan absensi berhasil disimpan.',
            'data' => $this->payload($event->fresh()),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Attendances - Peserta yang sudah mengisi absensi
    |--------------------------------------------------------------------------
    */

    public function attendances(Event $event): JsonResponse
    {
        $attendances = $event->attendances()
            ->with(['user:id,name,email', 'certificate:id,event_attendance_id,number'])
            ->latest('submitted_at')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Daftar absensi berhasil diambil.',
            'data' => $attendances,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Export - Unduh absensi sebagai CSV
    |--------------------------------------------------------------------------
    */

    public function export(Event $event): StreamedResponse
    {
        $fields = $event->attendanceFields()->get();
        $attendances = $event->attendances()
            ->with(['user:id,name,email', 'certificate:id,event_attendance_id,number'])
            ->orderBy('submitted_at')
            ->get();

        $filename = 'absensi-'.Str::limit(Str::slug($event->title), 60, '').'.csv';

        return response()->streamDownload(function () use ($fields, $attendances) {
            $out = fopen('php://output', 'w');
            // BOM supaya Excel membaca UTF-8.
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, array_merge(
                ['Nama', 'Email', 'Waktu absen', 'Nomor sertifikat'],
                $fields->pluck('label')->all()
            ));

            foreach ($attendances as $attendance) {
                $row = [
                    $attendance->user->name,
                    $attendance->user->email,
                    $attendance->submitted_at->copy()->setTimezone(config('certificates.timezone'))->format('Y-m-d H:i'),
                    $attendance->certificate?->number ?? '',
                ];

                foreach ($fields as $field) {
                    $row[] = $attendance->answers[$field->key] ?? '';
                }

                fputcsv($out, array_map(fn ($cell) => $this->csvCell($cell), $row));
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            // Frontend membaca nama berkas dari header ini (lintas origin).
            'Access-Control-Expose-Headers' => 'Content-Disposition',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Destroy attendance - Hapus absensi (peserta bisa mengisi ulang)
    |--------------------------------------------------------------------------
    */

    public function destroyAttendance(Event $event, EventAttendance $attendance): JsonResponse
    {
        abort_unless($attendance->event_id === $event->id, 404);

        $attendance->delete();

        return response()->json([
            'success' => true,
            'message' => 'Absensi berhasil dihapus.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Event $event): array
    {
        return [
            'event' => [
                'id' => $event->id,
                'slug' => $event->slug,
                'title' => $event->title,
                'starts_at' => $event->starts_at,
                'ends_at' => $event->ends_at,
            ],
            'attendance_enabled' => $event->attendance_enabled,
            'attendance_opens_at' => $event->attendance_opens_at,
            'attendance_closes_at' => $event->attendance_closes_at,
            'certificate_template_id' => $event->certificate_template_id,
            'state' => $event->attendanceState(),
            'fields' => $event->attendanceFields()->get(),
            'attendance_count' => $event->attendances()->count(),
            'confirmed_registrations_count' => $event->registrations()->where('status', 'confirmed')->count(),
        ];
    }

    /**
     * @param  array<int, mixed>  $options
     * @return list<string>
     */
    private function cleanOptions(array $options): array
    {
        return array_values(array_unique(array_filter(
            array_map(fn ($option) => trim((string) $option), $options),
            fn (string $option) => $option !== ''
        )));
    }

    /**
     * Kunci kolom dari labelnya (answer_<kunci> di sertifikat): huruf kecil,
     * angka, garis bawah; unik di dalam event.
     *
     * @param  list<string>  $used
     */
    private function uniqueKey(string $label, array $used): string
    {
        $base = Str::limit(Str::slug($label, '_'), 40, '') ?: 'kolom';
        $key = $base;
        $counter = 2;

        while (in_array($key, $used, true)) {
            $key = $base.'_'.$counter++;
        }

        return $key;
    }

    /**
     * Mencegah CSV injection: sel yang diawali = + - @ dibuat teks biasa.
     */
    private function csvCell(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? 'Ya' : 'Tidak';
        }

        $text = is_array($value) ? implode(', ', $value) : (string) $value;

        return preg_match('/^[=+\-@\t\r]/', $text) === 1 ? "'".$text : $text;
    }
}
