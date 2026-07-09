import io
import base64
import logging
from PIL import Image

try:
    from PIL import ImageGrab
    HAS_PIL_GRAB = True
except ImportError:
    HAS_PIL_GRAB = False

try:
    import mss
    HAS_MSS = True
except ImportError:
    HAS_MSS = False

try:
    import win32gui
    import win32ui
    import win32con
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

logger = logging.getLogger("AssetAgent")


class ScreenCapture:
    def __init__(self, quality: int = 70):
        self.quality = quality
        self._mss_sct = None
        self._using_mss = False

    def _init_mss(self) -> bool:
        if not HAS_MSS:
            return False
        try:
            self._mss_sct = mss.mss()
            self._using_mss = True
            logger.info("Using mss (DXGI) backend for screen capture")
            return True
        except Exception as e:
            logger.debug(f"mss init failed, will fall back to PIL: {e}")
            self._mss_sct = None
            self._using_mss = False
            return False

    def _get_cursor_bitmap(self) -> tuple[Image.Image | None, tuple[int, int]]:
        if not HAS_WIN32 or self._using_mss:
            return None, (0, 0)
        try:
            info = win32gui.GetCursorInfo()
            cursor_handle = info[1]
            cursor_pos = win32gui.GetCursorPos()
            dc = win32gui.GetDC(0)
            memory_dc = win32ui.CreateDCFromHandle(dc)
            cursor_dc = memory_dc.CreateCompatibleDC()
            bitmap = win32ui.CreateBitmap()
            bitmap.CreateCompatibleBitmap(memory_dc, 32, 32)
            cursor_dc.SelectObject(bitmap)
            win32gui.DrawIcon(cursor_dc.GetSafeHdc(), 0, 0, cursor_handle)
            bmpinfo = bitmap.GetInfo()
            bmpstr = bitmap.GetBitmapBits(True)
            img = Image.frombuffer(
                "RGBA",
                (bmpinfo["bmWidth"], bmpinfo["bmHeight"]),
                bmpstr, "raw", "BGRA", 0, 1,
            )
            memory_dc.DeleteDC()
            win32gui.ReleaseDC(0, dc)
            return img, cursor_pos
        except Exception as e:
            logger.debug(f"Cursor capture failed: {e}")
            return None, (0, 0)

    def capture_frame(self, include_cursor: bool = True) -> str | None:
        try:
            if self._mss_sct is None and not self._using_mss:
                self._init_mss()

            if self._using_mss and self._mss_sct:
                img = self._capture_mss()
            else:
                img = self._capture_pil()

            if img is None:
                return None

            if include_cursor and HAS_WIN32 and not self._using_mss:
                cursor_img, (cx, cy) = self._get_cursor_bitmap()
                if cursor_img:
                    r, g, b, a = cursor_img.split()
                    hotspot_x, hotspot_y = 0, 0
                    try:
                        info = win32gui.GetCursorInfo()
                        cursor_handle = info[1]
                        hotspot_x, hotspot_y = win32gui.GetIconInfo(cursor_handle)[2:4]
                    except Exception:
                        pass
                    paste_x = max(cx - hotspot_x, 0)
                    paste_y = max(cy - hotspot_y, 0)
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

    def _capture_mss(self) -> Image.Image | None:
        try:
            monitor = self._mss_sct.monitors[1]
            screenshot = self._mss_sct.grab(monitor)
            return Image.frombuffer(
                "RGB", screenshot.size, screenshot.rgb, "raw", "RGB", 0, 1,
            )
        except Exception as e:
            logger.error(f"mss capture failed: {e}", exc_info=True)
            self._using_mss = False
            return self._capture_pil()

    def _capture_pil(self) -> Image.Image | None:
        if not HAS_PIL_GRAB:
            logger.error("PIL ImageGrab not available")
            return None
        try:
            return ImageGrab.grab()
        except Exception as e:
            logger.error(f"PIL capture failed: {e}", exc_info=True)
            return None

    def close(self):
        if self._mss_sct:
            try:
                self._mss_sct.close()
            except Exception:
                pass
            self._mss_sct = None
