/**
 * Socket.IO event handlers — หัวใจของระบบเรียลไทม์
 *
 * ขั้นตอน (phase) ที่อาจารย์ควบคุม:
 *   answer_leaf -> place_leaf -> answer_flower -> place_flower -> answer_fruit -> place_fruit
 *
 * การ broadcast ใช้ io.to(roomCode).emit(...) เพื่อส่งเฉพาะคนในห้องนั้น
 */
const DB = require('./db');
const store = require('./store');

// ลำดับ phase ทั้งหมด
const PHASES = [
  'answer_leaf',
  'place_leaf',
  'answer_flower',
  'place_flower',
  'answer_fruit',
  'place_fruit',
];

// map kind (leaf/flower/fruit) -> phase ที่ใช้ตอบ / วาง
const ANSWER_PHASE_FOR = { leaf: 'answer_leaf', flower: 'answer_flower', fruit: 'answer_fruit' };
const PLACE_PHASE_FOR = { leaf: 'place_leaf', flower: 'place_flower', fruit: 'place_fruit' };

function nextPhase(current) {
  const i = PHASES.indexOf(current);
  return i >= 0 && i < PHASES.length - 1 ? PHASES[i + 1] : current;
}
function prevPhase(current) {
  const i = PHASES.indexOf(current);
  return i > 0 ? PHASES[i - 1] : current;
}

function setupSocket(io) {
  // middleware: ตรวจสอบว่ามี roomCode ก่อนเข้าห้อง
  io.use((socket, next) => {
    next();
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // ---------- เข้าห้อง (นักเรียน / อาจารย์) ----------
    socket.on('join_room', ({ roomCode, role, name, studentId }, ack) => {
      const room = DB.getRoomByCode(roomCode);
      if (!room) {
        if (ack) ack({ ok: false, error: 'ไม่พบห้องที่มีรหัสนี้' });
        return;
      }

      // สร้าง student record (ถ้ายังไม่มี) สำหรับนักเรียน
      let sid = studentId;
      if (role === 'student') {
        if (!sid) {
          const student = DB.addStudent(room.id, name || 'ไม่ระบุชื่อ');
          sid = student.id;
        }
        socket.join(roomCode);
        store.setSession(socket.id, { roomCode, roomId: room.id, studentId: sid, role, name });
        console.log(`[socket] student "${name}" joined room ${roomCode}`);
      } else {
        // teacher
        socket.join(roomCode);
        store.setSession(socket.id, { roomCode, roomId: room.id, role: 'teacher' });
        console.log(`[socket] teacher opened room ${roomCode}`);
      }

      // ส่งสถานะปัจจุบันของห้องกลับไป
      const snapshot = DB.getRoomSnapshot(roomCode);
      if (ack) ack({ ok: true, studentId: sid, snapshot });

      // แจ้งอาจารย์ว่ามีคนเข้าใหม่ (เพื่ออัปเดต progress)
      io.to(roomCode).emit('students_updated', { students: snapshot.students });
    });

    // ---------- ส่งคำตอบ ----------
    socket.on('submit_answer', ({ roomCode, studentId, kind, text }, ack) => {
      const room = DB.getRoomByCode(roomCode);
      if (!room) {
        if (ack) ack({ ok: false, error: 'ไม่พบห้อง' });
        return;
      }
      // ตรวจ phase: ต้องอยู่ใน answer_<kind> ถึงจะตอบได้
      if (room.current_phase !== ANSWER_PHASE_FOR[kind]) {
        if (ack) ack({ ok: false, error: `ตอนนี้ยังไม่ใช่ช่วงตอบ${kindLabel(kind)}` });
        return;
      }
      const answer = DB.addAnswer(room.id, studentId, kind, String(text || '').trim());
      if (ack) ack({ ok: true, answer });

      // อัปเดต progress ของอาจารย์
      broadcastProgress(io, roomCode);
    });

    // ---------- วางรายการ ----------
    socket.on('place_item', ({ roomCode, studentId, kind, answerId, emoji, x, y, scale, rotation }, ack) => {
      const room = DB.getRoomByCode(roomCode);
      if (!room) {
        if (ack) ack({ ok: false, error: 'ไม่พบห้อง' });
        return;
      }
      // ตรวจ phase: ต้องอยู่ใน place_<kind>
      if (room.current_phase !== PLACE_PHASE_FOR[kind]) {
        if (ack) ack({ ok: false, error: `ตอนนี้ยังไม่ใช่ช่วงวาง${kindLabel(kind)}` });
        return;
      }
      // แต่ละนักเรียนวางได้ 1 ครั้งต่อ 1 ประเภท (leaf/flower/fruit)
      const existing = DB.getPlacementByStudentAndKind(room.id, studentId, kind);
      if (existing) {
        if (ack) ack({ ok: false, error: 'คุณได้วางรายการประเภทนี้แล้ว' });
        return;
      }
      const placement = DB.addPlacement({
        room_id: room.id,
        student_id: studentId,
        kind,
        answer_id: answerId ?? null,
        emoji,
        x: clamp(x, 0, 100),
        y: clamp(y, 0, 100),
        scale: scale ?? 1,
        rotation: rotation ?? 0,
      });
      if (ack) ack({ ok: true, placement });

      // broadcast ไปยังทุกคนในห้องให้วาดรายการใหม่
      // หากมีคำตอบที่ผูกไว้ ให้รวมคำตอบนั้นไปด้วยเพื่อให้หน้าจออาจารย์แสดงทันที
      const answer = placement.answer_id ? DB.getAnswer(placement.answer_id) : null;
      io.to(roomCode).emit('item_placed', {
        placement,
        studentName: nameFor(studentId),
        answer: answer ? { id: answer.id, text: answer.text, studentId: answer.student_id } : null,
      });
    });

    // ---------- ลบรายการ (เฉพาะเจ้าของหรืออาจารย์) ----------
    socket.on('delete_item', ({ roomCode, placementId, studentId }) => {
      const placement = DB.getPlacement(placementId);
      if (!placement) return;
      const sess = store.getSession(socket.id);
      const isTeacher = sess && sess.role === 'teacher';
      const isOwner = String(placement.student_id) === String(studentId);
      if (!isTeacher && !isOwner) return;
      DB.deletePlacement(placementId);
      io.to(roomCode).emit('item_removed', { placementId });
    });

    // ---------- อาจารย์ควบคุม phase ----------
    socket.on('change_phase', ({ roomCode, token, direction }) => {
      const room = DB.getRoomByCode(roomCode);
      if (!room) return;
      const verified = DB.getRoomByCodeAndToken(roomCode, token);
      if (!verified) return; // ป้องกันคนที่ไม่ใช่อาจารย์เปลี่ยน phase

      const newPhase =
        direction === 'next'
          ? nextPhase(room.current_phase)
          : direction === 'prev'
          ? prevPhase(room.current_phase)
          : direction; // อนุญาตให้ตั้ง phase ตรง ๆ ได้ด้วย
      if (newPhase === room.current_phase) return;
      DB.setPhase(room.id, newPhase);
      io.to(roomCode).emit('phase_changed', { phase: newPhase });
      broadcastProgress(io, roomCode);
    });

    // ---------- อาจารย์ล้างต้นไม้ ----------
    socket.on('reset_tree', ({ roomCode, token }, ack) => {
      const verified = DB.getRoomByCodeAndToken(roomCode, token);
      if (!verified) {
        if (ack) ack({ ok: false, error: 'ไม่อนุญาตให้ล้างต้นไม้' });
        return;
      }
      DB.clearRoomParticipants(verified.id);
      const snapshot = DB.getRoomSnapshot(roomCode);
      io.to(roomCode).emit('tree_reset');
      io.to(roomCode).emit('room_reset', { snapshot });
      broadcastProgress(io, roomCode);
      if (ack) ack({ ok: true });
    });

    // ---------- ขอสถานะล่าสุด ----------
    socket.on('sync_request', ({ roomCode }, ack) => {
      const snapshot = DB.getRoomSnapshot(roomCode);
      if (ack) ack({ ok: true, snapshot });
    });

    // ---------- ตัดการเชื่อมต่อ ----------
    socket.on('disconnect', () => {
      const sess = store.getSession(socket.id);
      store.clearSession(socket.id);
      if (sess) {
        console.log(`[socket] disconnected: ${socket.id} (room ${sess.roomCode})`);
        // แจ้งนับคนออนไลน์ใหม่ (ไม่ได้ลบนักเรียนออกจาก DB ยังเก็บประวัติไว้)
        io.to(sess.roomCode).emit('presence', {
          online: store.listSessionsInRoom(sess.roomCode).length,
        });
      }
    });
  });
}

