import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface VibrantBackgroundProps {
    className?: string;
    children?: React.ReactNode;
}

export function VibrantBackground({ className, children }: VibrantBackgroundProps) {
    const { theme } = useTheme();

    return (
        <div className={cn("min-h-screen w-full relative overflow-hidden transition-colors duration-700", className)}>
            {/* Dynamic SVG Background */}
            <div className="fixed inset-0 w-full h-full pointer-events-none select-none z-0">
                {theme === 'light' ? (
                    <svg className="w-full h-full opacity-90" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
                        <defs>
                            <linearGradient id="warmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#fdfcfb" />
                                <stop offset="100%" stopColor="#f7f3ed" />
                            </linearGradient>
                            <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="50" />
                            </filter>
                        </defs>
                        <rect width="1440" height="900" fill="url(#warmGrad)" />

                        {/* Organic Waves Emulating provided reference */}
                        <g filter="url(#softBlur)" opacity="0.4">
                            <path d="M-100,300 C300,150 400,600 900,450 C1200,350 1500,600 1700,500 L1700,900 L-100,900 Z" fill="#e9e3d5" />
                            <path d="M-200,600 C200,500 600,800 1000,650 C1400,500 1600,700 1800,600 L1800,1000 L-200,1000 Z" fill="#dfd6c5" opacity="0.4" />
                            <path d="M1200,100 C1000,0 800,200 600,100 C400,0 200,200 0,100 L0,-100 L1200,-100 Z" fill="#f0ede6" opacity="0.5" />
                        </g>
                    </svg>
                ) : (
                    <svg className="w-full h-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ filter: 'blur(60px)' }}>
                        <defs>
                            <radialGradient id="darkRadial1" cx="30%" cy="20%" r="60%">
                                <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
                            </radialGradient>
                            <radialGradient id="darkRadial2" cx="70%" cy="75%" r="55%">
                                <stop offset="0%" stopColor="#7e22ce" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#581c87" stopOpacity="0" />
                            </radialGradient>
                            <radialGradient id="darkRadial3" cx="80%" cy="15%" r="45%">
                                <stop offset="0%" stopColor="#0f172a" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                            </radialGradient>
                        </defs>

                        <rect width="1440" height="900" fill="#020617" />
                        <circle cx="30%" cy="20%" r="500" fill="url(#darkRadial1)" />
                        <circle cx="70%" cy="75%" r="600" fill="url(#darkRadial2)" />
                        <circle cx="80%" cy="15%" r="400" fill="url(#darkRadial3)" />

                        <path d="M0,0 Q720,450 1440,0" fill="none" stroke="#1e40af" strokeWidth="200" opacity="0.1" />
                    </svg>
                )}
            </div>

            <div className="relative z-10 w-full min-h-screen">
                {children}
            </div>
        </div>
    );
}
