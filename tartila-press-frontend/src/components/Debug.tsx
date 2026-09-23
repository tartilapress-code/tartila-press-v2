import type React from 'react';
import { useState } from 'react';

export default function CssDebug(): React.ReactNode {
    const [isDebug, setIsDebug] = useState<boolean>(false);

    return (
        <div
            className={`
                absolute top-5 right-5 p-2 bg-white rounded-sm border border-black
                ${isDebug ? 'debug' : ''}
                `}
            onClick={() => setIsDebug(!isDebug)}
        >
            <h5 className="text-black font-semibold">
                Debug Mode{' '}
                {isDebug && (
                    <span className="bg-green-500 p-1 rounded-full">on</span>
                )}
            </h5>
        </div>
    );
}
