/**
 * ฐานข้อมูล SQLite (better-sqlite3) + ฟังก์ชัน query ทั้งหมด
 * - เปิดแบบ long-lived (singleton)
 * - เปิดโหมด WAL เพื่อรองรับ read/write พร้อมกันจากหลาย connection ได้ดี
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_DIR = path.join(process.cwd(), 'db');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = path.join(DB_DIR, 'tree-of-hope.db');

let _db = null;
function db() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  // รัน schema ตอนเปิดครั้งแรก
  const schema = fs.readFileSync(path.join(DB_DIR, 'schema.sql'), 'utf8');
  _db.exec(schema);
  return _db;
}

// ---------- ตัวช่วย ----------
function genCode() {
  // รหัส 6 หลัก เลข + ตัวอักษร (เอาอักษรที่สับสนง่ายออก)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  do {
    s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  } while (getRoomByCode(s)); // สุ่มใหม่ถ้าซ้ำ
  return s;
}

function genToken() {
  return crypto.randomBytes(16).toString('hex');
}

// ---------- rooms ----------
function createRoom({ q_leaf, q_flower, q_fruit }) {
  const code = genCode();
  const token = genToken();
  db().prepare(
    `INSERT INTO rooms (code, teacher_token, q_leaf, q_flower, q_fruit, current_phase)
     VALUES (?, ?, ?, ?, ?, 'answer_leaf')`
  ).run(code, token, q_leaf, q_flower, q_fruit);
  return getRoomByCode(code);
}

function getRoomByCode(code) {
  return db().prepare('SELECT * FROM rooms WHERE code = ?').get(code);
}

function getRoomById(id) {
  return db().prepare('SELECT * FROM rooms WHERE id = ?').get(id);
}

function getRoomByCodeAndToken(code, token) {
  return db().prepare('SELECT * FROM rooms WHERE code = ? AND teacher_token = ?').get(code, token);
}

function setPhase(roomId, phase) {
  db().prepare('UPDATE rooms SET current_phase = ? WHERE id = ?').run(phase, roomId);
}

// ---------- students ----------
function addStudent(roomId, name) {
  const info = db().prepare('INSERT INTO students (room_id, name) VALUES (?, ?)').run(roomId, name);
  return getStudent(info.lastInsertRowid);
}

function getStudent(id) {
  return db().prepare('SELECT * FROM students WHERE id = ?').get(id);
}

function getStudentsInRoom(roomId) {
  return db().prepare('SELECT * FROM students WHERE room_id = ? ORDER BY joined_at ASC').all(roomId);
}

// ---------- answers ----------
function addAnswer(roomId, studentId, kind, text) {
  // upsert: นักเรียน 1 คนตอบ kind นึงได้ 1 ครั้ง
  const existing = db()
    .prepare('SELECT id FROM answers WHERE room_id = ? AND student_id = ? AND kind = ?')
    .get(roomId, studentId, kind);
  if (existing) {
    db().prepare('UPDATE answers SET text = ? WHERE id = ?').run(text, existing.id);
    return getAnswer(existing.id);
  }
  const info = db()
    .prepare('INSERT INTO answers (room_id, student_id, kind, text) VALUES (?, ?, ?, ?)')
    .run(roomId, studentId, kind, text);
  return getAnswer(info.lastInsertRowid);
}

function getAnswer(id) {
  return db().prepare('SELECT * FROM answers WHERE id = ?').get(id);
}

function getAnswersInRoom(roomId) {
  return db().prepare('SELECT * FROM answers WHERE room_id = ?').all(roomId);
}

function getAnswersByStudent(studentId) {
  return db().prepare('SELECT * FROM answers WHERE student_id = ?').all(studentId);
}

// ---------- placements ----------
function addPlacement(p) {
  const info = db()
    .prepare(
      `INSERT INTO placements (room_id, student_id, kind, answer_id, emoji, x, y, scale, rotation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(p.room_id, p.student_id, p.kind, p.answer_id ?? null, p.emoji, p.x, p.y, p.scale ?? 1, p.rotation ?? 0);
  return getPlacement(info.lastInsertRowid);
}

function getPlacement(id) {
  return db().prepare('SELECT * FROM placements WHERE id = ?').get(id);
}

function getPlacementsInRoom(roomId) {
  return db().prepare('SELECT * FROM placements WHERE room_id = ? ORDER BY created_at ASC').all(roomId);
}

function getPlacementByStudentAndKind(roomId, studentId, kind) {
  return db()
    .prepare('SELECT * FROM placements WHERE room_id = ? AND student_id = ? AND kind = ?')
    .get(roomId, studentId, kind);
}

function deletePlacement(id) {
  db().prepare('DELETE FROM placements WHERE id = ?').run(id);
}

function clearPlacementsInRoom(roomId) {
  db().prepare('DELETE FROM placements WHERE room_id = ?').run(roomId);
}

function clearAnswersInRoom(roomId) {
  db().prepare('DELETE FROM answers WHERE room_id = ?').run(roomId);
}

function clearStudentsInRoom(roomId) {
  db().prepare('DELETE FROM students WHERE room_id = ?').run(roomId);
}

function clearRoomParticipants(roomId) {
  clearPlacementsInRoom(roomId);
  clearAnswersInRoom(roomId);
  clearStudentsInRoom(roomId);
}

// ---------- snapshot ทั้งห้อง ----------
function getRoomSnapshot(roomCode) {
  const room = getRoomByCode(roomCode);
  if (!room) return null;
  const students = getStudentsInRoom(room.id);
  const answers = getAnswersInRoom(room.id);
  const placements = getPlacementsInRoom(room.id);
  return { room, students, answers, placements };
}

module.exports = {
  db,
  createRoom,
  getRoomByCode,
  getRoomById,
  getRoomByCodeAndToken,
  setPhase,
  addStudent,
  getStudent,
  getStudentsInRoom,
  addAnswer,
  getAnswer,
  getAnswersInRoom,
  getAnswersByStudent,
  addPlacement,
  getPlacement,
  getPlacementsInRoom,
  getPlacementByStudentAndKind,
  deletePlacement,
  clearPlacementsInRoom,
  clearAnswersInRoom,
  clearStudentsInRoom,
  clearRoomParticipants,
  getRoomSnapshot,
};
