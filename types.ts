export enum Role {
  MAFIA = 'MAFIA',
  DOCTOR = 'DOCTOR',
  DETECTIVE = 'DETECTIVE',
  CITIZEN = 'CIUDADANO'
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isAlive: boolean;
  avatar: string; // Emoji
}

export enum GamePhase {
  SETUP = 'SETUP',
  ROLE_REVEAL_INTERSTITIAL = 'ROLE_REVEAL_INTERSTITIAL',
  ROLE_REVEAL = 'ROLE_REVEAL',
  NIGHT_INTRO = 'NIGHT_INTRO',
  NIGHT_MAFIA = 'NIGHT_MAFIA',
  NIGHT_DOCTOR = 'NIGHT_DOCTOR',
  NIGHT_DETECTIVE = 'NIGHT_DETECTIVE',
  NIGHT_DETECTIVE_RESULT = 'NIGHT_DETECTIVE_RESULT',
  DAY_ANNOUNCEMENT = 'DAY_ANNOUNCEMENT',
  DAY_DISCUSSION = 'DAY_DISCUSSION',
  DAY_VOTE = 'DAY_VOTE',
  DAY_ELIMINATION_REVEAL = 'DAY_ELIMINATION_REVEAL',
  GAME_OVER = 'GAME_OVER'
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentTurnIndex: number; // For role reveal or specific logic
  nightActions: {
    mafiaTargetId: string | null;
    doctorSavedId: string | null;
    detectiveInvestigatedId: string | null;
  };
  dayMessage: string; // The funny result of the night
  winner: Role.MAFIA | Role.CITIZEN | null;
}

export interface RoleConfig {
  mafiaCount: number;
  hasDoctor: boolean;
  hasDetective: boolean;
}