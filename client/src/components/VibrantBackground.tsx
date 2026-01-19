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
                    <svg className="w-full h-full opacity-80" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" style={{ filter: 'blur(40px)' }}>
                        <defs>
                            <radialGradient id="lightRadial1" cx="20%" cy="20%" r="60%">
                                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#e0e7ff" stopOpacity="0" />
                            </radialGradient>
                            <radialGradient id="lightRadial2" cx="80%" cy="80%" r="50%">
                                <stop offset="0%" stopColor="#c084fc" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#f3e8ff" stopOpacity="0" />
                            </radialGradient>
                            <radialGradient id="lightRadial3" cx="70%" cy="10%" r="40%">
                                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="#fef3c7" stopOpacity="0" />
                            </radialGradient>
                            <radialGradient id="lightRadial4" cx="10%" cy="90%" r="50%">
                                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.2" />
                                <stop offset="100%" stopColor="#ccfbf1" stopOpacity="0" />
                            </radialGradient>
                        </defs>

                        <rect width="1440" height="900" fill="#f8fafc" />
                        <circle cx="20%" cy="20%" r="400" fill="url(#lightRadial1)" />
                        <circle cx="80%" cy="80%" r="500" fill="url(#lightRadial2)" />
                        <circle cx="70%" cy="10%" r="350" fill="url(#lightRadial3)" />
                        <circle cx="10%" cy="90%" r="450" fill="url(#lightRadial4)" />

                        <path d="M0,450 Q360,350 720,450 T1440,450" fill="none" stroke="#e2e8f0" strokeWidth="100" opacity="0.5" />
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
