import React, { useRef, useState } from 'react';
import { FastForward, Play } from 'lucide-react';

interface IntroVideoProps {
    onFinish: () => void;
}

const IntroVideo: React.FC<IntroVideoProps> = ({ onFinish }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [started, setStarted] = useState(false);
    const [hasFired, setHasFired] = useState(false);

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

        if (videoRef.current && audioRef.current) {
            try {
                videoRef.current.load();
                audioRef.current.load();

                // Avviamo l'audio
                audioRef.current.play().catch(e => console.warn("Audio play blocked", e));

                // Avviamo il video
                await videoRef.current.play();
                console.log("Intro Video: Playback started successfully");
            } catch (err) {
                console.error("Intro Video: Playback failed", err);
                // Se proprio non va, permettiamo allo SKIP di funzionare
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100000] bg-black flex items-center justify-center overflow-hidden w-screen h-screen" onPointerDown={(e) => e.stopPropagation()}>

            {/* Background Video */}
            <video
                ref={videoRef}
                src="/intro_present.MP4"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${started ? 'opacity-100' : 'opacity-0'}`}
                playsInline
                preload="auto"
                onEnded={triggerHome}
            />

            {/* Separate Audio */}
            <audio ref={audioRef} src="/number_intro_audio.mp3" preload="auto" />

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

