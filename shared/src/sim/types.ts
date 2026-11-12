import type { EnemyTypeId } from '../config/enemies';
import type { AbilityId, RewardId } from '../config/game';
import type { TowerTypeId } from '../config/towers';

export type Role = 'strategist' | 'hero';
export type Phase = 'prep' | 'wave' | 'inter' | 'over';
export type Targeting = 'first' | 'strong' | 'weak' | 'fast';
export type AiPriority = 'high' | 'normal' | 'sacrifice';
export type Posture = 'prudente' | 'equilibree' | 'agressive';

export interface TowerState {
  id: number;
  type: TowerTypeId;
  slotId: number;
  x: number;
  y: number;
  hp: number;
  /** Usure : part des PV max encore disponible (1 = neuve). */
  maxHpFactor: number;
  /** Nœuds d'amélioration choisis, dans l'ordre. */
  path: string[];
  /** Total dépensé dans la tour (construction + améliorations). */
  invested: number;
  cooldown: number;
  /** -1 = munitions illimitées. */
  ammo: number;
  targeting: Targeting;
  aiPriority: AiPriority;
  disabledFor: number;
  overchargeFor: number;
  /** Rayon focalisé : cible suivie et nombre de tirs consécutifs dessus. */
  focusId: number;
  focus: number;
}

export interface EnemyState {
  id: number;
  type: EnemyTypeId;
  pathIdx: number;
  /** Distance parcourue le long du chemin, en cases. */
  d: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  attack: number;
  bounty: number;
  slowFor: number;
  slowFactor: number;
  dotFor: number;
  dotDps: number;
  atkCd: number;
  spawnCd: number;
  /** Temps déjà passé à l'arrêt pour tirer (les tireurs ne s'arrêtent qu'un temps limité). */
  halted: number;
}

export interface PickupState {
  id: number;
  x: number;
  y: number;
  value: number;
  ttl: number;
}

export type HeroTask =
  | { kind: 'idle' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'repair'; towerId: number }
  | { kind: 'reload'; towerId: number }
  | { kind: 'recycle'; towerId: number }
  | { kind: 'harvest'; depositId: number }
  | { kind: 'prospect'; zoneId: number }
  | { kind: 'collect'; pickupId: number }
  | { kind: 'deliver' };

export interface HeroState {
  x: number;
  y: number;
  hp: number;
  carry: number;
  task: HeroTask;
  /** Avancement de l'action en cours (0..1), pour l'affichage. */
  progress: number;
  respawnIn: number;
  /** Le délai est écoulé mais le stock ne suffit pas à payer la remise en route : le héros attend. */
  waitingRevive: boolean;
  upgrades: string[];
}

export interface AiOrder {
  kind: 'repair' | 'retreat' | 'harvest';
  targetId?: number;
  /** Temps restant avant que l'ordre expire. */
  ttl: number;
}

export interface AiSettings {
  /** Part du stock (au début de chaque phase) que l'IA peut dépenser seule en réparations. */
  repairBudgetPct: number;
  /** L'IA répare une tour quand ses PV passent sous cette part. */
  repairThreshold: number;
  posture: Posture;
}

export interface AiState extends AiSettings {
  allowance: number;
  spent: number;
  order: AiOrder | null;
  orderCooldown: number;
  /** Dernier message de l'IA au stratège. */
  message: string;
}

export interface GameState {
  tick: number;
  time: number;
  phase: Phase;
  phaseTimer: number;
  wave: number;
  baseHp: number;
  /** La ressource commune. */
  scrap: number;
  towers: TowerState[];
  enemies: EnemyState[];
  pickups: PickupState[];
  hero: HeroState;
  /** Stock restant de chaque gisement (même ordre que map.deposits). */
  deposits: number[];
  /** Vague à partir de laquelle chaque zone de prospection est de nouveau disponible. */
  prospects: number[];
  ai: AiState;
  heroController: 'ai' | 'human';
  abilities: Record<AbilityId, number>;
  cooldownMult: number;
  rewardChoices: RewardId[] | null;
  /** Ennemis restant à faire apparaître dans la vague. */
  toSpawn: number;
  bossesKilled: number;
}

/** Événements ponctuels, pour les effets visuels et les messages côté client. */
export type GameEvent =
  /** `chain` : positions successives des rebonds de la foudre, à plat [x1, y1, x2, y2, …]. */
  | { t: 'shot'; kind: TowerTypeId; fx: number; fy: number; tx: number; ty: number; splash: number; chain?: number[] }
  | { t: 'heal'; x: number; y: number; radius: number }
  | { t: 'blast'; x: number; y: number; radius: number }
  | { t: 'hit'; x: number; y: number; target: 'tower' | 'hero' }
  | { t: 'death'; x: number; y: number; boss: boolean }
  | { t: 'ability'; id: AbilityId; x: number; y: number; radius: number }
  | { t: 'msg'; from: 'ia' | 'jeu'; text: string }
  | { t: 'wave'; wave: number; boss: boolean }
  | { t: 'over'; wave: number };

/** Commandes : humain et IA envoient exactement les mêmes. */
export type StrategistCommand =
  | { c: 'build'; slotId: number; type: TowerTypeId }
  | { c: 'upgrade'; towerId: number; nodeId: string }
  | { c: 'respec'; towerId: number }
  | { c: 'sell'; towerId: number }
  | { c: 'moveTower'; towerId: number; slotId: number }
  | { c: 'targeting'; towerId: number; mode: Targeting }
  | { c: 'ability'; id: AbilityId; x?: number; y?: number; towerId?: number }
  | { c: 'aiSettings'; settings: Partial<AiSettings> }
  | { c: 'aiPriority'; towerId: number; priority: AiPriority }
  | { c: 'aiOrder'; kind: AiOrder['kind']; targetId?: number }
  | { c: 'reward'; id: RewardId }
  | { c: 'ready' };

export type HeroCommand =
  | { c: 'task'; task: HeroTask }
  | { c: 'heroUpgrade'; nodeId: string };

export type Command = StrategistCommand | HeroCommand;

export const HERO_COMMANDS: ReadonlySet<string> = new Set(['task', 'heroUpgrade']);
export const roleOfCommand = (cmd: Command): Role => (HERO_COMMANDS.has(cmd.c) ? 'hero' : 'strategist');
