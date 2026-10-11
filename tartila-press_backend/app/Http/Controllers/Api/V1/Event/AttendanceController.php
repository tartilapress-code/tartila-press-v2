<?php

namespace App\Http\Controllers\Api\V1\Event;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\EventAttendance;
use App\Models\EventAttendanceField;
use App\Models\EventRegistration;
use App\Services\CertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AttendanceController extends Controller
{
    public function __construct(private readonly CertificateService $certificates) {}

    /*
    |--------------------------------------------------------------------------
    | Show - Formulir absensi, statusnya, dan jawaban peserta kalau sudah absen
    |--------------------------------------------------------------------------
    */

    public function show(Request $request, Event $event): JsonResponse
    {
        $registration = $this->confirmedRegistration($request, $event);
        abort_unless($event->attendance_enabled, 404, 'Event ini tidak memakai absensi.');

        $attendance = $registration->attendance;

        if ($attendance) {
            $this->certificates->issueForAttendance($attendance->setRelation('event', $event));
        }

        return response()->json([
            'success' => true,
            'message' => 'Absensi event berhasil diambil.',
            'data' => $this->payload($event, $attendance),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Store - Peserta mengisi absensi (sekali, selama jendela waktunya buka)
    |--------------------------------------------------------------------------
    */

    public function store(Request $request, Event $event): JsonResponse
    {
        $registration = $this->confirmedRegistration($request, $event);
        abort_unless($event->attendance_enabled, 404, 'Event ini tidak memakai absensi.');

        $state = $event->attendanceState();

        abort_if($state === 'upcoming', 422, 'Absensi belum dibuka.');
        abort_if($state === 'closed', 422, 'Absensi sudah ditutup.');
        abort_if($registration->attendance()->exists(), 422, 'Anda sudah mengisi absensi untuk event ini.');

        $fields = $event->attendanceFields()->get();

        [$rules, $attributes] = $this->answerRules($fields);

        $validated = $request->validate(
            ['answers' => ['array'], ...$rules],
            [
                'required' => ':attribute wajib diisi.',
                'accepted' => ':attribute harus dicentang.',
                'in' => 'Pilihan pada :attribute tidak valid.',
                'email' => ':attribute harus berupa alamat email yang valid.',
                'numeric' => ':attribute harus berupa angka.',
                'date' => ':attribute harus berupa tanggal yang valid.',
                'max' => ':attribute terlalu panjang.',
                'regex' => ':attribute tidak valid.',
            ],
            $attributes
        );

        $answers = $this->normalizeAnswers($fields, $validated['answers'] ?? []);

        $attendance = DB::transaction(function () use ($event, $registration, $answers, $request) {
            $attendance = EventAttendance::create([
                'event_id' => $event->id,
                'event_registration_id' => $registration->id,
                'user_id' => $request->user()->id,
                'answers' => $answers,
                'submitted_at' => now(),
            ]);

            $this->certificates->issueForAttendance($attendance->setRelation('event', $event));

            return $attendance;
        });

        return response()->json([
            'success' => true,
            'message' => 'Absensi berhasil dicatat.',
            'data' => $this->payload($event, $attendance->fresh()),
        ], 201);
    }

    private function confirmedRegistration(Request $request, Event $event): EventRegistration
    {
        $registration = EventRegistration::query()
            ->where('event_id', $event->id)
            ->where('user_id', $request->user()->id)
            ->where('status', 'confirmed')
            ->first();

        abort_unless($registration, 403, 'Absensi hanya untuk peserta yang pendaftarannya sudah terkonfirmasi.');

        return $registration;
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Event $event, ?EventAttendance $attendance): array
    {
        $certificate = $attendance?->certificate;

        return [
            'event' => [
                'id' => $event->id,
                'slug' => $event->slug,
                'title' => $event->title,
                'starts_at' => $event->starts_at,
                'ends_at' => $event->ends_at,
            ],
            'state' => $event->attendanceState(),
            'opens_at' => $event->attendance_opens_at,
            'closes_at' => $event->attendance_closes_at,
            'fields' => $event->attendanceFields()->get(),
            'submitted' => $attendance !== null,
            'submitted_at' => $attendance?->submitted_at,
            'answers' => $attendance?->answers,
            'has_certificate_template' => $event->certificate_template_id !== null,
            'certificate' => $certificate ? ['id' => $certificate->id, 'number' => $certificate->number] : null,
        ];
    }

    /**
     * Aturan validasi jawaban sesuai kolom yang dibuat admin, beserta nama
     * tampilnya (label kolom) untuk pesan galat.
     *
     * @param  Collection<int, EventAttendanceField>  $fields
     * @return array{0: array<string, array<int, mixed>>, 1: array<string, string>}
     */
    private function answerRules($fields): array
    {
        $rules = [];
        $attributes = [];

        foreach ($fields as $field) {
            $name = "answers.{$field->key}";
            $attributes[$name] = $field->label;

            if ($field->type === 'checkbox') {
                $rules[$name] = [$field->required ? 'accepted' : 'nullable', 'boolean'];

                continue;
            }

            $rules[$name] = [$field->required ? 'required' : 'nullable', ...match ($field->type) {
                'textarea' => ['string', 'max:2000'],
                'number' => ['numeric', 'between:-999999999999,999999999999'],
                'email' => ['email', 'max:255'],
                'phone' => ['string', 'regex:/^[0-9+()\-\s]{6,20}$/'],
                'date' => ['date_format:Y-m-d'],
                'select', 'radio' => ['string', Rule::in($field->options ?? [])],
                default => ['string', 'max:255'],
            }];
        }

        return [$rules, $attributes];
    }

    /**
     * Hanya jawaban untuk kolom yang ada, dengan tipe data yang rapi.
     *
     * @param  Collection<int, EventAttendanceField>  $fields
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function normalizeAnswers($fields, array $input): array
    {
        $answers = [];

        foreach ($fields as $field) {
            $value = $input[$field->key] ?? null;

            $answers[$field->key] = match (true) {
                $field->type === 'checkbox' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
                $value === null => '',
                default => trim((string) $value),
            };
        }

        return $answers;
    }
}
