import { useRef, useState } from 'react';
import Button from '@/components/Button/Button';

const WIDTH = 520;
const HEIGHT = 200;

/**
 * Kanvas tanda tangan (mouse / sentuh). `onSave` menerima data URL PNG
 * transparan; `disabled` mengunci kanvas.
 */
export default function SignaturePad({
    onSave,
    isSaving,
    label = 'Tanda tangani surat',
    disabled = false,
}: {
    onSave: (dataUrl: string) => void;
    isSaving: boolean;
    label?: string;
    // Tombol simpan terkunci (mis. pernyataan MOU belum dicentang).
    disabled?: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef<boolean>(false);
    const [hasInk, setHasInk] = useState<boolean>(false);

    function point(event: React.PointerEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;

        if (!canvas) {
            return { x: 0, y: 0 };
        }

        const rect = canvas.getBoundingClientRect();

        return {
            x: ((event.clientX - rect.left) / rect.width) * WIDTH,
            y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
        };
    }

    function start(event: React.PointerEvent<HTMLCanvasElement>) {
        const context = canvasRef.current?.getContext('2d');

        if (!context) {
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = true;

        const { x, y } = point(event);
        context.lineWidth = 2.6;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#0b1f3a';
        context.beginPath();
        context.moveTo(x, y);
        // titik tunggal juga terlihat
        context.lineTo(x + 0.01, y + 0.01);
        context.stroke();
    }

    function move(event: React.PointerEvent<HTMLCanvasElement>) {
        const context = canvasRef.current?.getContext('2d');

        if (!drawing.current || !context) {
            return;
        }

        const { x, y } = point(event);
        context.lineTo(x, y);
        context.stroke();
        setHasInk(true);
    }

    function stop() {
        drawing.current = false;
    }

    function clear() {
        canvasRef.current?.getContext('2d')?.clearRect(0, 0, WIDTH, HEIGHT);
        setHasInk(false);
    }

    return (
        <div className="flex flex-col gap-3">
            <canvas
                ref={canvasRef}
                width={WIDTH}
                height={HEIGHT}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={stop}
                onPointerCancel={stop}
                aria-label="Kanvas tanda tangan"
                className="w-full max-w-lg touch-none rounded-xl border border-dashed border-oxford-navy-900/30 bg-white"
            />
            <div className="flex flex-row gap-2">
                <Button variant="outline2" onClick={clear} disabled={!hasInk}>
                    Hapus
                </Button>
                <Button
                    variant="primary"
                    disabled={!hasInk || isSaving || disabled}
                    onClick={() => {
                        const canvas = canvasRef.current;

                        if (canvas) {
                            onSave(canvas.toDataURL('image/png'));
                        }
                    }}
                >
                    {isSaving ? 'Menyimpan...' : label}
                </Button>
            </div>
        </div>
    );
}
