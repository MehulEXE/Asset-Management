import io
import base64
import os
import logging
import subprocess
from PIL import Image

logger = logging.getLogger("AssetAgent")

try:
    import mss
    HAS_MSS = True
except ImportError:
    HAS_MSS = False


class ScreenCapture:
    def __init__(self, quality: int = 70):
        self.quality = quality
        self.sct = None
        self._display_server = self._detect_display_server()

    def _detect_display_server(self) -> str:
        if os.environ.get("WAYLAND_DISPLAY"):
            return "wayland"
        return "x11"

    def _get_cursor_x11(self) -> tuple[Image.Image | None, tuple[int, int]]:
        try:
            import Xlib.display
            disp = Xlib.display.Display()
            root = disp.screen().root
            data = root.get_pointer_mapping()
            cursor = root.get_attributes().cursor
            pos = (data["root_x"], data["root_y"])
            if cursor != 0:
                try:
                    import Xlib.ext.xfixes
                    cursor_img = Xlib.ext.xfixes.get_cursor_image(disp)
                    if cursor_img:
                        w, h, xhot, yhot, pixels = cursor_img
                        img = Image.frombytes("RGBA", (w, h), pixels, "raw", "BGRA")
                        disp.close()
                        return img, pos
                except Exception:
                    pass
            disp.close()
        except Exception as e:
            logger.debug(f"Cursor capture failed: {e}")
        return None, (0, 0)

    def _capture_x11(self) -> Image.Image | None:
        if not HAS_MSS:
            logger.error("mss not available for X11 screen capture")
            return None
        try:
            if self.sct is None:
                self.sct = mss.mss()
            monitor = self.sct.monitors[1]
            screenshot = self.sct.grab(monitor)
            return Image.frombuffer("RGB", screenshot.size, screenshot.rgb, "raw", "RGB", 0, 1)
        except Exception as e:
            logger.error(f"X11 capture failed: {e}", exc_info=True)
            return None

    def _capture_wayland_fallback(self) -> Image.Image | None:
        try:
            result = subprocess.run(
                ["gnome-screenshot", "--file", "/tmp/asset_agent_screen.png", "--quality", "50"],
                capture_output=True, timeout=5
            )
            if result.returncode == 0:
                return Image.open("/tmp/asset_agent_screen.png")
        except Exception:
            pass
        try:
            result = subprocess.run(
                ["scrot", "-q", "50", "/tmp/asset_agent_screen.png"],
                capture_output=True, timeout=5
            )
            if result.returncode == 0:
                return Image.open("/tmp/asset_agent_screen.png")
        except Exception as e:
            logger.debug(f"Wayland fallback capture failed: {e}")
        return None

    def capture_frame(self, include_cursor: bool = True) -> str | None:
        try:
            if self._display_server == "x11" and HAS_MSS:
                img = self._capture_x11()
            else:
                img = self._capture_wayland_fallback()

            if img is None:
                return None

            if include_cursor and self._display_server == "x11":
                cursor_img, (cx, cy) = self._get_cursor_x11()
                if cursor_img:
                    r, g, b, a = cursor_img.split()
                    paste_x = max(cx, 0)
                    paste_y = max(cy, 0)
                    if paste_x < img.width and paste_y < img.height:
                        cursor_rgb = Image.merge("RGB", (r, g, b))
                        mask = a.point(lambda v: 255 if v > 32 else 0)
                        img.paste(cursor_rgb, (paste_x, paste_y), mask)

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=self.quality, optimize=True)
            return base64.b64encode(buf.getvalue()).decode("utf-8")
        except Exception as e:
            logger.error(f"Screen capture failed: {e}", exc_info=True)
            return None

    def close(self):
        if self.sct:
            self.sct.close()
