
import React, { useEffect, useState, useRef } from 'react';
import { HexCellData } from '../types';

interface HexCellProps {
  data: HexCellData;
  isSelected: boolean;
  isSelectable: boolean;
  onMouseEnter: (id: string) => void;
  onMouseDown: (id: string) => void;
  theme?: 'default' | 'orange';
  isBossLevel?: boolean;
}

const HexCell: React.FC<HexCellProps> = ({
  data,
  isSelected,
  isSelectable,
  onMouseEnter,
  onMouseDown,
  theme = 'default',
  isBossLevel = false,
}) => {
  const [animationClass, setAnimationClass] = useState('animate-hex-entry');
  const prevSelected = useRef(isSelected);
  const isNumber = data.type === 'number';

  // Posizionamento basato su scala variabile CSS
  // Orange theme uses tighter spacing with perfect octagon tessellation
  const isOrangeTheme = theme === 'orange';

  // For Orange theme: Rectilinear grid with centered alignment
  // Octagon (64px) and Square (40px). Center-to-center distance 52px.
  // To align centers: Square needs (64-40)/2 = 12px offset relative to Octagon grid 0,0.
  const rowSpacing = isOrangeTheme ? 52 : 65;
  const colSpacing = isOrangeTheme ? 52 : 75;
  const offsetAmount = isOrangeTheme ? 0 : 38;

  const centeringOffset = (isOrangeTheme && !isNumber) ? 12 : 0;

  const topValue = data.row * rowSpacing + centeringOffset;
  const leftValue = data.col * colSpacing + (data.row % 2 === 1 ? offsetAmount : 0) + centeringOffset;

  // Tema visivo migliorato per operatori per massima leggibilità e stile
  const getOperatorTheme = (val: string) => {
    switch (val) {
      case '+': return {
        text: 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.9)]',
        bg: 'bg-emerald-900/40 shadow-[inset_0_0_20px_rgba(16,185,129,0.3)]',
        border: 'border-emerald-500/50'
      };
      case '-': return {
        text: 'text-rose-400 drop-shadow-[0_0_15px_rgba(251,113,133,0.9)]',
        bg: 'bg-rose-900/40 shadow-[inset_0_0_20px_rgba(244,63,94,0.3)]',
        border: 'border-rose-500/50'
      };
      case '×': return {
        text: 'text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.9)]',
        bg: 'bg-amber-900/40 shadow-[inset_0_0_20px_rgba(245,158,11,0.3)]',
        border: 'border-amber-500/50'
      };
      case '÷': return {
        text: 'text-violet-400 drop-shadow-[0_0_15px_rgba(167,139,250,0.9)]',
        bg: 'bg-violet-900/40 shadow-[inset_0_0_20px_rgba(139,92,246,0.3)]',
        border: 'border-violet-500/50'
      };
      default: return {
        text: 'text-white',
        bg: 'bg-slate-900/60',
        border: 'border-white/10'
      };
    }
  };

  const operatorTheme = getOperatorTheme(data.value);
  // Shape logic: Default uses css-clip. Orange uses specific shapes per type.
  const shapeClass = theme === 'orange'
    ? (isNumber ? 'octagon-clip' : 'rounded-xl')
    : 'hexagon-clip';

  // Orange theme specific styling
  const orangeNumberStyle = isOrangeTheme && isNumber
    ? '' // Use image only, no container style
    : '';
  const orangeOperatorStyle = isOrangeTheme && !isNumber
    ? isBossLevel
      ? 'bg-gradient-to-br from-green-800 to-emerald-950 border-[3px] border-emerald-700 shadow-[0_2px_0_rgba(0,50,0,0.5)]'
      : 'bg-gradient-to-br from-[#E65100] to-[#B71C1C] border-[3px] border-white shadow-[0_2px_0_rgba(0,0,0,0.2)]'
    : '';

  // Gestione animazioni di selezione e deselezione
  useEffect(() => {
    if (isSelected && !prevSelected.current) {
      setAnimationClass('animate-hex-select');
    } else if (!isSelected && prevSelected.current) {
      setAnimationClass('animate-hex-deselect');
    }
    prevSelected.current = isSelected;
  }, [isSelected]);

  // Delay di ingresso basato sulla posizione per un effetto "wave"
  const entryDelay = (data.row * 0.05) + (data.col * 0.05);

  const handleTouchStart = (e: React.TouchEvent) => {
    onMouseDown(data.id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const cellId = element.closest('[data-cell-id]')?.getAttribute('data-cell-id');
      if (cellId) {
        onMouseEnter(cellId);
      }
    }
  };

  return (
    <div
      className={`absolute transition-all duration-300 cursor-pointer flex items-center justify-center 
        ${isOrangeTheme && isNumber ? '' : shapeClass} 
        ${!isOrangeTheme ? 'border-2' : ''} 
        ${animationClass}
        ${isOrangeTheme && isNumber ? 'w-[calc(64px*var(--hex-scale))] h-[calc(64px*var(--hex-scale))]' : ''}
        ${isOrangeTheme && !isNumber ? 'w-[calc(40px*var(--hex-scale))] h-[calc(40px*var(--hex-scale))]' : ''}
        ${!isOrangeTheme ? 'w-[calc(64px*var(--hex-scale))] h-[calc(72px*var(--hex-scale))]' : ''}
        ${isSelected
          ? isOrangeTheme ? 'z-20 scale-110' : 'bg-cyan-400 shadow-[0_0_40px_rgba(34,211,238,1)] z-20 border-white scale-110'
          : isOrangeTheme && isNumber
            ? `${orangeNumberStyle} active:scale-95`
            // Removing shadow from container if SVG has it, or keeping drop-shadow on SVG
            : isOrangeTheme && !isNumber
              ? `${orangeOperatorStyle} active:scale-95 shadow-md`
              : isNumber
                ? 'bg-slate-800/95 border-white/10 active:scale-95 hover:bg-slate-700/95'
                : `${operatorTheme.bg} ${operatorTheme.border} active:scale-95 hover:brightness-125`
        }
        ${!isSelectable && !isSelected ? 'opacity-20 pointer-events-none' : ''}
      `}
      style={{
        top: `calc(${topValue}px * var(--hex-scale))`,
        left: `calc(${leftValue}px * var(--hex-scale))`,
        animationDelay: animationClass === 'animate-hex-entry' ? `${entryDelay}s` : '0s'
      }}
      data-cell-id={data.id}
      onMouseDown={() => onMouseDown(data.id)}
      onMouseEnter={() => onMouseEnter(data.id)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {/* PNG Background for Orange Theme Octagons (Numbers) */}
      {isOrangeTheme && isNumber && (
        <img
          src="/octagon-base.png"
          alt="cell"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-md"
          style={{
            filter: isSelected
              ? 'hue-rotate(100deg) brightness(1.1) saturate(1.2)'
              : isBossLevel
                ? 'hue-rotate(100deg) saturate(1.5) brightness(0.7)' // Dark Green for Boss
                : 'none',
            transition: 'filter 0.3s ease'
          }}
        />
      )}

      {/* SVG Background for Orange Theme Squares (Operators) - ONLY IF SELECTED to handle scale/color change cleanly, or standard DIV otherwise */}
      {isOrangeTheme && !isNumber && isSelected && (
        <div className="absolute inset-0 bg-[#00CC66] border-[3px] border-white rounded-xl shadow-[0_0_40px_rgba(0,204,102,1)]" />
      )}

      {!isOrangeTheme && (
        <div className={`absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none ${isSelected ? 'opacity-50' : 'opacity-10'}`}></div>
      )}

      <span className={`font-orbitron font-black select-none transition-all duration-200 leading-none z-10
        ${isSelected
          ? 'text-white scale-110'
          : isOrangeTheme && isNumber
            ? 'text-white text-[calc(2.8rem*var(--hex-scale))] drop-shadow-lg'
            : isOrangeTheme && !isNumber
              ? 'text-white text-[calc(1.4rem*var(--hex-scale))] drop-shadow-md'
              : isNumber
                ? 'text-cyan-400 text-[calc(2.6rem*var(--hex-scale))] drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]'
                : `${operatorTheme.text} text-[calc(3.4rem*var(--hex-scale))]`
        }`}>
        {data.value}
      </span>
    </div>
  );
};

export default HexCell;
