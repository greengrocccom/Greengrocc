import { getSocket, reconnectRealtime } from "../realtime/liveClient";

/**
 * The store room is joined server-side from the manager's JWT, so there is
 * nothing to emit here — connecting (re-)authenticates the shared socket.
 */
export function connectSocket() {
  reconnectRealtime();
  return getSocket();
}

export function subscribeToSocketEvent(event, callback) {
  const socket = getSocket();
  socket.on(event, callback);
  return () => socket.off(event, callback);
}

export function disconnectSocket() {
  reconnectRealtime();
}
