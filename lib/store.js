/**
 * สถานะในหน่วยความจำต่อห้อง (เพิ่มความเร็วในการอ่าน/broadcast)
 * - ข้อมูลถาวรยังเก็บใน SQLite ทุก event (lib/db.js)
 * - in-memory เก็บแค่การแมป socket -> {roomCode, studentId, role} เพื่อ lookup เร็ว
 *
 * หมายเหตุ: หากอนาคตต้องขยายเป็นหลายเซิร์ฟเวอร์ ให้เปลี่ยนเป็น Redis adapter ของ Socket.IO
 * และย้ายสถานะนี้ไปไว้ใน Redis ด้วย
 */

// socket.id -> { roomCode, roomId, studentId, role: 'teacher' | 'student', name }
const session = new Map();

function setSession(socketId, data) {
  session.set(socketId, data);
}

function getSession(socketId) {
  return session.get(socketId);
}

function clearSession(socketId) {
  session.delete(socketId);
}

// นับจำนวน socket ที่อยู่ในห้องหนึ่งในขณะนี้ (ผ่าน io.sockets.adapter ก็ได้ แต่ทำที่นี่เพื่อเก็บ role ด้วย)
function listSessionsInRoom(roomCode) {
  const result = [];
  for (const [sid, s] of session.entries()) {
    if (s.roomCode === roomCode) result.push({ socketId: sid, ...s });
  }
  return result;
}

module.exports = {
  setSession,
  getSession,
  clearSession,
  listSessionsInRoom,
};
