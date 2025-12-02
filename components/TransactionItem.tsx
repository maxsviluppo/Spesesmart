import React, { useState, useRef, useEffect } from 'react';
import { Transaction } from '../types.ts';
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
  const [isDeleting, setIsDeleting] = useState(false); // New state to handle exit animation
  const itemRef = useRef<HTMLDivElement>(null);

  // Constants for swipe
  const SWIPE_THRESHOLD = 70; 
  const DELETE_THRESHOLD = 150; // Threshold to trigger full delete
  const MAX_SWIPE_RIGHT = 100; // Limit for edit (right swipe) only

  // Auto-swipe hint animation
  useEffect(() => {
    if (!isFirst || isDeleting) return;

    const interval = setInterval(() => {
      if (isDragging || isDeleting) return; 

      // Hint sequence
      setCurrentX(-40);
      
      setTimeout(() => {
        if (!isDragging && !isDeleting) setCurrentX(40);
      }, 400);

      setTimeout(() => {
        if (!isDragging && !isDeleting) setCurrentX(0);
      }, 800);

    }, 5000);

    return () => clearInterval(interval);
  }, [isFirst, isDragging, isDeleting]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null || isDeleting) return;
    const x = e.touches[0].clientX;
    const diff = x - startX;
    
    // Logic: Limit swipe to the RIGHT (Edit), but allow full swipe to the LEFT (Delete)
    if (diff > MAX_SWIPE_RIGHT) {
        setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2); // Rubber band effect right
    } else {
        setCurrentX(diff); // Free movement left
    }
  };

  const handleTouchEnd = () => {
    handleSwipeEnd();
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || startX === null || isDeleting) return;
    e.preventDefault(); 
    
    const x = e.clientX;
    const diff = x - startX;

    if (diff > MAX_SWIPE_RIGHT) {
         setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2);
    } else {
         setCurrentX(diff);
    }
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
    } else if (currentX < -DELETE_THRESHOLD) {
      // Swipe Left -> Full Delete
      setIsDeleting(true);
      setCurrentX(-window.innerWidth); // Animate completely off screen
      
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);

      // Wait for animation then delete
      setTimeout(() => onDelete(transaction.id), 300);
    } else {
      // Snap back if threshold not met
      setCurrentX(0);
    }
    setStartX(null);
  };

  // Helper to determine background color
  const getSwipeBackground = () => {
    if (currentX > 0) return 'bg-indigo-600'; // Edit Color
    if (currentX < 0) return 'bg-red-600'; // Delete Color
    return 'bg-slate-900';
  };

  if (isDeleting && Math.abs(currentX) >= window.innerWidth) {
      // Return null or placeholder while waiting for parent to delete data
      // This prevents visual glitching before the list re-renders
      return <div className="h-[88px] mb-3 w-full"></div>;
  }

  return (
    <div 
      className="relative mb-3 h-[88px] w-full overflow-hidden rounded-xl select-none touch-pan-y"
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      style={{ touchAction: 'pan-y' }}
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
          <span className={`font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
            {isExpense ? '-' : '+'}€{transaction.amount.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};