import {
    useEffect,
    useRef,
    useState,
    type KeyboardEvent,
    type PointerEvent,
} from 'react';
import type {
    EditorMeta,
    TemplateField,
} from '@/data/certificate/certificateApi';
import { drawCertificate } from '@/lib/certificateCanvas';
import { pageSizePt } from '@/lib/certificateLayout';

type DragState = {
    id: string;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origin: { x: number; y: number; w: number; h: number };
};

type CertificateStageProps = {
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    fields: TemplateField[];
    /** Values for the {tokens} in the field texts. */
    values: Record<string, string>;
    meta: EditorMeta;
    /** Changes whenever a font finishes loading, to redraw. */
    fontsVersion: number;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onChange: (id: string, patch: Partial<TemplateField>) => void;
};

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const round = (value: number) => Math.round(value * 10000) / 10000;

/**
 * The template image with its text fields drawn on a canvas (same layout as
 * the PDF), and a transparent box over every field that can be dragged to
 * move and resized from its bottom-right corner.
 */
export default function CertificateStage({
    imageUrl,
    imageWidth,
    imageHeight,
    fields,
    values,
    meta,
    fontsVersion,
    selectedId,
    onSelect,
    onChange,
}: CertificateStageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dragRef = useRef<DragState | null>(null);

    const [width, setWidth] = useState<number>(0);
    const [image, setImage] = useState<HTMLImageElement | null>(null);

    const { width: pageWidth, height: pageHeight } = pageSizePt(
        imageWidth,
        imageHeight,
        meta.layout.page_long_side_pt
    );
    const height = (width * imageHeight) / imageWidth;

    useEffect(() => {
        const element = containerRef.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            setWidth(entries[0].contentRect.width);
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let cancelled = false;
        const next = new Image();

        next.onload = () => {
            if (!cancelled) {
                setImage(next);
            }
        };
        next.src = imageUrl;

        return () => {
            cancelled = true;
            next.onload = null;
        };
    }, [imageUrl]);

    useEffect(() => {
        const canvas = canvasRef.current;

        if (!canvas || width === 0) {
            return;
        }

        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);

        const context = canvas.getContext('2d');

        if (!context) {
            return;
        }

        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        drawCertificate(context, {
            image,
            width,
            height,
            page: { width: pageWidth, height: pageHeight },
            fields,
            values,
            fonts: meta.fonts,
            defaultFont: meta.default_font,
            config: meta.layout,
        });
        // `fontsVersion` has no use in the body: it only triggers the redraw.
    }, [
        image,
        width,
        height,
        pageWidth,
        pageHeight,
        fields,
        values,
        meta,
        fontsVersion,
    ]);

    function startDrag(
        event: PointerEvent<HTMLElement>,
        field: TemplateField,
        mode: DragState['mode']
    ) {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);

        onSelect(field.id);

        dragRef.current = {
            id: field.id,
            mode,
            startX: event.clientX,
            startY: event.clientY,
            origin: { x: field.x, y: field.y, w: field.w, h: field.h },
        };
    }

    function handleMove(event: PointerEvent<HTMLElement>) {
        const drag = dragRef.current;

        if (!drag || width === 0) {
            return;
        }

        const dx = (event.clientX - drag.startX) / width;
        const dy = (event.clientY - drag.startY) / height;
        const { origin } = drag;

        if (drag.mode === 'move') {
            onChange(drag.id, {
                x: round(clamp(origin.x + dx, 0, 1 - origin.w)),
                y: round(clamp(origin.y + dy, 0, 1 - origin.h)),
            });

            return;
        }

        onChange(drag.id, {
            w: round(clamp(origin.w + dx, 0.02, 1 - origin.x)),
            h: round(clamp(origin.h + dy, 0.01, 1 - origin.y)),
        });
    }

    function endDrag(event: PointerEvent<HTMLElement>) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        dragRef.current = null;
    }

    function handleKeyDown(
        event: KeyboardEvent<HTMLElement>,
        field: TemplateField
    ) {
        const step = event.shiftKey ? 0.01 : 0.001;
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
        };
        const move = moves[event.key];

        if (!move) {
            return;
        }

        event.preventDefault();
        onChange(field.id, {
            x: round(clamp(field.x + move[0], 0, 1 - field.w)),
            y: round(clamp(field.y + move[1], 0, 1 - field.h)),
        });
    }

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg bg-white ring-1 ring-forest-moss-200 select-none"
            style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
        >
            <canvas
                ref={canvasRef}
                className="absolute inset-0 h-full w-full"
                aria-hidden
            />

            <div
                className="absolute inset-0"
                onPointerDown={() => onSelect(null)}
            >
                {fields.map((field, index) => {
                    const isSelected = field.id === selectedId;

                    return (
                        <div
                            key={field.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Kolom teks ${index + 1}`}
                            aria-pressed={isSelected}
                            onPointerDown={(event) =>
                                startDrag(event, field, 'move')
                            }
                            onPointerMove={handleMove}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                            onKeyDown={(event) => handleKeyDown(event, field)}
                            onFocus={() => onSelect(field.id)}
                            className={`absolute cursor-move touch-none outline-none ${
                                isSelected
                                    ? 'border-2 border-forest-moss-600 bg-forest-moss-500/10'
                                    : 'border border-dashed border-forest-moss-600/60 hover:bg-forest-moss-500/10'
                            }`}
                            style={{
                                left: `${field.x * 100}%`,
                                top: `${field.y * 100}%`,
                                width: `${field.w * 100}%`,
                                height: `${field.h * 100}%`,
                            }}
                        >
                            {isSelected && (
                                <span
                                    onPointerDown={(event) =>
                                        startDrag(event, field, 'resize')
                                    }
                                    onPointerMove={handleMove}
                                    onPointerUp={endDrag}
                                    onPointerCancel={endDrag}
                                    className="absolute -right-1.5 -bottom-1.5 size-3.5 cursor-nwse-resize touch-none rounded-sm border-2 border-white bg-forest-moss-600"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
