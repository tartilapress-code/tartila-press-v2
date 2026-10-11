import { useState } from 'react';
import type { RevenuePoint } from '@/data/finance/financeApi';
import { rupiah, rupiahCompact } from './format';

const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 28, left: 64 };

/** Batas atas sumbu yang "bulat" (1, 2, 2.5, 5 × 10^n). */
function niceMax(value: number): number {
    if (value <= 0) return 100000;

    const power = 10 ** Math.floor(Math.log10(value));

    for (const step of [1, 2, 2.5, 5, 10]) {
        if (value <= step * power) return step * power;
    }

    return 10 * power;
}

/** Grafik batang omzet (SVG, tanpa pustaka tambahan). */
export default function RevenueChart({
    points,
    title,
}: {
    points: RevenuePoint[];
    title: string;
}) {
    const [active, setActive] = useState<number | null>(null);

    const max = niceMax(Math.max(0, ...points.map((point) => point.amount)));
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const slot = plotWidth / Math.max(1, points.length);
    const barWidth = Math.max(2, Math.min(36, slot * 0.7));
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max);
    // Label sumbu-x dijarangkan kalau batangnya banyak (harian).
    const labelEvery = points.length > 16 ? Math.ceil(points.length / 12) : 1;
    const total = points.reduce((sum, point) => sum + point.amount, 0);
    const focus = active !== null ? points[active] : null;

    return (
        <figure className="flex flex-col gap-2">
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-oxford-navy-900">
                    {title}
                </span>
                <span className="text-oxford-navy-900/70">
                    {focus
                        ? `${focus.period}: ${rupiah(focus.amount)} (${focus.count} pesanan)`
                        : `Total ${rupiah(total)}`}
                </span>
            </figcaption>

            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="h-auto w-full"
                role="img"
                aria-label={`${title}, total ${rupiah(total)}`}
                onMouseLeave={() => setActive(null)}
            >
                {ticks.map((tick) => {
                    const y = PAD.top + plotHeight - (tick / max) * plotHeight;

                    return (
                        <g key={tick}>
                            <line
                                x1={PAD.left}
                                x2={WIDTH - PAD.right}
                                y1={y}
                                y2={y}
                                className="stroke-forest-moss-100"
                            />
                            <text
                                x={PAD.left - 8}
                                y={y + 4}
                                textAnchor="end"
                                className="fill-oxford-navy-900/60 text-[11px]"
                            >
                                {rupiahCompact(tick)}
                            </text>
                        </g>
                    );
                })}

                {points.map((point, index) => {
                    const height = (point.amount / max) * plotHeight;
                    const x = PAD.left + index * slot + (slot - barWidth) / 2;
                    const y = PAD.top + plotHeight - height;

                    return (
                        <g
                            key={point.period}
                            onMouseEnter={() => setActive(index)}
                            onFocus={() => setActive(index)}
                            tabIndex={0}
                            aria-label={`${point.period}: ${rupiah(point.amount)}`}
                        >
                            <rect
                                x={PAD.left + index * slot}
                                y={PAD.top}
                                width={slot}
                                height={plotHeight}
                                className={
                                    active === index
                                        ? 'fill-forest-moss-50'
                                        : 'fill-transparent'
                                }
                            />
                            <rect
                                x={x}
                                y={y}
                                width={barWidth}
                                height={Math.max(
                                    height,
                                    point.amount > 0 ? 1 : 0
                                )}
                                rx={Math.min(4, barWidth / 3)}
                                className={
                                    active === index
                                        ? 'fill-oxford-navy-700'
                                        : 'fill-forest-moss-600'
                                }
                            />
                            {index % labelEvery === 0 && (
                                <text
                                    x={PAD.left + index * slot + slot / 2}
                                    y={HEIGHT - 8}
                                    textAnchor="middle"
                                    className="fill-oxford-navy-900/70 text-[11px]"
                                >
                                    {point.label}
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            <table className="sr-only">
                <caption>{title}</caption>
                <tbody>
                    {points.map((point) => (
                        <tr key={point.period}>
                            <th scope="row">{point.period}</th>
                            <td>{rupiah(point.amount)}</td>
                            <td>{point.count} pesanan</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}
