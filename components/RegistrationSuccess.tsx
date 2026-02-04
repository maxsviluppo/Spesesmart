import React from 'react';
import { Play } from 'lucide-react';

interface RegistrationSuccessProps {
    onEnter: () => void;
}

const RegistrationSuccess: React.FC<RegistrationSuccessProps> = ({ onEnter }) => {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black">
            {/* Background Image - Full Cover */}
            <img
                src="/registrazione_account.png"
                alt="Registrazione Completata"
                className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlay Content */}
            <div className="relative z-10 flex flex-col items-center justify-end h-full w-full pb-20 px-6">

                {/* Play Button */}
                <button
                    onClick={onEnter}
                    className="group relative flex items-center justify-center gap-3 px-12 py-4 
                     bg-[#FF8800] hover:bg-[#FF9900] active:scale-95 transition-all duration-300
                     rounded-2xl shadow-[0_10px_20px_rgba(255,136,0,0.4)]
                     border-b-4 border-[#CC6600]"
                >
                    <div className="bg-white/20 p-2 rounded-full">
                        <Play className="w-8 h-8 text-white fill-current" />
                    </div>
                    <span className="text-2xl font-black text-white uppercase tracking-wider">
                        Gioca Ora
                    </span>

                    {/* Shine Effect */}
                    <div className="absolute inset-0 rounded-2xl overflow-hidden">
                        <div className="absolute top-0 left-[-100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] group-hover:animate-shine" />
                    </div>
                </button>

                <p className="mt-6 text-white/80 font-medium text-sm text-center drop-shadow-md max-w-xs">
                    Account verificato con successo.
                    <br />Benvenuto in Number!
                </p>

            </div>
        </div>
    );
};

export default RegistrationSuccess;
