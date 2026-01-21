import React from 'react';

interface NeexumLogoProps {
    className?: string;
    showText?: boolean;
}

export const NeexumLogo: React.FC<NeexumLogoProps> = ({ className = "h-12 w-12", showText = false }) => {
    return (
        <div className={`inline-flex items-center gap-3 ${className}`}>
            <svg
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-full w-auto drop-shadow-2xl"
            >
                <defs>
                    <linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0a2540" />
                        <stop offset="100%" stopColor="#1e3a8a" />
                    </linearGradient>
                    <linearGradient id="tealGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#42a5a5" />
                        <stop offset="100%" stopColor="#2dd4bf" />
                    </linearGradient>
                </defs>

                {/* Navy Arrow (Down-Left) */}
                <path
                    d="M75 25L25 75M25 75L45 75M25 75L25 55"
                    stroke="url(#navyGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Teal Arrow (Up-Right) */}
                <path
                    d="M40 35L60 15M60 15L40 15M60 15L60 35"
                    stroke="url(#tealGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {/* Interlocking Connection */}
                <path
                    d="M45 55L55 45"
                    stroke="#0a2540"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeOpacity="0.3"
                />
            </svg>
            {showText && (
                <div className="flex flex-col">
                    <span className="text-3xl font-black italic tracking-tighter text-[#0a2540] leading-none">
                        NEE<span className="text-[#42a5a5]">XUM</span>
                    </span>
                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-1">
                        Núcleo Empresarial de EXpedición Unificada
                    </span>
                </div>
            )}
        </div>
    );
};