// ---------- ตัวช่วย ----------
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function kindLabel(kind) {
  return kind === 'leaf' ? 'ใบไม้' : kind === 'flower' ? 'ดอกไม้' : 'ผลไม้';
}

function nameFor(studentId) {
  const s = DB.getStudent(studentId);
  return s ? s.name : 'ไม่ระบุชื่อ';
}

// คำนวณและส่ง progress ให้อาจารย์: แต่ละ phase มีกี่คนทำเสร็จ
function broadcastProgress(io, roomCode) {
  const snapshot = DB.getRoomSnapshot(roomCode);
  if (!snapshot) return;
  const { room, students, answers, placements } = snapshot;

  // นับจำนวนนักเรียนที่ตอบแต่ละ kind แล้ว
  const answered = { leaf: 0, flower: 0, fruit: 0 };
  for (const a of answers) answered[a.kind] = (answered[a.kind] || 0) + 1;
  // นับจำนวนรายการที่วางแต่ละ kind แล้ว
  const placed = { leaf: 0, flower: 0, fruit: 0 };
  for (const p of placements) placed[p.kind] = (placed[p.kind] || 0) + 1;

  io.to(roomCode).emit('progress', {
    phase: room.current_phase,
    totalStudents: students.length,
    answered,
    placed,
    // รายชื่อ + สถานะคำตอบของแต่ละคน (สำหรับตาราง progress)
    rows: students.map((s) => ({
      id: s.id,
      name: s.name,
      leafAnswer: answers.find((a) => a.student_id === s.id && a.kind === 'leaf')?.text ?? '',
      flowerAnswer: answers.find((a) => a.student_id === s.id && a.kind === 'flower')?.text ?? '',
      fruitAnswer: answers.find((a) => a.student_id === s.id && a.kind === 'fruit')?.text ?? '',
      placedCount: placements.filter((p) => p.student_id === s.id).length,
    })),
  });
}

module.exports = { setupSocket, PHASES };
