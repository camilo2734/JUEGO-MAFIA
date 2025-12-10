import React, { useState, useEffect, useRef } from 'react';
import { GamePhase, GameState, Player, Role } from './types';
import { EMOJIS, PHRASES, ROLE_DESCRIPTIONS } from './constants';
import { PlayerCard } from './components/PlayerCard';
import { HostPanel } from './components/HostPanel';
import { generateDayNarration, generateWinMessage } from './services/geminiService';
import { Moon, Sun, Shield, Eye, Skull, Play, RotateCcw, Volume2, Fingerprint, Plus, Minus, Crown, Menu } from 'lucide-react';

// --- Helper Functions ---

const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const assignRoles = (names: string[], config: { mafia: number, doctor: number, detective: number }): Player[] => {
  const total = names.length;
  const roles: Role[] = [];

  // Add configured roles
  for (let i = 0; i < config.mafia; i++) roles.push(Role.MAFIA);
  for (let i = 0; i < config.doctor; i++) roles.push(Role.DOCTOR);
  for (let i = 0; i < config.detective; i++) roles.push(Role.DETECTIVE);
  
  // Fill rest with Citizens
  while (roles.length < total) {
    roles.push(Role.CITIZEN);
  }

  // If configuration exceeds players (should be handled by validation, but safeguard here), truncate
  const finalRoles = roles.slice(0, total);

  const shuffledRoles = shuffleArray(finalRoles);
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

const Button = ({ onClick, children, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "w-full py-4 rounded-xl font-bold text-lg transition-all transform active:scale-95 shadow-lg flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-gold-costeno text-slate-900 hover:bg-yellow-300 disabled:bg-slate-700 disabled:text-slate-500",
    danger: "bg-danger-red text-white hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500",
    secondary: "bg-slate-600 text-white hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500",
    ghost: "bg-transparent border-2 border-slate-500 text-slate-300 hover:bg-slate-800"
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed transform-none' : ''}`}>
      {children}
    </button>
  );
};

const Counter = ({ label, value, onChange, min = 0, max }: { label: string, value: number, onChange: (v: number) => void, min?: number, max?: number }) => (
  <div className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700">
    <span className="text-gray-300 font-bold">{label}</span>
    <div className="flex items-center gap-3">
      <button 
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 flex items-center justify-center bg-slate-700 rounded-full hover:bg-slate-600 text-white"
      >
        <Minus size={16} />
      </button>
      <span className="w-6 text-center text-xl font-bold text-white">{value}</span>
      <button 
        onClick={() => onChange(max !== undefined ? Math.min(max, value + 1) : value + 1)}
        className="w-8 h-8 flex items-center justify-center bg-slate-700 rounded-full hover:bg-slate-600 text-white"
      >
        <Plus size={16} />
      </button>
    </div>
  </div>
);

// --- Layout Component defined OUTSIDE App to prevent re-renders ---
const MainLayout = ({ 
  children, 
  phase, 
  players, 
  isHostPanelOpen, 
  setIsHostPanelOpen 
}: { 
  children: React.ReactNode;
  phase: GamePhase;
  players: Player[];
  isHostPanelOpen: boolean;
  setIsHostPanelOpen: (v: boolean) => void;
}) => (
  <div className="min-h-screen bg-tropical-night relative">
    {phase !== GamePhase.SETUP && (
      <button 
        onClick={() => setIsHostPanelOpen(true)}
        className="fixed top-4 right-4 z-40 bg-slate-800 p-2 rounded-full border border-gold-costeno text-gold-costeno hover:bg-slate-700 shadow-lg"
        title="Panel del Host"
      >
        <Crown size={24} />
      </button>
    )}
    
    <HostPanel 
      isOpen={isHostPanelOpen} 
      onClose={() => setIsHostPanelOpen(false)} 
      players={players}
      phase={phase}
    />
    
    {children}
  </div>
);

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
  
  // New States
  const [roleConfig, setRoleConfig] = useState({ mafia: 1, doctor: 1, detective: 1 });
  const [voteSelectedId, setVoteSelectedId] = useState<string | null>(null);
  const [isHostPanelOpen, setIsHostPanelOpen] = useState(false);

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
    // Only trigger win if not already in game over to avoid loops
    if (gameState.phase === GamePhase.GAME_OVER) return;
    
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
    const totalPlayers = setupNames.length;
    const totalRoles = roleConfig.mafia + roleConfig.doctor + roleConfig.detective;

    if (totalPlayers < 4) {
      alert("¡Eche! Mínimo 4 pelagatos para jugar esto.");
      return;
    }
    if (roleConfig.mafia < 1) {
      alert("¡Ajá! ¿Y sin mafia cómo jugamos? Pon al menos un mafioso.");
      return;
    }
    if (totalRoles > totalPlayers) {
      alert(`¡No cuadran las cuentas! Tienes ${totalPlayers} jugadores pero asignaste ${totalRoles} roles especiales.`);
      return;
    }

    const players = assignRoles(setupNames, roleConfig);
    setGameState({
      ...gameState,
      players,
      phase: GamePhase.ROLE_REVEAL_INTERSTITIAL,
      currentTurnIndex: 0
    });
  };

  const resetGame = (keepNames: boolean) => {
    setGameState({
      phase: GamePhase.SETUP,
      players: [],
      currentTurnIndex: 0,
      nightActions: { mafiaTargetId: null, doctorSavedId: null, detectiveInvestigatedId: null },
      dayMessage: "",
      winner: null
    });
    setVoteSelectedId(null);
    if (!keepNames) {
      setSetupNames([]);
      setRoleConfig({ mafia: 1, doctor: 1, detective: 1 });
    }
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
    // Reset night actions ensures Detective can act again next round
    setGameState(prev => ({
      ...prev,
      nightActions: { mafiaTargetId: null, doctorSavedId: null, detectiveInvestigatedId: null },
      phase: GamePhase.NIGHT_MAFIA
    }));
  };

  const handleNightAction = (targetId: string) => {
    // Determine which roles are ALIVE to decide next phase
    const hasAliveDoctor = gameState.players.some(p => p.role === Role.DOCTOR && p.isAlive);
    const hasAliveDetective = gameState.players.some(p => p.role === Role.DETECTIVE && p.isAlive);

    if (gameState.phase === GamePhase.NIGHT_MAFIA) {
      setGameState(prev => ({
        ...prev,
        nightActions: { ...prev.nightActions, mafiaTargetId: targetId },
        phase: hasAliveDoctor ? GamePhase.NIGHT_DOCTOR : 
               hasAliveDetective ? GamePhase.NIGHT_DETECTIVE : 
               GamePhase.DAY_ANNOUNCEMENT
      }));

      // Immediate transition if roles are missing/dead
      if (!hasAliveDoctor && !hasAliveDetective) {
        calculateDayResults(targetId, null);
      }
    } 
    else if (gameState.phase === GamePhase.NIGHT_DOCTOR) {
      setGameState(prev => ({
        ...prev,
        nightActions: { ...prev.nightActions, doctorSavedId: targetId },
        phase: hasAliveDetective ? GamePhase.NIGHT_DETECTIVE : GamePhase.DAY_ANNOUNCEMENT
      }));

      if (!hasAliveDetective) {
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

  const handleConfirmVote = () => {
    if (!voteSelectedId) return;
    
    // Player chosen to be eliminated by the village
    const newPlayers = gameState.players.map(p => p.id === voteSelectedId ? { ...p, isAlive: false } : p);
    const eliminated = newPlayers.find(p => p.id === voteSelectedId);
    
    setVoteSelectedId(null); // Reset selection
    
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
    const totalAssigned = roleConfig.mafia + roleConfig.doctor + roleConfig.detective;
    const canStart = setupNames.length >= 4 && roleConfig.mafia > 0 && totalAssigned <= setupNames.length;

    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-6 flex flex-col max-w-md mx-auto min-h-screen">
          <header className="mb-6 text-center">
            <h1 className="text-4xl font-marker text-gold-costeno mb-2 drop-shadow-lg">El Sapo Infiltrado 🐸</h1>
            <p className="text-sea-blue font-bold">{PHRASES.welcome}</p>
          </header>

          <div className="flex-1 space-y-6 pb-20">
            {/* Name Input */}
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

            {/* Player List */}
            <div className="space-y-2">
              <h3 className="text-gray-400 font-bold uppercase text-sm flex justify-between">
                <span>Jugadores</span>
                <span className="text-gold-costeno">{setupNames.length}</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {setupNames.map((name, i) => (
                  <div key={i} className="bg-slate-700 px-3 py-2 rounded flex justify-between items-center animate-fadeIn">
                    <span className="truncate text-sm">{name}</span>
                    <button onClick={() => setSetupNames(setupNames.filter((_, idx) => idx !== i))} className="text-red-400 text-sm hover:text-red-300">✕</button>
                  </div>
                ))}
                {setupNames.length === 0 && <p className="text-gray-600 italic col-span-2 text-center py-2 text-sm">Agrega gente pa' empezar.</p>}
              </div>
            </div>

            {/* Role Config */}
            <div className="space-y-3 pt-2 border-t border-slate-700">
              <h3 className="text-gold-costeno font-bold uppercase text-sm text-center">Configuración de Roles</h3>
              <Counter 
                label="👹 Mafiosos" 
                value={roleConfig.mafia} 
                onChange={(v) => setRoleConfig({...roleConfig, mafia: v})} 
                min={1}
              />
              <Counter 
                label="💉 Médicos" 
                value={roleConfig.doctor} 
                onChange={(v) => setRoleConfig({...roleConfig, doctor: v})} 
              />
              <Counter 
                label="🕵️ Detectives" 
                value={roleConfig.detective} 
                onChange={(v) => setRoleConfig({...roleConfig, detective: v})} 
              />
              
              <div className="text-center text-xs mt-2">
                {totalAssigned > setupNames.length ? (
                  <span className="text-red-400 font-bold">¡Ojo! Hay más roles ({totalAssigned}) que jugadores ({setupNames.length}).</span>
                ) : (
                  <span className="text-gray-500">Ciudadanos restantes: {Math.max(0, setupNames.length - totalAssigned)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="fixed bottom-8 left-0 right-0 px-6 max-w-md mx-auto z-10">
            <Button onClick={startGame} disabled={!canStart} className={!canStart ? "grayscale" : ""}>
              ¡Arrancar la Vaina! <Play size={20}/>
            </Button>
            <p className="text-[10px] text-center text-gray-500 mt-2">Mínimo 4 jugadores | Roles ≤ Jugadores</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // 2. ROLE REVEAL INTERSTITIAL
  if (gameState.phase === GamePhase.ROLE_REVEAL_INTERSTITIAL) {
    const player = gameState.players[gameState.currentTurnIndex];
    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto min-h-screen">
          <div className="text-6xl mb-6">📱✋</div>
          <h2 className="text-3xl font-marker text-white mb-4">Host, pásale el celular a:</h2>
          <h1 className="text-5xl font-bold text-gold-costeno mb-8 animate-bounce">{player.name}</h1>
          <p className="text-gray-400 mb-8">Nadie más puede ver la pantalla, ¡pilas!</p>
          <Button onClick={() => setGameState({...gameState, phase: GamePhase.ROLE_REVEAL})}>
            Ya lo tengo yo, ¡muéstrame!
          </Button>
        </div>
      </MainLayout>
    );
  }

  // 3. ROLE REVEAL
  if (gameState.phase === GamePhase.ROLE_REVEAL) {
    const player = gameState.players[gameState.currentTurnIndex];
    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto min-h-screen">
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
            {gameState.currentTurnIndex < gameState.players.length - 1 ? 'Entendido, devolver al Host' : '¡Listo, devolver al Host!'}
          </Button>
        </div>
      </MainLayout>
    );
  }

  // 4. NIGHT INTRO
  if (gameState.phase === GamePhase.NIGHT_INTRO) {
    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto min-h-screen">
          <Moon size={80} className="text-slate-400 mb-6 animate-pulse" />
          <h2 className="text-3xl font-marker text-white mb-6">Cayó la Noche</h2>
          <p className="text-xl text-gray-300 mb-8 italic">"{PHRASES.nightStart}"</p>
          <div className="bg-slate-800/50 p-4 rounded-lg mb-8 border border-slate-600">
             <p className="text-gold-costeno font-bold">Instrucción para el Host:</p>
             <p className="text-sm text-gray-300">Toma el control del celular. Tú guiarás a los jugadores durante la noche.</p>
          </div>
          <Button onClick={startNight}>
            Que empiece el desorden
          </Button>
        </div>
      </MainLayout>
    );
  }

  // 5. NIGHT ACTIONS
  const isNightPhase = [GamePhase.NIGHT_MAFIA, GamePhase.NIGHT_DOCTOR, GamePhase.NIGHT_DETECTIVE].includes(gameState.phase);
  if (isNightPhase) {
    let title = "";
    let subtitle = "";
    let instruction = "";
    let roleTurn = Role.MAFIA;
    let bgColor = "bg-tropical-night";
    let icon = <Skull size={40} />;

    if (gameState.phase === GamePhase.NIGHT_MAFIA) {
      title = "Turno de la Mafia";
      subtitle = PHRASES.mafiaTurn;
      instruction = "Host: Llama a la Mafia y pásales el celular.";
      roleTurn = Role.MAFIA;
      bgColor = "bg-red-900/20";
    } else if (gameState.phase === GamePhase.NIGHT_DOCTOR) {
      title = "Turno del Doctor";
      subtitle = PHRASES.doctorTurn;
      instruction = "Host: Llama al Doctor y pásale el celular.";
      roleTurn = Role.DOCTOR;
      icon = <Shield size={40} />;
      bgColor = "bg-blue-900/20";
    } else if (gameState.phase === GamePhase.NIGHT_DETECTIVE) {
      title = "Turno del Detective";
      subtitle = PHRASES.detectiveTurn;
      instruction = "Host: Llama al Detective y pásale el celular.";
      roleTurn = Role.DETECTIVE;
      icon = <Eye size={40} />;
      bgColor = "bg-purple-900/20";
    }

    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className={`min-h-screen ${bgColor} p-4 flex flex-col max-w-md mx-auto`}>
          <div className="text-center mb-6 mt-12">
            <div className="flex justify-center text-gold-costeno mb-2">{icon}</div>
            <h2 className="text-3xl font-marker text-white">{title}</h2>
            <div className="bg-black/40 border border-gold-costeno/30 p-3 rounded-lg my-4 mx-4">
               <p className="text-gold-costeno font-bold text-sm uppercase">👁️ Instrucción para el Host</p>
               <p className="text-white font-medium">{instruction}</p>
            </div>
            <p className="text-sm text-gray-400 italic mt-2 px-4">{subtitle}</p>
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
      </MainLayout>
    );
  }

  // 6. DETECTIVE RESULT
  if (gameState.phase === GamePhase.NIGHT_DETECTIVE_RESULT) {
    const investigatedId = gameState.nightActions.detectiveInvestigatedId;
    const investigatedPlayer = gameState.players.find(p => p.id === investigatedId);
    const isMafia = investigatedPlayer?.role === Role.MAFIA;

    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto min-h-screen bg-purple-900/50">
          <Fingerprint size={64} className="text-purple-300 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">Resultado de la Investigación</h2>
          <h3 className="text-xl text-gold-costeno mb-8">{investigatedPlayer?.name}</h3>
          
          <div className="bg-black/40 p-6 rounded-xl border-2 border-purple-500 mb-8 w-full">
            <p className="text-2xl font-marker">
              {isMafia ? "¡ES MAFIA! 👹" : "Es un ciudadano de bien 😇"}
            </p>
          </div>

          <div className="bg-slate-800/80 p-3 rounded mb-6 w-full">
             <p className="text-xs text-gray-300 uppercase font-bold">Host:</p>
             <p className="text-sm">Recibe el celular del detective antes de continuar.</p>
          </div>

          <Button onClick={() => {
            calculateDayResults(gameState.nightActions.mafiaTargetId, gameState.nightActions.doctorSavedId);
          }}>
            Ocultar y Amanecer
          </Button>
        </div>
      </MainLayout>
    );
  }

  // 7. DAY ANNOUNCEMENT (Narrator)
  if (gameState.phase === GamePhase.DAY_ANNOUNCEMENT) {
    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto min-h-screen bg-sky-900/50">
          <Sun size={80} className="text-yellow-400 mb-6 animate-spin-slow" />
          <h2 className="text-3xl font-marker text-white mb-6">¡Buenos Días!</h2>
          
          <div className="bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-600 mb-8 w-full">
            <p className="text-lg leading-relaxed">{gameState.dayMessage}</p>
          </div>

          <Button onClick={() => setGameState({...gameState, phase: GamePhase.DAY_DISCUSSION})}>
            Empezar el bochinche (Discusión)
          </Button>
        </div>
      </MainLayout>
    );
  }

  // 8. DISCUSSION & VOTING
  if (gameState.phase === GamePhase.DAY_DISCUSSION || gameState.phase === GamePhase.DAY_VOTE) {
    const isVoting = gameState.phase === GamePhase.DAY_VOTE;
    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-4 flex flex-col max-w-md mx-auto min-h-screen">
          <header className="mb-4 text-center mt-8">
            <h2 className="text-2xl font-marker text-white">
              {isVoting ? "¡A Votar!" : "Debate Público"}
            </h2>
            <p className="text-gray-400 text-sm">
              {isVoting ? "Host: Coordina la votación y selecciona al eliminado." : "Tienen 2 minutos para pelear."}
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
            <>
              <div className="grid grid-cols-2 gap-3 pb-32 overflow-y-auto">
                {gameState.players.map(player => (
                  <PlayerCard 
                    key={player.id} 
                    player={player}
                    disabled={!player.isAlive}
                    isSelected={voteSelectedId === player.id}
                    onClick={() => {
                      if (player.isAlive) setVoteSelectedId(player.id);
                    }}
                  />
                ))}
              </div>
              
              {/* Confirmation Footer */}
              <div className={`fixed bottom-8 left-0 right-0 px-6 max-w-md mx-auto transition-all transform ${voteSelectedId ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
                <Button variant="danger" onClick={handleConfirmVote}>
                    <Skull className="inline mr-2" /> 
                    ¡ECHAR A ESTE SAPO!
                </Button>
                <button onClick={() => setVoteSelectedId(null)} className="w-full text-gray-400 text-sm mt-3 underline">
                    Cancelar selección
                </button>
              </div>
            </>
          )}
        </div>
      </MainLayout>
    );
  }

  // 9. ELIMINATION REVEAL
  if (gameState.phase === GamePhase.DAY_ELIMINATION_REVEAL) {
    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className="p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto min-h-screen">
          <h2 className="text-3xl font-marker text-red-500 mb-6">¡LINCHAMIENTO!</h2>
          <div className="bg-slate-800 p-6 rounded-xl border-2 border-red-500 mb-8">
            <p className="text-xl text-white">{gameState.dayMessage}</p>
          </div>
          <Button onClick={() => setGameState({...gameState, phase: GamePhase.NIGHT_INTRO})}>
            Volver a Dormir
          </Button>
        </div>
      </MainLayout>
    );
  }

  // 10. GAME OVER
  if (gameState.phase === GamePhase.GAME_OVER) {
    const isMafiaWin = gameState.winner === Role.MAFIA;
    return (
      <MainLayout 
        phase={gameState.phase} 
        players={gameState.players} 
        isHostPanelOpen={isHostPanelOpen} 
        setIsHostPanelOpen={setIsHostPanelOpen}
      >
        <div className={`p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto min-h-screen ${isMafiaWin ? 'bg-red-900' : 'bg-green-800'}`}>
          <div className="text-8xl mb-6">{isMafiaWin ? '👺' : '🎉'}</div>
          <h1 className="text-5xl font-marker text-white mb-4">
            {isMafiaWin ? "GANA LA MAFIA" : "GANA EL PUEBLO"}
          </h1>
          <p className="text-xl text-white/90 mb-12 italic">
            {gameState.dayMessage}
          </p>

          <div className="space-y-4 w-full">
             <Button variant="primary" onClick={() => resetGame(true)}>
               <RotateCcw className="mr-2" size={20} /> Jugar de Nuevo (Mismos Equipos)
             </Button>
             
             <Button variant="ghost" onClick={() => resetGame(false)}>
               Nuevo Juego (Desde Cero)
             </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return <div>Estado desconocido</div>;
}