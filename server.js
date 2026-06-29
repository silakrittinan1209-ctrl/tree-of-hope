/**
 * Custom Node server — Next.js + Socket.IO + REST API บน HTTP server ตัวเดียวกัน
 * API routes อยู่ที่นี่เลย (ไม่ผ่าน Next App Router) เพื่อกันปัญหา better-sqlite3 native module
 */
const http = require('http');
const { parse } = require('url');
const { Server } = require('socket.io');

const DB = require('./lib/db');

let nextHandler = null;

async function bootstrap() {
  const dev = process.env.NODE_ENV !== 'production';
  const next = require('next');
  const app = next({ dev });
  await app.prepare();
  nextHandler = app.getRequestHandler();

  const server = http.createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // ===== REST API =====
    if (parsedUrl.pathname === '/api/rooms') {
      return handleRoomsAPI(req, res, parsedUrl);
    }

    // Next.js pages (ที่เหลือทั้งหมด)
    return nextHandler(req, res, parsedUrl);
  });

  // Socket.IO
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    maxHttpBufferSize: 1e6,
  });
  const { setupSocket } = require('./lib/socket');
  setupSocket(io);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`🌳 Tree of Hope — http://localhost:${port} (dev=${dev})`);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleRoomsAPI(req, res, parsedUrl) {
  if (req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw);
      const q_leaf = String(body?.q_leaf ?? '').trim();
      const q_flower = String(body?.q_flower ?? '').trim();
      const q_fruit = String(body?.q_fruit ?? '').trim();
      if (!q_leaf || !q_flower || !q_fruit) {
        return json(res, 400, { ok: false, error: 'กรุณาตั้งคำถามครบทั้ง 3 ข้อ' });
      }
      const room = DB.createRoom({ q_leaf, q_flower, q_fruit });
      return json(res, 200, { ok: true, code: room.code, teacherToken: room.teacher_token });
    } catch (e) {
      return json(res, 500, { ok: false, error: String(e) });
    }
  }
  if (req.method === 'GET') {
    const code = (parsedUrl.query.code || '').toUpperCase();
    if (!code) return json(res, 400, { ok: false, error: 'ต้องระบุ code' });
    const room = DB.getRoomByCode(code);
    if (!room) return json(res, 404, { ok: false, error: 'ไม่พบห้อง' });
    return json(res, 200, {
      ok: true,
      room: { code: room.code, q_leaf: room.q_leaf, q_flower: room.q_flower, q_fruit: room.q_fruit, current_phase: room.current_phase },
    });
  }
  return json(res, 405, { ok: false, error: 'Method not allowed' });
}

bootstrap().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
