import React from 'react';
import { Player, Role } from '../types';
import { User, Skull, ShieldCheck } from 'lucide-react';

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  isSelected?: boolean;
  showRole?: boolean;
  disabled?: boolean;
}

export const PlayerCard: React.FC<PlayerCardProps> = ({ 
  player, 
  onClick, 
  isSelected = false, 
  showRole = false,
  disabled = false
}) => {
  
  if (!player.isAlive && !showRole) {
    // Dead player view during gameplay (if visible)
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-gray-800/50 rounded-xl opacity-50 grayscale border-2 border-transparent">
        <span className="text-4xl mb-2">💀</span>
        <span className="text-gray-400 font-marker">{player.name}</span>
        <span className="text-xs text-red-400 font-bold mt-1">ELIMINADO</span>
      </div>
    );
  }

  return (
    <div 
      onClick={disabled ? undefined : onClick}
      className={`
        relative flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105 active:scale-95'}
        ${isSelected 
          ? 'bg-gold-costeno/20 border-4 border-gold-costeno shadow-[0_0_15px_rgba(251,191,36,0.5)]' 
          : 'bg-slate-700 border-4 border-transparent hover:bg-slate-600'}
      `}
    >
      <div className="text-4xl mb-2 drop-shadow-md">{player.avatar}</div>
      <h3 className="font-marker text-lg text-white text-center leading-tight truncate w-full">
        {player.name}
      </h3>
      
      {showRole && (
        <div className={`mt-2 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider
          ${player.role === Role.MAFIA ? 'bg-red-600 text-white' : 
            player.role === Role.DOCTOR ? 'bg-blue-500 text-white' : 
            player.role === Role.DETECTIVE ? 'bg-purple-600 text-white' : 
            'bg-green-600 text-white'}`}>
          {player.role === Role.CITIZEN ? 'Ciudadano' : player.role}
        </div>
      )}

      {/* Status Icons Overlay */}
      {player.role === Role.DOCTOR && showRole && <div className="absolute top-2 right-2 text-blue-300"><ShieldCheck size={16} /></div>}
    </div>
  );
};