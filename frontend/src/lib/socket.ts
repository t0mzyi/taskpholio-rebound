import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";

let socket: Socket | null = null;

export const getSocket = (token: string): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: {
        token,
        type: 'admin'
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true
    });

    socket.on("connect", () => {
      console.log("🚀 Admin Command Center Connected");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket Connection Error:", err.message);
    });
  } else {
    // Dynamic Auth Update
    const currentAuth = socket.auth as any;
    if (currentAuth.token !== token) {
      console.log("🔄 Updating Admin Socket Credentials...");
      socket.auth = { token, type: 'admin' };
      socket.disconnect().connect();
    }
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
