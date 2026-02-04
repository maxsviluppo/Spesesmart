
import React, { useEffect, useState } from 'react';

interface CharacterHelperProps {
    onInteract?: () => void;
}

export const CharacterHelper: React.FC<CharacterHelperProps> = ({ onInteract }) => {
    const [position, setPosition] = useState({ x: 10, y: 80 }); // Initial position (% of screen)
    const [isTalking, setIsTalking] = useState(false);

    // NOTE: This is a placeholder for the logic. 
    // Once we have the asset (video or png), we can refine the animations.
    // Ideally, if it's a video, it should be a WebM with transparency.

    return (
        <div
            className="fixed z-50 transition-all duration-1000 ease-in-out pointer-events-none"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: 'translate(-50%, -50%)'
            }}
        >
            {/* Placeholder for the character asset */}
            <div className="relative group cursor-pointer pointer-events-auto" onClick={onInteract}>
                {/* If Video */}
                {/* <video src="/character.webm" autoPlay loop muted playsInline className="w-48 h-auto" /> */}

                {/* If Image (Fallback/Current) */}
                <img
                    src="/character.png"
                    alt="Character"
                    className="w-48 h-auto drop-shadow-2xl animate-bounce-slow"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none'; // Hide if missing
                    }}
                />

                {/* Comic Bubble Example */}
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-white text-slate-900 px-4 py-2 rounded-2xl rounded-bl-none shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                    <p className="font-bold text-sm">Clicca "Tutorial"!</p>
                </div>
            </div>
        </div>
    );
};

export default CharacterHelper;
