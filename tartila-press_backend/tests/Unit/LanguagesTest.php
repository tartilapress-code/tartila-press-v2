<?php

namespace Tests\Unit;

use App\Casts\LanguageList;
use App\Support\Languages;
use Illuminate\Database\Eloquent\Model;
use PHPUnit\Framework\TestCase;

class LanguagesTest extends TestCase
{
    public function test_normalize_drops_unknown_codes_merges_duplicates_and_follows_the_catalog_order(): void
    {
        $this->assertSame(['id', 'en', 'ar'], Languages::normalize(['ar', 'en', 'xx', 'id', 'EN', ' id ']));
        $this->assertSame([], Languages::normalize([]));
        $this->assertSame([], Languages::normalize(null));
        $this->assertSame([], Languages::normalize('id'));
        $this->assertSame([], Languages::normalize([1, null, ['id']]));
    }

    public function test_parse_delimited_reads_semicolons_pipes_and_commas(): void
    {
        $this->assertSame(
            ['languages' => ['id', 'en', 'ms'], 'unknown' => []],
            Languages::parseDelimited('ms; en | id')
        );

        $this->assertSame(
            ['languages' => ['id'], 'unknown' => ['xx', 'yy']],
            Languages::parseDelimited('id,xx;yy')
        );

        $this->assertSame(['languages' => [], 'unknown' => []], Languages::parseDelimited(null));
        $this->assertSame(['languages' => [], 'unknown' => []], Languages::parseDelimited(' ; '));
    }

    public function test_the_catalog_has_no_duplicate_or_blank_codes(): void
    {
        $this->assertSame(Languages::CODES, array_values(array_unique(Languages::CODES)));

        foreach (Languages::CODES as $code) {
            $this->assertMatchesRegularExpression('/^[a-z]{2,3}$/', $code);
        }
    }

    public function test_the_cast_reads_json_as_an_array_and_writes_normalized_json(): void
    {
        $cast = new LanguageList;
        $model = new class extends Model {};

        $this->assertSame([], $cast->get($model, 'languages', null, []));
        $this->assertSame([], $cast->get($model, 'languages', '', []));
        $this->assertSame([], $cast->get($model, 'languages', 'not json', []));
        $this->assertSame(['id', 'en'], $cast->get($model, 'languages', '["en","id","zz"]', []));

        $this->assertNull($cast->set($model, 'languages', null, []));
        $this->assertSame('[]', $cast->set($model, 'languages', [], []));
        $this->assertSame('["id","en"]', $cast->set($model, 'languages', ['en', 'id', 'id'], []));
    }
}
