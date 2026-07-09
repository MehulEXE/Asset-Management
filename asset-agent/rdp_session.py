import socket
import struct
import threading
import logging
import time
import io
import base64
from PIL import Image

logger = logging.getLogger("AssetAgent")

try:
    import win32api
    import win32con
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

KEYSYM_TO_VK = {
    0xFF08: 0x08, 0xFF09: 0x09, 0xFF0D: 0x0D, 0xFF1B: 0x1B,
    0xFF50: 0x24, 0xFF51: 0x25, 0xFF52: 0x26, 0xFF53: 0x27,
    0xFF54: 0x28, 0xFF55: 0x21, 0xFF56: 0x22, 0xFF57: 0x23,
    0xFF60: 0x2D, 0xFFFF: 0x2E, 0xFF61: 0x2E,
    0xFFE1: 0xA0, 0xFFE2: 0xA1, 0xFFE3: 0xA2, 0xFFE4: 0xA3,
    0xFFE5: 0x14, 0xFFE7: 0x5B, 0xFFE8: 0x5C,
    0xFFE9: 0xA4, 0xFFEA: 0xA5,
    0xFFEB: 0x5B, 0xFFEC: 0x5C,
    0xFF8D: 0x6E, 0xFF9E: 0x6D, 0xFF9F: 0x6C,
}

for i in range(10):
    KEYSYM_TO_VK[0xFFB0 + i] = 0x60 + i

for i in range(24):
    KEYSYM_TO_VK[0xFFBE + i] = 0x70 + i

for i in range(26):
    KEYSYM_TO_VK[0x0061 + i] = 0x41 + i

for i in range(26):
    KEYSYM_TO_VK[0x0041 + i] = 0x41 + i

KEYSYM_TO_VK.update({
    0x0020: 0x20, 0x002C: 0xBC, 0x002E: 0xBE, 0x002F: 0xBF,
    0x0030: 0x30, 0x0031: 0x31, 0x0032: 0x32, 0x0033: 0x33,
    0x0034: 0x34, 0x0035: 0x35, 0x0036: 0x36, 0x0037: 0x37,
    0x0038: 0x38, 0x0039: 0x39, 0x003B: 0xBA, 0x0027: 0xDE,
    0x005B: 0xDB, 0x005D: 0xDD, 0x0060: 0xC0, 0x005C: 0xDC,
    0x002D: 0xBD, 0x003D: 0xBB,
})

SHIFT_KEYS = {
    0x21: 0x31, 0x40: 0x32, 0x23: 0x33, 0x24: 0x34, 0x25: 0x35,
    0x5E: 0x36, 0x26: 0x37, 0x2A: 0x38, 0x28: 0x39, 0x29: 0x30,
    0x5F: 0xBD, 0x2B: 0xBB, 0x7B: 0xDB, 0x7D: 0xDD, 0x3A: 0xBA,
    0x22: 0xDE, 0x7C: 0xDC, 0x3C: 0xBC, 0x3E: 0xBE, 0x3F: 0xBF,
    0x7E: 0xC0,
}

def _keysym_to_vk(keysym: int) -> tuple[int, bool]:
    vk = KEYSYM_TO_VK.get(keysym, 0)
    if vk:
        needs_shift = keysym in SHIFT_KEYS or (0x41 <= keysym <= 0x5A)
        return vk, needs_shift
    return keysym, (0x41 <= keysym <= 0x5A)

def _inject_key(keysym: int, down: bool):
    if not HAS_WIN32:
        return
    vk, needs_shift = _keysym_to_vk(keysym)
    if vk == 0:
        return
    flags = win32con.KEYEVENTF_KEYUP if not down else 0
    if needs_shift:
        shift_flags = win32con.KEYEVENTF_KEYUP if not down else 0
        win32api.keybd_event(win32con.VK_SHIFT, 0, shift_flags, 0)
    win32api.keybd_event(vk, 0, flags, 0)

def _inject_mouse(button_mask: int, x: int, y: int):
    if not HAS_WIN32:
        return
    try:
        sw = win32api.GetSystemMetrics(0)
        sh = win32api.GetSystemMetrics(1)
        sx = int(x * sw / 65535)
        sy = int(y * sh / 65535)
        win32api.SetCursorPos(sx, sy)
        old = getattr(_inject_mouse, "_last_mask", 0)
        changed = old ^ button_mask
        if changed & 1:
            ev = win32con.MOUSEEVENTF_LEFTDOWN if (button_mask & 1) else win32con.MOUSEEVENTF_LEFTUP
            win32api.mouse_event(ev, 0, 0, 0, 0)
        if changed & 2:
            ev = win32con.MOUSEEVENTF_RIGHTDOWN if (button_mask & 2) else win32con.MOUSEEVENTF_RIGHTUP
            win32api.mouse_event(ev, 0, 0, 0, 0)
        if changed & 4:
            ev = win32con.MOUSEEVENTF_MIDDLEDOWN if (button_mask & 4) else win32con.MOUSEEVENTF_MIDDLEUP
            win32api.mouse_event(ev, 0, 0, 0, 0)
        _inject_mouse._last_mask = button_mask
    except Exception as e:
        logger.debug(f"Mouse inject error: {e}")


