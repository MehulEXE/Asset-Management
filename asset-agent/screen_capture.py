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
    import dxcam
    HAS_DXCAM = True
except ImportError:
    HAS_DXCAM = False

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
        self._camera = None
        self._using_dxgi = False

    def _init_dxgi(self) -> bool:
        if not HAS_DXCAM:
            return False
        try:
            self._camera = dxcam.create(output_color="RGB")
            self._using_dxgi = True
            logger.info("Using DXGI Desktop Duplication for screen capture")
            return True
        except Exception as e:
            logger.debug(f"DXGI init failed, will fall back to PIL: {e}")
            self._camera = None
            self._using_dxgi = False
            return False

    def _get_cursor_bitmap(self) -> tuple[Image.Image | None, tuple[int, int]]:
        if not HAS_WIN32:
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
            if self._camera is None and not self._using_dxgi:
                self._init_dxgi()

            if self._using_dxgi and self._camera:
                img = self._capture_dxgi()
            else:
                img = self._capture_pil()

            if img is None:
                return None

            if include_cursor and HAS_WIN32 and not self._using_dxgi:
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

    def _capture_dxgi(self) -> Image.Image | None:
        try:
            frame = self._camera.grab(new_frame_only=False)
            if frame is None:
                return None
            return Image.fromarray(frame, "RGB")
        except Exception as e:
            logger.error(f"DXGI capture failed: {e}", exc_info=True)
            self._using_dxgi = False
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
        if self._camera:
            try:
                self._camera.stop()
            except Exception:
                pass
            self._camera = None
