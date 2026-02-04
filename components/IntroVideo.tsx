import React, { useRef, useState } from 'react';
import { FastForward, Play, Volume2, VolumeX } from 'lucide-react';

interface IntroVideoProps {
    onFinish: () => void;
}

const IntroVideo: React.FC<IntroVideoProps> = ({ onFinish }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    // Removed audioRef as video now has embedded audio
    const [started, setStarted] = useState(false);
    const [hasFired, setHasFired] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const toggleAudio = (e: React.PointerEvent) => {
        e.stopPropagation();
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        // Removed audioRef logic
        if (videoRef.current) {
            videoRef.current.muted = newMuted; // Mute video track too just in case
        }
    };

    // Funzione per navigare alla Home
    const triggerHome = () => {
        console.log("Intro Video: Triggering Home");
        if (hasFired) return;
        setHasFired(true);
        onFinish();
    };

    const handleStart = async () => {
        console.log("Intro Video: Starting sequence...");
        if (started) return;
        setStarted(true);

        if (videoRef.current) {
            try {
                videoRef.current.load();
                // Removed audioRef load

                // Avviamo il video (che ora ha l'audio)
                await videoRef.current.play().catch(e => {
                    console.warn("Video play blocked - forcing home", e);
                    triggerHome();
                });
                console.log("Intro Video: Playback started successfully");
            } catch (err) {
                console.error("Intro Video: Playback failed", err);
                // Se proprio non va, permettiamo allo SKIP di funzionare
            }
        }
    };

    return (

        <div className="fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden w-full h-[100dvh]" onPointerDown={(e) => e.stopPropagation()}>

            {/* Audio Toggle (Always visible) */}
            <button
                onPointerDown={toggleAudio}
                className={`absolute top-12 right-6 z-[100010] p-3 rounded-full border transition-all active:scale-95 shadow-lg
                    ${!isMuted
                        ? 'bg-[#FF8800] border-[#FF8800] text-white shadow-[0_0_20px_rgba(255,136,0,0.4)]'
                        : 'bg-black/40 backdrop-blur-md border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
            >
                {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>

            {/* Background Video */}
            <video
                ref={videoRef}
                src="/Intro_breve_1.mp4"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${started ? 'opacity-100' : 'opacity-0'}`}
                playsInline
                preload="auto"
                onEnded={triggerHome} onError={triggerHome}
            />

            {/* UI INITIAL: Logo and Button */}
            {!started && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-end w-full h-full pb-[10vh]">
                    {/* Main Logo Background */}
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat w-full h-full opacity-90"
                        style={{ backgroundImage: 'url("/intrologo.png?v=2")' }}
                    />

                    {/* Start Button Container */}
                    <div className="relative z-30 mb-8 translate-y-[50px]">
                        <button
                            onPointerDown={(e) => { e.stopPropagation(); handleStart(); }}
                            className="group relative px-8 py-4 bg-[#FF8800] rounded-xl border-2 border-white/20 shadow-[0_0_30px_rgba(255,136,0,0.4)] active:scale-95 transition-all"
                        >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity rounded-xl"></div>
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-black/20 rounded-lg">
                                    <Play size={20} className="text-white fill-white" />
                                </div>
                                <div className="flex flex-col items-start translate-y-[-1px]">
                                    <span className="text-[10px] text-white/70 font-orbitron tracking-[0.2em] font-bold">PRONTI A PARTIRE</span>
                                    <span className="text-sm text-white font-orbitron font-black tracking-widest uppercase">Iniziamo l'avventura</span>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* Skip Button */}
            {started && (
                <button
                    onPointerDown={(e) => { e.stopPropagation(); triggerHome(); }}
                    className="absolute bottom-12 right-12 z-30 px-6 py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-white font-orbitron font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3 active:scale-95 group"
                >
                    <span>SKIP INTRO</span>
                    <FastForward size={14} className="text-[#FF8800]" />
                </button>
            )}

            {/* Cinematic bars removed for full screen feel */}
        </div>
    );
};

export default IntroVideo;

