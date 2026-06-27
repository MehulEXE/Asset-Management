import asyncio
import logging
import time
import json
import base64
import io
import threading
import numpy as np
import av
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack

logger = logging.getLogger("AssetAgent")

STUN_SERVERS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
]

class ScreenVideoTrack(VideoStreamTrack):
    def __init__(self, capturer):
        super().__init__()
        self.capturer = capturer
        self._running = True

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        try:
            frame_b64 = self.capturer.capture_frame(include_cursor=True)
            if frame_b64:
                img_data = base64.b64decode(frame_b64)
                img = av.Image.open(io.BytesIO(img_data))
                img = img.to_rgb()
                img_array = np.array(img)
                video_frame = av.VideoFrame.from_ndarray(img_array, format="rgb24")
                video_frame.pts = pts
                video_frame.time_base = time_base
                return video_frame
        except Exception as e:
            logger.debug(f"ScreenVideoTrack capture error: {e}")
        blank = np.zeros((480, 640, 3), dtype=np.uint8)
        video_frame = av.VideoFrame.from_ndarray(blank, format="rgb24")
        video_frame.pts = pts
        video_frame.time_base = time_base
        return video_frame

    def stop(self):
        self._running = False
        super().stop()


class WebRTCScreenSharer:
    def __init__(self, agent_id: str, hostname: str, capturer, api_client):
        self.agent_id = agent_id
        self.hostname = hostname
        self.capturer = capturer
        self.api_client = api_client
        self.pc = None
        self._track = None
        self._running = False
        self._loop = None

    async def _run_async(self):
        self.pc = RTCPeerConnection()
        self._track = ScreenVideoTrack(self.capturer)
        self.pc.addTrack(self._track)

        @self.pc.on("iceconnectionstatechange")
        async def on_ice_state():
            logger.info(f"ICE connection state: {self.pc.iceConnectionState}")
            if self.pc.iceConnectionState in ("failed", "closed", "disconnected"):
                self._running = False

        @self.pc.on("connectionstatechange")
        async def on_conn_state():
            logger.info(f"Connection state: {self.pc.connectionState}")
            if self.pc.connectionState in ("failed", "closed"):
                self._running = False

        try:
            self.pc.addTransceiver("video", direction="sendonly")
            offer = await self.pc.createOffer()
            await self.pc.setLocalDescription(offer)

            sdp_data = {
                "sdp": self.pc.localDescription.sdp,
                "type": self.pc.localDescription.type,
            }
            logger.info("Sending WebRTC offer...")
            if not self.api_client.send_signal_offer(self.agent_id, sdp_data):
                logger.warning("Failed to send WebRTC offer, falling back to HTTP polling")
                return

            for _ in range(60):
                answer_data = self.api_client.get_signal_answer(self.agent_id)
                if answer_data:
                    logger.info("Received WebRTC answer")
                    answer = RTCSessionDescription(sdp=answer_data["sdp"], type=answer_data["type"])
                    await self.pc.setRemoteDescription(answer)
                    break
                await asyncio.sleep(1)
            else:
                logger.warning("Timed out waiting for WebRTC answer")
                return

            self._running = True
            while self._running:
                await asyncio.sleep(2)
                status = self.api_client.screen_share_checkin(self.agent_id, self.hostname)
                if not isinstance(status, dict) or not status.get("active"):
                    logger.info("Screen share no longer active, stopping WebRTC")
                    break
        except Exception as e:
            logger.error(f"WebRTC error: {e}", exc_info=True)
        finally:
            await self._cleanup()

    async def _cleanup(self):
        self._running = False
        if self._track:
            self._track.stop()
            self._track = None
        if self.pc:
            await self.pc.close()
            self.pc = None
        self.api_client.screen_share_stop_ack(self.agent_id)

    def start(self):
        try:
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(self._run_async())
        except Exception as e:
            logger.error(f"WebRTC thread error: {e}", exc_info=True)
        finally:
            if self._loop:
                self._loop.close()

    def stop(self):
        self._running = False
        if self._track:
            self._track.stop()

    def start_thread(self) -> threading.Thread:
        t = threading.Thread(target=self.start, daemon=True)
        t.start()
        return t
