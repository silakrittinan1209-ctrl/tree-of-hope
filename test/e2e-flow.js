/**
 * สคริปต์ทดสอบ end-to-end ของ Socket.IO
 * จำลอง flow เต็มรูปแบบ: อาจารย์สร้างห้อง → ผู้เรียน 3 คนเข้าร่วม
 *   → ตอบใบไม้ → อาจารย์เปลี่ยน phase → วางใบไม้ → เปลี่ยน phase ต่อ...
 *   → ตรวจว่าทุกคนเห็นรายการที่วางแบบเรียลไทม์ + progress อัปเดตถูกต้อง
 */
const { io } = require('socket.io-client');

const BASE = process.env.BASE || 'http://localhost:3000';

function makeClient() {
  return io(BASE, { transports: ['websocket'] });
}

function log(msg) {
  console.log('  ' + msg);
}

(async () => {
  console.log('\n=== เริ่มทดสอบ Socket.IO E2E ===\n');

  // 0) สร้างห้องผ่าน REST API
  const res = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q_leaf: 'ความหวังของคุณคืออะไร?',
      q_flower: 'ความฝันของคุณคืออะไร?',
      q_fruit: 'อยากเก็บเกี่ยวผลอะไร?',
    }),
  });
  const roomData = await res.json();
  if (!roomData.ok) throw new Error('สร้างห้องไม่สำเร็จ');
  const code = roomData.code;
  const token = roomData.teacherToken;
  log(`สร้างห้องสำเร็จ: code=${code}`);

  // 1) สร้าง sockets: 1 อาจารย์ + 3 ผู้เรียน
  const teacher = makeClient();
  const s1 = makeClient();
  const s2 = makeClient();
  const s3 = makeClient();

  await once(teacher, 'connect');
  await Promise.all([once(s1, 'connect'), once(s2, 'connect'), once(s3, 'connect')]);
  log('ทุก client เชื่อมต่อแล้ว (1 อาจารย์ + 3 ผู้เรียน)');

  // 2) เข้าห้อง
  const teacherSnap = await emitAck(teacher, 'join_room', { roomCode: code, role: 'teacher' });
  assert(teacherSnap.ok, 'อาจารย์เข้าห้องได้');
  log('อาจารย์เข้าห้องแล้ว');

  const r1 = await emitAck(s1, 'join_room', { roomCode: code, role: 'student', name: 'น้องบีม' });
  const r2 = await emitAck(s2, 'join_room', { roomCode: code, role: 'student', name: 'น้องน้ำ' });
  const r3 = await emitAck(s3, 'join_room', { roomCode: code, role: 'student', name: 'น้องเพน' });
  assert(r1.ok && r2.ok && r3.ok, 'ผู้เรียนเข้าห้องได้ครบ');
  log(`ผู้เรียนเข้าห้องแล้ว: studentId = ${r1.studentId}, ${r2.studentId}, ${r3.studentId}`);

  // 3) phase ปัจจุบันต้องเป็น answer_leaf
  assert(r1.snapshot.room.current_phase === 'answer_leaf', 'phase เริ่มต้น = answer_leaf');
  log('phase เริ่มต้น = answer_leaf ✓');

  // 4) ตอบใบไม้ — ทั้ง 3 คน
  const a1 = await emitAck(s1, 'submit_answer', { roomCode: code, studentId: r1.studentId, kind: 'leaf', text: 'ครอบครัว' });
  const a2 = await emitAck(s2, 'submit_answer', { roomCode: code, studentId: r2.studentId, kind: 'leaf', text: 'เพื่อน' });
  const a3 = await emitAck(s3, 'submit_answer', { roomCode: code, studentId: r3.studentId, kind: 'leaf', text: 'อนาคต' });
  assert(a1.ok && a2.ok && a3.ok, 'ตอบใบไม้สำเร็จ');
  log('ผู้เรียนทั้ง 3 คนตอบใบไม้แล้ว ✓');

  // รอ progress มาถึงอาจารย์
  let progress1 = await waitFor(teacher, 'progress');
  assert(progress1.answered.leaf === 3, `progress answered.leaf = 3 (ได้ ${progress1.answered.leaf})`);
  log(`อาจารย์ได้ progress: answered.leaf=${progress1.answered.leaf} ✓`);

  // 5) ลองวางในตอนที่ยังอยู่ phase answer_leaf — ต้องถูกปฏิเสธ
  const earlyPlace = await emitAck(s1, 'place_item', {
    roomCode: code, studentId: r1.studentId, kind: 'leaf', emoji: '🍃', x: 50, y: 50,
  });
  assert(!earlyPlace.ok, 'วางในช่วง answer ต้องถูกปฏิเสธ');
  log('วางในช่วง "ตอบ" ถูกปฏิเสธอย่างถูกต้อง ✓');

  // 6) อาจารย์เปลี่ยน phase เป็น place_leaf
  teacher.emit('change_phase', { roomCode: code, token, direction: 'place_leaf' });
  const phaseEvt = await waitFor(s1, 'phase_changed');
  assert(phaseEvt.phase === 'place_leaf', 'phase เปลี่ยนเป็น place_leaf');
  log('อาจารย์เปลี่ยน phase เป็น place_leaf → ผู้เรียนได้รับการแจ้ง ✓');

  // 7) วางใบไม้ — แต่ละคนวาง 1 ชิ้น และทุกคนต้องเห็น
  const seenBy = { s1: 0, s2: 0, s3: 0, teacher: 0 };
  const counters = [
    [s1, 's1'], [s2, 's2'], [s3, 's3'], [teacher, 'teacher'],
  ];
  const offHandlers = counters.map(([sock, key]) => {
    const h = (data) => { seenBy[key]++; };
    sock.on('item_placed', h);
    return () => sock.off('item_placed', h);
  });

  const p1 = await emitAck(s1, 'place_item', { roomCode: code, studentId: r1.studentId, kind: 'leaf', answerId: a1.answer.id, emoji: '🍃', x: 30, y: 40 });
  const p2 = await emitAck(s2, 'place_item', { roomCode: code, studentId: r2.studentId, kind: 'leaf', answerId: a2.answer.id, emoji: '🌿', x: 60, y: 35 });
  const p3 = await emitAck(s3, 'place_item', { roomCode: code, studentId: r3.studentId, kind: 'leaf', answerId: a3.answer.id, emoji: '🍀', x: 50, y: 60 });
  assert(p1.ok && p2.ok && p3.ok, 'วางใบไม้สำเร็จ');

  await sleep(300); // รอ broadcast กระจาย
  offHandlers.forEach((off) => off());

  assert(seenBy.s1 === 3 && seenBy.s2 === 3 && seenBy.s3 === 3 && seenBy.teacher === 3,
    `ทุก client เห็นรายการ 3 รายการ (s1=${seenBy.s1}, s2=${seenBy.s2}, s3=${seenBy.s3}, teacher=${seenBy.teacher})`);
  log('ทุก client (รวมอาจารย์) เห็นรายการวาง 3 รายการแบบเรียลไทม์ ✓');

  // 8) sync_request เพื่อตรวจสถานะใหม่
  const sync = await emitAck(s1, 'sync_request', { roomCode: code });
  assert(sync.ok && sync.snapshot.placements.length === 3, `snapshot placements = 3 (ได้ ${sync.snapshot.placements.length})`);
  log(`sync_request คืน placements = ${sync.snapshot.placements.length} ✓`);

  // 9) อาจารย์เปลี่ยนผ่านทุก phase จนจบ
  const remaining = ['answer_flower', 'place_flower', 'answer_fruit', 'place_fruit'];
  for (const ph of remaining) {
    teacher.emit('change_phase', { roomCode: code, token, direction: ph });
    const ev = await waitFor(s1, 'phase_changed');
    assert(ev.phase === ph, `phase เปลี่ยนเป็น ${ph}`);
  }
  log('อาจารย์เปลี่ยน phase ผ่านทั้ง 6 ขั้นจนจบสำเร็จ ✓');

  // 10) ลบรายการ (อาจารย์)
  const beforeDel = (await emitAck(s1, 'sync_request', { roomCode: code })).snapshot.placements.length;
  teacher.emit('delete_item', { roomCode: code, placementId: p1.placement.id });
  const rmEv = await waitFor(s1, 'item_removed');
  assert(rmEv.placementId === p1.placement.id, 'ลบรายการสำเร็จ');
  const afterDel = (await emitAck(s1, 'sync_request', { roomCode: code })).snapshot.placements.length;
  assert(afterDel === beforeDel - 1, `จำนวนลดลง 1 (ก่อน=${beforeDel}, หลัง=${afterDel})`);
  log(`อาจารย์ลบรายการสำเร็จ (${beforeDel} → ${afterDel}) ✓`);

  // 11) reset_tree
  teacher.emit('reset_tree', { roomCode: code, token });
  await waitFor(s1, 'tree_reset');
  const afterReset = (await emitAck(s1, 'sync_request', { roomCode: code })).snapshot.placements.length;
  assert(afterReset === 0, `หลัง reset placements = 0 (ได้ ${afterReset})`);
  log('อาจารย์ reset ต้นไม้สำเร็จ ✓');

  console.log('\n✅ ผ่านการทดสอบ E2E ทั้งหมด!\n');

  // ปิด
  [teacher, s1, s2, s3].forEach((s) => s.disconnect());
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ การทดสอบล้มเหลว:', e.message);
  process.exit(1);
});

// ---------- helpers ----------
function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}
function emitAck(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, (ack) => resolve(ack)));
}
function waitFor(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`รอ ${event} หมดเวลา`)), timeout);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function assert(cond, msg) {
  if (!cond) throw new Error('ยืนยันไม่ผ่าน: ' + msg);
}
