import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, GameState, Player, Role } from './types';
import { EMOJIS, PHRASES, ROLE_DESCRIPTIONS } from './constants';
import { PlayerCard } from './components/PlayerCard';
import { generateDayNarration, generateWinMessage } from './services/geminiService';
import { Moon, Sun, Shield, Eye, Skull, Play, RotateCcw, Volume2, Fingerprint } from 'lucide-react';

// --- Helper Functions ---

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const assignRoles = (names: string[]): Player[] => {
  const total = names.length;
  // Dynamic balancing
  let mafiaCount = 1;
  if (total >= 6) mafiaCount = 2;
  if (total >= 9) mafiaCount = 3;

  const roles: Role[] = [];
  for (let i = 0; i < mafiaCount; i++) roles.push(Role.MAFIA);
  roles.push(Role.DOCTOR);
  if (total >= 5) roles.push(Role.DETECTIVE);
  
  while (roles.length < total) {
    roles.push(Role.CITIZEN);
  }

  const shuffledRoles = shuffleArray(roles);
  const shuffledEmojis = shuffleArray(EMOJIS);

  return names.map((name, index) => ({
    id: `p-${index}`,
    name,
    role: shuffledRoles[index],
    isAlive: true,
    avatar: shuffledEmojis[index % shuffledEmojis.length],
  }));
};

// --- Components ---

const Button = ({ onClick, children, variant = 'primary', className = '' }: any) => {
  const baseStyle = "w-full py-4 rounded-xl font-bold text-lg transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-gold-costeno text-slate-900 hover:bg-yellow-300",
    danger: "bg-danger-red text-white hover:bg-red-500",
    secondary: "bg-slate-600 text-white hover:bg-slate-500",
    ghost: "bg-transparent border-2 border-slate-500 text-slate-300 hover:bg-slate-800"
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}>
      {children}
    </button>
  );
};

