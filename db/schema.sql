-- Schema ของฐานข้อมูล Tree of Hope
-- รันโดยอัตโนมัติตอนเปิดเซิร์ฟเวอร์ครั้งแรก (lib/db.js)

CREATE TABLE IF NOT EXISTS rooms (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,            -- รหัสห้อง 6 หลัก
  teacher_token TEXT NOT NULL,                   -- token สำหรับเข้าหน้าอาจารย์
  q_leaf        TEXT NOT NULL,                   -- คำถามใบไม้
  q_flower      TEXT NOT NULL,                   -- คำถามดอกไม้
  q_fruit       TEXT NOT NULL,                   -- คำถามผลไม้
  current_phase TEXT NOT NULL DEFAULT 'answer_leaf', -- phase ปัจจุบัน
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    INTEGER NOT NULL,
  name       TEXT NOT NULL,
  joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE IF NOT EXISTS answers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  kind       TEXT NOT NULL,   -- leaf | flower | fruit
  text       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS placements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id    INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  kind       TEXT NOT NULL,   -- leaf | flower | fruit
  answer_id  INTEGER,         -- เชื่อมกับคำตอบ (อาจเป็น NULL ถ้าวางโดยไม่ตอบ)
  emoji      TEXT NOT NULL,
  x          REAL NOT NULL,   -- เปอร์เซ็นต์ 0-100 ของความกว้าง canvas
  y          REAL NOT NULL,   -- เปอร์เซ็นต์ 0-100 ของความสูง canvas
  scale      REAL NOT NULL DEFAULT 1,
  rotation   REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES rooms(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_placements_room ON placements(room_id);
CREATE INDEX IF NOT EXISTS idx_answers_room ON answers(room_id, student_id);
CREATE INDEX IF NOT EXISTS idx_students_room ON students(room_id);