class RFBServer:
    """Minimal RFB 3.3 server with no authentication and raw encoding."""

    def __init__(self, capturer):
        self.capturer = capturer
        self._sock = None
        self._running = False
        self._port = 0
        self._client = None

    def start(self) -> int:
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("127.0.0.1", 0))
        self._port = self._sock.getsockname()[1]
        self._sock.listen(1)
        self._sock.settimeout(1)
        self._running = True
        threading.Thread(target=self._accept_loop, daemon=True).start()
        logger.info(f"RFB server listening on 127.0.0.1:{self._port}")
        return self._port

    def stop(self):
        self._running = False
        try:
            if self._client:
                self._client.close()
        except Exception:
            pass
        try:
            if self._sock:
                self._sock.close()
        except Exception:
            pass

    @property
    def port(self) -> int:
        return self._port

    def _accept_loop(self):
        while self._running:
            try:
                client, addr = self._sock.accept()
                self._client = client
                self._handle_client(client)
            except socket.timeout:
                continue
            except OSError:
                break

    def _handle_client(self, client):
        try:
            client.settimeout(10)
            client.sendall(b"RFB 003.003\n")
            ver = client.recv(12)
            if ver != b"RFB 003.003\n":
                return
            client.sendall(b"\x01\x01")
            share = client.recv(1)
            w, h = self._get_screen_size()
            fmt = struct.pack("!BBBBHHHBBBxx",
                32, 24, 0, 1, 255, 255, 255, 16, 8, 0)
            name = b"AssetAgent-VNC"
            client.sendall(struct.pack("!HH", w, h) + fmt +
                           struct.pack("!I", len(name)) + name)
            self._message_loop(client)
        except (ConnectionResetError, BrokenPipeError, OSError):
            pass
        except Exception as e:
            logger.error(f"RFB handler error: {e}", exc_info=True)
        finally:
            try:
                client.close()
            except Exception:
                pass
            self._client = None

    def _get_screen_size(self):
        try:
            b64 = self.capturer.capture_frame(include_cursor=False)
            if b64:
                img = Image.open(io.BytesIO(base64.b64decode(b64)))
                return img.size
        except Exception:
            pass
        return 1280, 720

    def _message_loop(self, client):
        while self._running:
            try:
                raw = client.recv(1)
                if not raw:
                    break
            except socket.timeout:
                continue
            except Exception:
                break
            mt = raw[0]
            if mt == 0:
                self._recv_exact(client, 19)
            elif mt == 2:
                data = self._recv_exact(client, 3)
                if data:
                    num = struct.unpack("!H", data[1:3])[0]
                    for _ in range(num):
                        self._recv_exact(client, 4)
            elif mt == 3:
                data = self._recv_exact(client, 9)
                if data:
                    self._send_framebuffer(client)
            elif mt == 4:
                data = self._recv_exact(client, 7)
                if data:
                    down, keysym = struct.unpack("!BBxI", data)
                    _inject_key(keysym, bool(down))
            elif mt == 5:
                data = self._recv_exact(client, 5)
                if data:
                    mask, x, y = struct.unpack("!BBH", data)
                    _inject_mouse(mask, x, y)
            elif mt == 6:
                data = self._recv_exact(client, 7)
                if data:
                    length = struct.unpack("!I", data[3:7])[0]
                    if length > 0:
                        self._recv_exact(client, min(length, 65536))

    def _recv_exact(self, client, size: int) -> bytes | None:
        buf = b""
        while len(buf) < size and self._running:
            try:
                chunk = client.recv(size - len(buf))
                if not chunk:
                    return None
                buf += chunk
            except socket.timeout:
                continue
            except Exception:
                return None
        return buf

    def _send_framebuffer(self, client):
        try:
            b64 = self.capturer.capture_frame(include_cursor=True)
            if not b64:
                return
            img = Image.open(io.BytesIO(base64.b64decode(b64)))
            w, h = img.size
            bgra = img.convert("RGBA").tobytes("raw", "BGRA")
            header = struct.pack("!BxHHHHHI", 0, 1, 0, 0, w, h, 0)
            client.sendall(header + bgra)
        except Exception as e:
            logger.debug(f"Framebuffer send error: {e}")


class TunnelClient:
    """WebSocket tunnel that bridges a local TCP port to the API server."""

    def __init__(self, api_url: str, agent_id: str, hostname: str,
                 local_port: int, stop_event: threading.Event):
        self.api_url = api_url.rstrip("/")
        self.agent_id = agent_id
        self.hostname = hostname
        self.local_port = local_port
        self._stop = stop_event
        self._running = False

    def run(self):
        ws_url = self.api_url.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_url}/ws/vnc/agent/{self.agent_id}"
        self._running = True
        while self._running and not self._stop.is_set():
            try:
                from websockets.sync.client import connect
                logger.info(f"Connecting tunnel to {ws_url}")
                with connect(ws_url, max_size=2**24) as ws:
                    tcp = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    tcp.connect(("127.0.0.1", self.local_port))
                    tcp.settimeout(1)
                    logger.info("Tunnel established")
                    ws.settimeout(1)
                    ws_stopped = threading.Event()

                    def tcp_to_ws():
                        while not ws_stopped.is_set() and not self._stop.is_set():
                            try:
                                data = tcp.recv(65536)
                                if not data:
                                    break
                                ws.send(data)
                            except socket.timeout:
                                continue
                            except Exception:
                                break
                        ws_stopped.set()

                    def ws_to_tcp():
                        while not ws_stopped.is_set() and not self._stop.is_set():
                            try:
                                msg = ws.recv()
                                if msg is None:
                                    break
                                if isinstance(msg, str):
                                    msg = msg.encode()
                                tcp.sendall(msg)
                            except Exception:
                                break
                        ws_stopped.set()

                    t1 = threading.Thread(target=tcp_to_ws, daemon=True)
                    t2 = threading.Thread(target=ws_to_tcp, daemon=True)
                    t1.start()
                    t2.start()
                    ws_stopped.wait()
                    tcp.close()
            except Exception as e:
                logger.warning(f"Tunnel error: {e}, reconnecting in 3s")
                if not self._stop.is_set():
                    self._stop.wait(3)
        self._running = False
