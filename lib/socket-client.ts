'use client';
/**
 * singleton ของ Socket.IO client
 * ใช้ทั่วทั้งแอปฝั่ง browser
 */
import { io, Socket } from 'socket.io-client';

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (_socket) return _socket;

  const socketUrl = typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin
    : undefined;

  _socket = io(socketUrl, {
    path: '/socket.io',
    autoConnect: true,
    reconnection: true,
    transports: ['websocket', 'polling'],
  });
  return _socket;
}

export function disposeSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}
