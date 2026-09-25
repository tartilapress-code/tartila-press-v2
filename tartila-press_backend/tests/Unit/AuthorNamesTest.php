<?php

namespace Tests\Unit;

use App\Support\AuthorNames;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class AuthorNamesTest extends TestCase
{
    /**
     * @return array<string, array{0: array<int, string>, 1: list<string>}>
     */
    public static function listCases(): array
    {
        return [
            'gelar tersimpan sebagai entri sendiri (kasus data asli)' => [
                ['Rahima Tartila', 'S.T'], ['Rahima Tartila'],
            ],
            'gelar tanpa titik sebagai entri sendiri' => [
                ['Rahima Tartila', 'ST'], ['Rahima Tartila'],
            ],
            'gelar setelah koma dalam satu entri' => [
                ['Rahima Tartila, S.T'], ['Rahima Tartila'],
            ],
            'dua penulis dengan gelar masing-masing' => [
                ['Rahima Tartila, S.T, Medi Rahmat, M.T.'], ['Rahima Tartila', 'Medi Rahmat'],
            ],
            'gelar menempel di belakang nama' => [
                ['Budi Santoso S.Kom., M.T.'], ['Budi Santoso'],
            ],
            'sapaan di depan dan gelar di belakang' => [
                ['Dr. Ani Wijaya, M.Pd.'], ['Ani Wijaya'],
            ],
            'sapaan bertumpuk dan gelar asing' => [
                ['Prof. Dr. Ir. Siti Aminah, M.Sc., Ph.D.'], ['Siti Aminah'],
            ],
            'pemisah dan / & / titik koma' => [
                ['Ani dan Budi', 'Citra & Dedi; Eka'], ['Ani', 'Budi', 'Citra', 'Dedi', 'Eka'],
            ],
            'nama ganda hanya dihitung sekali (tanpa memperhatikan huruf besar)' => [
                ['Rahima Tartila', 'Rahima Tartila', 'rahima tartila'], ['Rahima Tartila'],
            ],
            'inisial di depan nama tidak terbuang' => [
                ['A. Fuadi'], ['A. Fuadi'],
            ],
            'inisial di belakang nama tidak dianggap gelar' => [
                ['Habibie B.J.'], ['Habibie B.J.'],
            ],
            'satu nama tanpa spasi tetap dipertahankan' => [
                ['Pramoedya'], ['Pramoedya'],
            ],
            'nama biasa tanpa gelar tidak berubah' => [
                ['Penulis Uji', 'Penulis Kedua'], ['Penulis Uji', 'Penulis Kedua'],
            ],
            'entri kosong dan bukan teks diabaikan' => [
                ['', '   ', 'Ani'], ['Ani'],
            ],
            'entri yang hanya berisi gelar dibuang seluruhnya' => [
                ['S.T', 'M.Kom.', 'Dr.'], [],
            ],
        ];
    }

    /**
     * @param  array<int, string>  $entries
     * @param  list<string>  $expected
     */
    #[DataProvider('listCases')]
    public function test_from_list_strips_degrees_and_duplicates(array $entries, array $expected): void
    {
        $this->assertSame($expected, AuthorNames::fromList($entries));
    }

    public function test_from_list_ignores_non_string_entries(): void
    {
        $this->assertSame(['Ani'], AuthorNames::fromList(['Ani', null, 12, ['x']]));
    }

    public function test_from_text_parses_a_free_text_authors_field(): void
    {
        $this->assertSame(['Rahima Tartila'], AuthorNames::fromText('Rahima Tartila, S.T'));
        $this->assertSame([], AuthorNames::fromText(null));
        $this->assertSame([], AuthorNames::fromText(''));
    }
}
