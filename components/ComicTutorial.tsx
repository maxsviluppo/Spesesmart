
import React, { useState, useEffect } from 'react';
import { ArrowRight, X, User, CheckCircle2 } from 'lucide-react';

export interface TutorialStep {
    targetId?: string; // ID dell'elemento da evidenziare (se esiste)
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'center' | 'left' | 'right';
    comicImage?: string; // Opzionale: url immagine specifica per questo step
}

interface ComicTutorialProps {
    steps: TutorialStep[];
    onComplete: (neverShowAgain: boolean) => void;
    onSkip: (neverShowAgain: boolean) => void;
    isVisible: boolean;
}

const ComicTutorial: React.FC<ComicTutorialProps> = ({ steps, onComplete, onSkip, isVisible }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [neverShowAgain, setNeverShowAgain] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!isVisible) return;
        const step = steps[currentStep];
        if (step.targetId) {
            const el = document.getElementById(step.targetId);
            if (el) {
                setTargetRect(el.getBoundingClientRect());
                // Scroll into view if needed? For now simple focus.
            } else {
                setTargetRect(null);
            }
        } else {
            setTargetRect(null);
        }
    }, [currentStep, isVisible, steps]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete(neverShowAgain);
        }
    };

    if (!isVisible) return null;

    const step = steps[currentStep];

    // Dynamic Position Logic
    let bubbleStyle: React.CSSProperties = {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed'
    };

    let arrowClass = "hidden"; // Hide arrow by default if no target

    if (targetRect) {
        const padding = 15;
        const bubbleWidth = 220; // Reduced width
        const bubbleHeight = 160; // Estimated height

        // Prefer Bottom, then Top, then Center
        const spaceBelow = window.innerHeight - targetRect.bottom;
        const spaceAbove = targetRect.top;

        // Calculate horizontal position centered on target
        let leftPos = targetRect.left + (targetRect.width / 2) - (bubbleWidth / 2);

        // Horizontal Boundary Check (Clamping)
        const screenPadding = 10;
        if (leftPos < screenPadding) leftPos = screenPadding;
        if (leftPos + bubbleWidth > window.innerWidth - screenPadding) leftPos = window.innerWidth - bubbleWidth - screenPadding;

        // Vertical Positioning Logic
        if (spaceBelow > 220) {
            bubbleStyle = {
                top: targetRect.bottom + padding,
                left: leftPos,
                position: 'fixed',
                width: bubbleWidth
            };
            // Calculate arrow position relative to new bubble left
            // Arrow center should point to target center
            const arrowLeft = (targetRect.left + targetRect.width / 2) - leftPos;
            arrowClass = `absolute -top-3 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[12px] border-b-white`;
            // We need inline style for arrow left as it's dynamic now
        } else if (spaceAbove > 220) {
            bubbleStyle = {
                top: targetRect.top - bubbleHeight - padding, // Approximate
                left: leftPos,
                position: 'fixed',
                width: bubbleWidth
            };
            const arrowLeft = (targetRect.left + targetRect.width / 2) - leftPos;
            arrowClass = `absolute -bottom-3 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-white`;
        } else {
            bubbleStyle = {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                position: 'fixed',
                width: bubbleWidth
            };
        }
    }


    return (
        <div className="fixed inset-0 z-[99999] pointer-events-none">
            {/* Dark Overlay - No Blur */}
            <div className="absolute inset-0 bg-black/50 pointer-events-auto transition-opacity" onClick={(e) => e.stopPropagation()}></div>

            {/* Dynamic Highlight Box - Sharp and Clear */}
            {targetRect && (
                <div
                    className="absolute border-[4px] border-[#FF8800] rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] z-[100000] pointer-events-none box-content"
                    style={{
                        top: targetRect.top - 5,
                        left: targetRect.left - 5,
                        width: targetRect.width + 10,
                        height: targetRect.height + 10,
                    }}
                />
            )}

            {/* Bubble Container */}
            <div
                className="z-[100001] pointer-events-auto transition-all duration-300"
                style={bubbleStyle}
            >
                {/* Character Icon - Small and Cute attached to bubble */}


                <div className="bg-white border-[3px] border-slate-900 rounded-2xl shadow-2xl relative">
                    {/* CSS Arrow - Dynamic Inline Style needed for arrow to point correctly if bubble is shifted */}
                    <div
                        className={arrowClass}
                        style={{
                            left: targetRect ? Math.max(10, Math.min(210, (targetRect.left + targetRect.width / 2) - (bubbleStyle.left as number))) : '50%',
                            transform: 'translateX(-50%)'
                        }}
                    ></div>

                    {/* Header: Title + Close */}
                    <div className="flex justify-between items-start p-4 pb-2">
                        <h3 className="text-sm font-black font-orbitron text-[#FF8800] uppercase tracking-wider leading-tight w-[90%]">{step.title}</h3>
                        <button
                            onClick={() => onSkip(neverShowAgain)}
                            className="text-slate-300 hover:text-slate-900 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="px-4 pb-4">
                        <p className="text-slate-700 font-bold text-xs leading-relaxed font-comic mb-4">
                            {step.description}
                        </p>

                        {/* Controls */}
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={handleNext}
                                    className="flex-1 bg-slate-900 text-white py-2 rounded-lg font-orbitron font-black uppercase text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-[#FF8800]"
                                >
                                    {currentStep === steps.length - 1 ? 'OK' : 'AVANTI'}
                                    <ArrowRight size={12} />
                                </button>
                            </div>

                            {/* Never Show Again - Minimal */}
                            <label className="flex items-center gap-2 cursor-pointer group justify-center">
                                <input
                                    type="checkbox"
                                    className="accent-[#FF8800] w-3 h-3"
                                    checked={neverShowAgain}
                                    onChange={(e) => setNeverShowAgain(e.target.checked)}
                                />
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide group-hover:text-slate-600">Non mostrare più</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComicTutorial;
