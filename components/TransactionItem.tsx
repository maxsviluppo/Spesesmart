import React, { useState, useRef, useEffect } from 'react';
import { Transaction } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Trash2, Edit2 } from 'lucide-react';

interface Props {
  transaction: Transaction;
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  isFirst?: boolean;
}

export const TransactionItem: React.FC<Props> = ({ transaction, onDelete, onEdit, isFirst = false }) => {
  const isExpense = transaction.type === 'expense';
  
  // Swipe Logic State
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  // Constants for swipe
  const SWIPE_THRESHOLD = 70; // Lowered from 80 to make deletion easier
  const MAX_SWIPE = 120; 

  // Auto-swipe hint animation
  useEffect(() => {
    if (!isFirst) return;

    const interval = setInterval(() => {
      if (isDragging) return; // Don't animate while user interacts

      // Sequence: Slide Left (Show Delete) -> Slide Right (Show Edit) -> Center
      setCurrentX(-50);
      
      setTimeout(() => {
        if (!isDragging) setCurrentX(50);
      }, 500);

      setTimeout(() => {
        if (!isDragging) setCurrentX(0);
      }, 1000);

    }, 5000); // Repeat every 5 seconds

    return () => clearInterval(interval);
  }, [isFirst, isDragging]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null) return;
    const x = e.touches[0].clientX;
    const diff = x - startX;
    
    // Limit the swipe distance visual
    if (diff > MAX_SWIPE) setCurrentX(MAX_SWIPE);
    else if (diff < -MAX_SWIPE) setCurrentX(-MAX_SWIPE);
    else setCurrentX(diff);
  };

  const handleTouchEnd = () => {
    handleSwipeEnd();
  };

  // Mouse Handlers (for desktop testing)
  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || startX === null) return;
    e.preventDefault(); 
    
    const x = e.clientX;
    const diff = x - startX;

    if (diff > MAX_SWIPE) setCurrentX(MAX_SWIPE);
    else if (diff < -MAX_SWIPE) setCurrentX(-MAX_SWIPE);
    else setCurrentX(diff);
  };

  const handleMouseUp = () => {
    handleSwipeEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) handleSwipeEnd();
  };

  // Logic to execute action or reset
  const handleSwipeEnd = () => {
    setIsDragging(false);
    
    if (currentX > SWIPE_THRESHOLD) {
      // Swipe Right -> Edit
      onEdit(transaction);
      setCurrentX(0); 
    } else if (currentX < -SWIPE_THRESHOLD) {
      // Swipe Left -> Delete
      // Slight delay to allow state to settle before confirm dialog
      setTimeout(() => onDelete(transaction.id), 50);
      setCurrentX(0);
    } else {
      // Snap back
      setCurrentX(0);
    }
    setStartX(null);
  };

  // Helper to determine background color based on swipe direction
  const getSwipeBackground = () => {
    if (currentX > 0) return 'bg-indigo-600'; // Edit Color
    if (currentX < 0) return 'bg-red-600'; // Delete Color
    return 'bg-slate-900';
  };

  return (
    <div 
      className="relative mb-3 h-[88px] w-full overflow-hidden rounded-xl select-none touch-pan-y"
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      style={{ touchAction: 'pan-y' }} // IMPORTANT: Allows vertical scroll but captures horizontal
    >
      {/* Background Layer (Actions) */}
      <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors ${getSwipeBackground()}`}>
        <div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX > 30 ? 1 : 0 }}>
          <Edit2 size={24} />
          <span>Modifica</span>
        </div>
        <div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX < -30 ? 1 : 0 }}>
          <span>Elimina</span>
          <Trash2 size={24} />
        </div>
      </div>

      {/* Foreground Layer (Content) */}
      <div 
        ref={itemRef}
        className="relative h-full bg-slate-900 flex items-center justify-between p-4 border border-slate-800 rounded-xl transition-transform ease-out"
        style={{ 
          transform: `translateX(${currentX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <div className={`p-2 rounded-full ${isExpense ? 'bg-red-950/30 text-red-400' : 'bg-emerald-950/30 text-emerald-400'}`}>
            {isExpense ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
          </div>
          <div>
            <p className="font-medium text-slate-200">{transaction.description}</p>
            <p className="text-xs text-slate-500 capitalize">{transaction.category} • {new Date(transaction.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1 pointer-events-none">
          <span className={`font-bold ${isExpense ? 'text-slate-300' : 'text-emerald-400'}`}>
            {isExpense ? '-' : '+'}€{transaction.amount.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};