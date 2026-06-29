// Shared types ที่ใช้ทั้งฝั่ง client และ server

export type Kind = 'leaf' | 'flower' | 'fruit';

export type Phase =
  | 'answer_leaf'
  | 'place_leaf'
  | 'answer_flower'
  | 'place_flower'
  | 'answer_fruit'
  | 'place_fruit';

export const PHASES: Phase[] = [
  'answer_leaf',
  'place_leaf',
  'answer_flower',
  'place_flower',
  'answer_fruit',
  'place_fruit',
];

export interface Room {
  id: number;
  code: string;
  teacher_token: string;
  q_leaf: string;
  q_flower: string;
  q_fruit: string;
  current_phase: Phase;
  created_at: string;
}

export interface Student {
  id: number;
  room_id: number;
  name: string;
  joined_at: string;
}

export interface Answer {
  id: number;
  room_id: number;
  student_id: number;
  kind: Kind;
  text: string;
  created_at: string;
}

export interface Placement {
  id: number;
  room_id: number;
  student_id: number;
  kind: Kind;
  answer_id: number | null;
  emoji: string;
  x: number; // 0-100 %
  y: number; // 0-100 %
  scale: number;
  rotation: number;
  created_at: string;
}

export interface Snapshot {
  room: Room;
  students: Student[];
  answers: Answer[];
  placements: Placement[];
}

export interface ProgressRow {
  id: number;
  name: string;
  leafAnswer: string;
  flowerAnswer: string;
  fruitAnswer: string;
  placedCount: number;
}

export interface ProgressData {
  phase: Phase;
  totalStudents: number;
  answered: { leaf: number; flower: number; fruit: number };
  placed: { leaf: number; flower: number; fruit: number };
  rows: ProgressRow[];
}

// emoji สำหรับแต่ละ kind
export const EMOJIS: Record<Kind, string[]> = {
  leaf: ['🍃', '🌿', '🍀'],
  flower: ['🌸', '🌷', '🌻', '🌼'],
  fruit: ['🍎', '🍊', '🍇', '🍓'],
};

export const KIND_LABEL: Record<Kind, string> = {
  leaf: 'ใบไม้',
  flower: 'ดอกไม้',
  fruit: 'ผลไม้',
};

export const KIND_QUESTION: Record<Kind, keyof Room> = {
  leaf: 'q_leaf',
  flower: 'q_flower',
  fruit: 'q_fruit',
};

// ดึง kind จาก phase
export function kindFromPhase(phase: Phase): Kind {
  if (phase.includes('leaf')) return 'leaf';
  if (phase.includes('flower')) return 'flower';
  return 'fruit';
}

// ดึง action จาก phase ('answer' | 'place')
export function actionFromPhase(phase: Phase): 'answer' | 'place' {
  return phase.startsWith('answer') ? 'answer' : 'place';
}

export const PHASE_LABEL: Record<Phase, string> = {
  answer_leaf: 'ตอบคำถาม: ใบไม้',
  place_leaf: 'วางใบไม้',
  answer_flower: 'ตอบคำถาม: ดอกไม้',
  place_flower: 'วางดอกไม้',
  answer_fruit: 'ตอบคำถาม: ผลไม้',
  place_fruit: 'วางผลไม้',
};