export default function App() {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>({
    phase: GamePhase.SETUP,
    players: [],
    currentTurnIndex: 0,
    nightActions: { mafiaTargetId: null, doctorSavedId: null, detectiveInvestigatedId: null },
    dayMessage: "",
    winner: null
  });

  const [inputName, setInputName] = useState("");
  const [setupNames, setSetupNames] = useState<string[]>([]);
  const [loadingText, setLoadingText] = useState<string | null>(null);

  // --- Effects ---
  
  // Check Win Condition
  useEffect(() => {
    if (gameState.phase === GamePhase.SETUP || gameState.phase === GamePhase.GAME_OVER) return;

    const aliveMafia = gameState.players.filter(p => p.isAlive && p.role === Role.MAFIA).length;
    const aliveCivilianSide = gameState.players.filter(p => p.isAlive && p.role !== Role.MAFIA).length;

    if (aliveMafia === 0) {
      handleWin(Role.CITIZEN);
    } else if (aliveMafia >= aliveCivilianSide) {
      handleWin(Role.MAFIA);
    }
  }, [gameState.players, gameState.phase]);

  const handleWin = async (winner: Role.MAFIA | Role.CITIZEN) => {
    setLoadingText("Calculando quién ganó esta vaina...");
    const msg = await generateWinMessage(winner);
    setLoadingText(null);
    setGameState(prev => ({
      ...prev,
      phase: GamePhase.GAME_OVER,
      winner,
      dayMessage: msg
    }));
  };

  // --- Handlers ---

  const addName = () => {
    if (inputName.trim()) {
      setSetupNames([...setupNames, inputName.trim()]);
      setInputName("");
    }
  };

  const startGame = () => {
    if (setupNames.length < 4) {
      alert("¡Eche! Mínimo 4 pelagatos para jugar esto.");
      return;
    }
    const players = assignRoles(setupNames);
    setGameState({
      ...gameState,
      players,
      phase: GamePhase.ROLE_REVEAL_INTERSTITIAL,
      currentTurnIndex: 0
    });
  };

  const nextPlayerReveal = () => {
    if (gameState.currentTurnIndex < gameState.players.length - 1) {
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.ROLE_REVEAL_INTERSTITIAL,
        currentTurnIndex: prev.currentTurnIndex + 1
      }));
    } else {
      setGameState(prev => ({ ...prev, phase: GamePhase.NIGHT_INTRO }));
    }
  };

  const startNight = () => {
    setGameState(prev => ({
      ...prev,
      nightActions: { mafiaTargetId: null, doctorSavedId: null, detectiveInvestigatedId: null },
      phase: GamePhase.NIGHT_MAFIA
    }));
  };

  const handleNightAction = (targetId: string) => {
    if (gameState.phase === GamePhase.NIGHT_MAFIA) {
      setGameState(prev => ({
        ...prev,
        nightActions: { ...prev.nightActions, mafiaTargetId: targetId },
        phase: prev.players.some(p => p.role === Role.DOCTOR && p.isAlive) ? GamePhase.NIGHT_DOCTOR : 
               prev.players.some(p => p.role === Role.DETECTIVE && p.isAlive) ? GamePhase.NIGHT_DETECTIVE : 
               GamePhase.DAY_ANNOUNCEMENT // Skip straight to day logic if no special roles
      }));
      // If no doctor/detective, we need to trigger day logic immediately in effect or next tick
      // But for simplicity, let's just let the UI drive the flow. 
      // Actually, if we skip, we need to ensure the Day Calculation happens.
      // Let's refine:
      const hasDoc = gameState.players.some(p => p.role === Role.DOCTOR && p.isAlive);
      const hasDet = gameState.players.some(p => p.role === Role.DETECTIVE && p.isAlive);
      
      if (!hasDoc && !hasDet) {
        // Direct to calculation
        calculateDayResults(targetId, null);
      }
    } 
    else if (gameState.phase === GamePhase.NIGHT_DOCTOR) {
      const hasDet = gameState.players.some(p => p.role === Role.DETECTIVE && p.isAlive);
      setGameState(prev => ({
        ...prev,
        nightActions: { ...prev.nightActions, doctorSavedId: targetId },
        phase: hasDet ? GamePhase.NIGHT_DETECTIVE : GamePhase.DAY_ANNOUNCEMENT
      }));
      if (!hasDet) {
        calculateDayResults(gameState.nightActions.mafiaTargetId, targetId);
      }
    } 
    else if (gameState.phase === GamePhase.NIGHT_DETECTIVE) {
      setGameState(prev => ({
        ...prev,
        nightActions: { ...prev.nightActions, detectiveInvestigatedId: targetId },
        phase: GamePhase.NIGHT_DETECTIVE_RESULT
      }));
    }
  };

  const calculateDayResults = async (mafiaTargetId: string | null, doctorSavedId: string | null) => {
    setLoadingText("Amaneciendo... los gallos están cantando 🐓");
    
    let deadPlayer: Player | null = null;
    let savedPlayer: Player | null = null;
    let newPlayers = [...gameState.players];

    if (mafiaTargetId && mafiaTargetId !== doctorSavedId) {
      // Kill logic
      newPlayers = newPlayers.map(p => p.id === mafiaTargetId ? { ...p, isAlive: false } : p);
      deadPlayer = newPlayers.find(p => p.id === mafiaTargetId) || null;
    } else if (mafiaTargetId && mafiaTargetId === doctorSavedId) {
      savedPlayer = newPlayers.find(p => p.id === mafiaTargetId) || null;
    }

    const narration = await generateDayNarration(deadPlayer, savedPlayer);
    setLoadingText(null);

    setGameState(prev => ({
      ...prev,
      players: newPlayers,
      dayMessage: narration,
      phase: GamePhase.DAY_ANNOUNCEMENT
    }));
  };

  const handleVoting = (votedPlayerId: string) => {
    // Player chosen to be eliminated by the village
    const newPlayers = gameState.players.map(p => p.id === votedPlayerId ? { ...p, isAlive: false } : p);
    const eliminated = newPlayers.find(p => p.id === votedPlayerId);
    
    setGameState(prev => ({
      ...prev,
      players: newPlayers,
      dayMessage: `El pueblo ha hablado. ${eliminated?.name} era... ¡${eliminated?.role}!`,
      phase: GamePhase.DAY_ELIMINATION_REVEAL
    }));
  };

  // --- RENDERERS ---

  if (loadingText) {
    return (
      <div className="min-h-screen bg-tropical-night flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-spin text-5xl mb-4">🥥</div>
        <h2 className="text-2xl font-marker text-gold-costeno">{loadingText}</h2>
      </div>
    );
  }

  // 1. SETUP SCREEN
  if (gameState.phase === GamePhase.SETUP) {
    return (
      <div className="min-h-screen bg-tropical-night p-6 flex flex-col max-w-md mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-marker text-gold-costeno mb-2 drop-shadow-lg">El Sapo Infiltrado 🐸</h1>
          <p className="text-sea-blue font-bold">{PHRASES.welcome}</p>
        </header>

        <div className="flex-1 space-y-6">
          <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-2 border-slate-700">
            <label className="block text-sm text-gray-400 mb-2 font-bold uppercase tracking-wider">Nombre del Jugador</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addName()}
                placeholder="Ej: El Pibe Valderrama"
                className="flex-1 bg-slate-900 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-gold-costeno outline-none"
              />
              <button 
                onClick={addName}
                className="bg-sea-blue p-3 rounded-lg hover:bg-sky-400 transition-colors"
              >
                ➕
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-gray-400 font-bold uppercase text-sm">Jugadores ({setupNames.length})</h3>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {setupNames.map((name, i) => (
                <div key={i} className="bg-slate-700 px-3 py-2 rounded flex justify-between items-center animate-fadeIn">
                  <span className="truncate">{name}</span>
                  <button onClick={() => setSetupNames(setupNames.filter((_, idx) => idx !== i))} className="text-red-400">✕</button>
                </div>
              ))}
              {setupNames.length === 0 && <p className="text-gray-600 italic col-span-2 text-center py-4">Agrega gente pa' empezar el desorden.</p>}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Button onClick={startGame} disabled={setupNames.length < 4}>
             ¡Arrancar la Vaina! <Play size={20}/>
          </Button>
          <p className="text-xs text-center text-gray-500 mt-2">Mínimo 4 jugadores</p>
        </div>
      </div>
    );
  }

  // 2. ROLE REVEAL INTERSTITIAL
  if (gameState.phase === GamePhase.ROLE_REVEAL_INTERSTITIAL) {
    const player = gameState.players[gameState.currentTurnIndex];
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="text-6xl mb-6">📱✋</div>
        <h2 className="text-3xl font-marker text-white mb-4">Pásale el celular a:</h2>
        <h1 className="text-5xl font-bold text-gold-costeno mb-8 animate-bounce">{player.name}</h1>
        <p className="text-gray-400 mb-8">Nadie más puede ver la pantalla, ¡pilas!</p>
        <Button onClick={() => setGameState({...gameState, phase: GamePhase.ROLE_REVEAL})}>
          Ya lo tengo yo, ¡muéstrame!
        </Button>
      </div>
    );
  }

  // 3. ROLE REVEAL
  if (gameState.phase === GamePhase.ROLE_REVEAL) {
    const player = gameState.players[gameState.currentTurnIndex];
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <h2 className="text-2xl text-gray-300 mb-2">Hola, {player.name}</h2>
        <h3 className="text-xl mb-6">Tu rol es:</h3>
        
        <div className="bg-slate-800 p-8 rounded-2xl border-4 border-gold-costeno mb-8 w-full shadow-2xl">
          <div className="text-6xl mb-4">
            {player.role === Role.MAFIA ? '👹' : 
             player.role === Role.DOCTOR ? '💉' : 
             player.role === Role.DETECTIVE ? '🕵️‍♂️' : '👨‍🌾'}
          </div>
          <h1 className={`text-4xl font-marker mb-4
            ${player.role === Role.MAFIA ? 'text-red-500' : 
              player.role === Role.DOCTOR ? 'text-blue-400' : 
              player.role === Role.DETECTIVE ? 'text-purple-400' : 'text-green-400'}`}>
            {player.role}
          </h1>
          <p className="text-lg text-white font-medium italic">
            "{ROLE_DESCRIPTIONS[player.role]}"
          </p>
        </div>

        <Button onClick={() => {
          if (gameState.currentTurnIndex < gameState.players.length - 1) {
            nextPlayerReveal();
          } else {
            setGameState({...gameState, phase: GamePhase.NIGHT_INTRO});
          }
        }}>
          {gameState.currentTurnIndex < gameState.players.length - 1 ? 'Entendido, siguiente' : '¡Listo, a jugar!'}
        </Button>
      </div>
    );
  }

  // 4. NIGHT INTRO
  if (gameState.phase === GamePhase.NIGHT_INTRO) {
    return (
      <div className="min-h-screen bg-tropical-night p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <Moon size={80} className="text-slate-400 mb-6 animate-pulse" />
        <h2 className="text-3xl font-marker text-white mb-6">Cayó la Noche</h2>
        <p className="text-xl text-gray-300 mb-8 italic">"{PHRASES.nightStart}"</p>
        <Button onClick={startNight}>
          Que empiece el desorden
        </Button>
      </div>
    );
  }

  // 5. NIGHT ACTIONS (MAFIA / DOCTOR / DETECTIVE)
  const isNightPhase = [GamePhase.NIGHT_MAFIA, GamePhase.NIGHT_DOCTOR, GamePhase.NIGHT_DETECTIVE].includes(gameState.phase);
  if (isNightPhase) {
    let title = "";
    let subtitle = "";
    let roleTurn = Role.MAFIA;
    let bgColor = "bg-tropical-night";
    let icon = <Skull size={40} />;

    if (gameState.phase === GamePhase.NIGHT_MAFIA) {
      title = "Turno de la Mafia";
      subtitle = PHRASES.mafiaTurn;
      roleTurn = Role.MAFIA;
      bgColor = "bg-red-900/20";
    } else if (gameState.phase === GamePhase.NIGHT_DOCTOR) {
      title = "Turno del Doctor";
      subtitle = PHRASES.doctorTurn;
      roleTurn = Role.DOCTOR;
      icon = <Shield size={40} />;
      bgColor = "bg-blue-900/20";
    } else if (gameState.phase === GamePhase.NIGHT_DETECTIVE) {
      title = "Turno del Detective";
      subtitle = PHRASES.detectiveTurn;
      roleTurn = Role.DETECTIVE;
      icon = <Eye size={40} />;
      bgColor = "bg-purple-900/20";
    }

    return (
      <div className={`min-h-screen ${bgColor} p-4 flex flex-col max-w-md mx-auto`}>
        <div className="text-center mb-6 mt-4">
          <div className="flex justify-center text-gold-costeno mb-2">{icon}</div>
          <h2 className="text-3xl font-marker text-white">{title}</h2>
          <p className="text-sm text-gray-300 italic mt-2 px-4">{subtitle}</p>
          <div className="mt-4 bg-black/50 p-2 rounded text-xs text-yellow-200 animate-pulse">
            ⚠️ Pásale el cel SOLO a {roleTurn === Role.MAFIA ? "la Mafia" : roleTurn === Role.DOCTOR ? "el Doctor" : "el Detective"}.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pb-20">
          {gameState.players.map(player => (
            <PlayerCard 
              key={player.id} 
              player={player}
              disabled={!player.isAlive}
              onClick={() => {
                if (!player.isAlive) return;
                handleNightAction(player.id);
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // 6. DETECTIVE RESULT
  if (gameState.phase === GamePhase.NIGHT_DETECTIVE_RESULT) {
    const investigatedId = gameState.nightActions.detectiveInvestigatedId;
    const investigatedPlayer = gameState.players.find(p => p.id === investigatedId);
    const isMafia = investigatedPlayer?.role === Role.MAFIA;

    return (
      <div className="min-h-screen bg-purple-900 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <Fingerprint size={64} className="text-purple-300 mb-6" />
        <h2 className="text-2xl font-bold text-white mb-2">Resultado de la Investigación</h2>
        <h3 className="text-xl text-gold-costeno mb-8">{investigatedPlayer?.name}</h3>
        
        <div className="bg-black/40 p-6 rounded-xl border-2 border-purple-500 mb-8">
          <p className="text-2xl font-marker">
            {isMafia ? "¡ES MAFIA! 👹" : "Es un ciudadano de bien 😇"}
          </p>
        </div>

        <Button onClick={() => {
          calculateDayResults(gameState.nightActions.mafiaTargetId, gameState.nightActions.doctorSavedId);
        }}>
          Ocultar y Amanecer
        </Button>
      </div>
    );
  }

  // 7. DAY ANNOUNCEMENT (Narrator)
  if (gameState.phase === GamePhase.DAY_ANNOUNCEMENT) {
    return (
      <div className="min-h-screen bg-sky-900 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <Sun size={80} className="text-yellow-400 mb-6 animate-spin-slow" />
        <h2 className="text-3xl font-marker text-white mb-6">¡Buenos Días!</h2>
        
        <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-600 mb-8 w-full">
          <p className="text-lg leading-relaxed">{gameState.dayMessage}</p>
        </div>

        <Button onClick={() => setGameState({...gameState, phase: GamePhase.DAY_DISCUSSION})}>
          Empezar el bochinche (Discusión)
        </Button>
      </div>
    );
  }

  // 8. DISCUSSION & VOTING
  if (gameState.phase === GamePhase.DAY_DISCUSSION || gameState.phase === GamePhase.DAY_VOTE) {
    const isVoting = gameState.phase === GamePhase.DAY_VOTE;
    return (
      <div className="min-h-screen bg-slate-800 p-4 flex flex-col max-w-md mx-auto">
        <header className="mb-4 text-center">
          <h2 className="text-2xl font-marker text-white">
            {isVoting ? "¡A Votar!" : "Debate Público"}
          </h2>
          <p className="text-gray-400 text-sm">
            {isVoting ? "Seleccionen al sospechoso para eliminarlo." : "Tienen 2 minutos para pelear."}
          </p>
        </header>

        {!isVoting ? (
          <div className="flex-1 flex flex-col justify-center items-center">
             <Volume2 size={60} className="text-gray-500 mb-4" />
             <p className="text-center text-xl italic text-gray-300 mb-8">
               "Hablen ahora o callen para siempre. ¿Quién tiene cara de culpable?"
             </p>
             <Button onClick={() => setGameState({...gameState, phase: GamePhase.DAY_VOTE})}>
               Ya hablamos, vamos a votar
             </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pb-20">
            {gameState.players.map(player => (
              <PlayerCard 
                key={player.id} 
                player={player}
                disabled={!player.isAlive}
                onClick={() => {
                  if(window.confirm(`¿Seguro que quieren echar a ${player.name}?`)) {
                    handleVoting(player.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // 9. ELIMINATION REVEAL
  if (gameState.phase === GamePhase.DAY_ELIMINATION_REVEAL) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <h2 className="text-3xl font-marker text-red-500 mb-6">¡LINCHAMIENTO!</h2>
        <div className="bg-slate-800 p-6 rounded-xl border-2 border-red-500 mb-8">
          <p className="text-xl text-white">{gameState.dayMessage}</p>
        </div>
        <Button onClick={() => setGameState({...gameState, phase: GamePhase.NIGHT_INTRO})}>
          Volver a Dormir
        </Button>
      </div>
    );
  }

  // 10. GAME OVER
  if (gameState.phase === GamePhase.GAME_OVER) {
    const isMafiaWin = gameState.winner === Role.MAFIA;
    return (
      <div className={`min-h-screen ${isMafiaWin ? 'bg-red-900' : 'bg-green-800'} p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto`}>
        <div className="text-8xl mb-6">{isMafiaWin ? '👺' : '🎉'}</div>
        <h1 className="text-5xl font-marker text-white mb-4">
          {isMafiaWin ? "GANA LA MAFIA" : "GANA EL PUEBLO"}
        </h1>
        <p className="text-xl text-white/90 mb-12 italic">
          {gameState.dayMessage}
        </p>

        <div className="w-full bg-black/30 rounded-xl p-4 mb-8 max-h-60 overflow-y-auto">
            <h3 className="text-white font-bold mb-2 border-b border-white/20 pb-1">Identidades Reales</h3>
            {gameState.players.map(p => (
                <div key={p.id} className="flex justify-between py-1 text-sm text-gray-200">
                    <span>{p.name}</span>
                    <span className="font-bold">{p.role}</span>
                </div>
            ))}
        </div>

        <Button variant="secondary" onClick={() => window.location.reload()}>
          <RotateCcw className="mr-2" size={20} /> Jugar Otra Vez
        </Button>
      </div>
    );
  }

  return <div>Estado desconocido</div>;
}