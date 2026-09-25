<?php

namespace App\Http\Controllers;

abstract class Controller
{
    /**
     * Every money/price column in this app is decimal(12,2) - this is the
     * largest value that fits without a Postgres numeric field overflow.
     */
    public const MAX_MONEY_AMOUNT = 9999999999.99;
}
