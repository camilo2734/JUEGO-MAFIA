import React from 'react';
import { Player, Role } from '../types';
import { X, User, Skull, Shield, Eye, Crown } from 'lucide-react';

interface HostPanelProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  phase: string;
}

export const HostPanel: React.FC<HostPanelProps> = ({ isOpen, onClose, players, phase }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border-2 border-gold-costeno shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Crown className="text-gold-costeno" />
            <h2 className="text-xl font-marker text-white">Panel del Host</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
            <X className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-500/30">
            <h3 className="text-xs font-bold text-blue-300 uppercase mb-1">Fase Actual</h3>
            <p className="text-white font-medium">{phase}</p>
          </div>

          <div>
            <h3 className="text-gray-400 font-bold text-sm uppercase mb-3">Estado de los Jugadores</h3>
            <div className="space-y-2">
              {players.map((player) => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-3 rounded-lg border 
                    ${player.isAlive ? 'bg-slate-800 border-slate-700' : 'bg-red-900/20 border-red-900/50 opacity-70'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{player.isAlive ? player.avatar : '💀'}</span>
                    <div>
                      <p className={`font-bold ${player.isAlive ? 'text-white' : 'text-red-400 line-through'}`}>
                        {player.name}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {player.role}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {player.role === Role.MAFIA && <span title="Mafia" className="text-red-500"><Skull size={18} /></span>}
                    {player.role === Role.DOCTOR && <span title="Doctor" className="text-blue-500"><Shield size={18} /></span>}
                    {player.role === Role.DETECTIVE && <span title="Detective" className="text-purple-500"><Eye size={18} /></span>}
                    {!player.isAlive && <span className="text-xs font-bold text-red-500 uppercase px-2 py-1 bg-red-900/30 rounded">Eliminado</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-2xl text-center">
          <p className="text-xs text-gray-400">
            Tú eres el que manda aquí. Usa esta info para guiar el juego si se enredan.
          </p>
        </div>
      </div>
    </div>
  );
};