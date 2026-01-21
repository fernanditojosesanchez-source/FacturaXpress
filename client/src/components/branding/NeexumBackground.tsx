import React from 'react';
import { cn } from "@/lib/utils";

interface NeexumBackgroundProps {
    className?: string;
    children?: React.ReactNode;
}

export function NeexumBackground({ className, children }: NeexumBackgroundProps) {
    return (
        <div className={cn("h-screen w-full relative overflow-hidden bg-[#f0f9f9] flex items-center justify-center", className)}>
            {/* Background Layer: Pattern & Gradients */}
            <div className="fixed inset-0 w-full h-full pointer-events-none select-none z-0">
                {/* Soft Mint/Cyan Orbs */}
                <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-[#42a5a5]/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-[#2dd4bf]/15 blur-[100px]" />

                {/* Clean Technical Pattern v2 */}
                <div
                    className="absolute inset-x-0 bottom-0 h-[85%] opacity-[0.35] bg-no-repeat bg-right-bottom mix-blend-multiply blur-[3px]"
                    style={{
                        backgroundImage: "url('/neexum_bg_pattern_v2.png')",
                        backgroundSize: '90% auto',
                        filter: 'contrast(1.02) brightness(1.05) saturate(0.8)'
                    }}
                />

                {/* Integration Mask */}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#f0f9f9]/90 via-transparent to-[#f0f9f9]/20" />
            </div>

            <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-4 mt-[-4vh]">
                {children}
            </div>
        </div>
    );
}
