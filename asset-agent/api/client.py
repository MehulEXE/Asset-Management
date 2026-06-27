import requests
import logging
import ssl
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
from urllib3.util.retry import Retry

logger = logging.getLogger("AssetAgent")

class TLS12Adapter(HTTPAdapter):
    """Custom HTTP adapter to enforce TLS 1.2+ for secure communications."""
    def __init__(self, verify_certs=True, retries=3, backoff_factor=2, **kwargs):
        self._verify_certs = verify_certs
        retry = Retry(
            total=retries,
            backoff_factor=backoff_factor,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST", "GET"],
            raise_on_status=False,
        )
        super().__init__(max_retries=retry, **kwargs)

    def init_poolmanager(self, connections, maxsize, block=False):
        ctx = ssl.create_default_context()
        if not self._verify_certs:
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        if hasattr(ssl, "TLSVersion"):
            ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        else:
            ctx.options |= ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1

        self.poolmanager = PoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            ssl_context=ctx
        )

    def cert_verify(self, conn, url, verify, cert):
        if verify is False:
            conn.cert_reqs = "CERT_NONE"
            conn.check_hostname = False
            return
        super().cert_verify(conn, url, verify, cert)

class APIClient:
    def __init__(self, base_url: str, token: str, verify_certs: bool = True):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.verify_certs = verify_certs
        self.session = requests.Session()
        
        # Enforce TLS 1.2+ via custom adapter with retry support
        adapter = TLS12Adapter(verify_certs=self.verify_certs, retries=3, backoff_factor=2)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        
        # Headers
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "User-Agent": "AssetAgent-Win/1.0"
        })

    def checkin(self, payload: dict) -> bool:
        """Sends the full hardware/OS/software inventory data to /api/v1/agent/checkin."""
        url = f"{self.base_url}/api/v1/agent/checkin"
        logger.info(f"Attempting full inventory check-in to: {url}")
        try:
            response = self.session.post(url, json=payload, verify=self.verify_certs, timeout=30)
            if response.status_code in [200, 201]:
                logger.info("Successfully checked in full inventory to API.")
                return True
            else:
                logger.error(f"API returned failure status: {response.status_code} - {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during check-in: {e}")
            return False

    def heartbeat(self, payload: dict) -> dict | None:
        """Sends agent performance statistics to /api/v1/agent/heartbeat.

        Returns the response JSON dict on success, or None on failure.
        """
        url = f"{self.base_url}/api/v1/agent/heartbeat"
        logger.debug(f"Sending heartbeat to: {url}")
        try:
            response = self.session.post(url, json=payload, verify=self.verify_certs, timeout=15)
            if response.status_code in [200, 201]:
                logger.debug("Heartbeat successfully sent.")
                return response.json()
            else:
                logger.error(f"API returned failure status for heartbeat: {response.status_code} - {response.text}")
                return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during heartbeat: {e}")
            return None

    def screen_share_checkin(self, agent_id: str, hostname: str) -> bool | dict:
        """Checks in with the screen sharer endpoint and returns screen share status."""
        url = f"{self.base_url}/api/v1/agent/screen-sharer-checkin"
        try:
            response = self.session.post(url, json={"agent_id": agent_id, "hostname": hostname}, verify=self.verify_certs, timeout=10)
            if response.status_code == 200:
                return response.json()
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during screen sharer checkin: {e}")
            return False

    def send_screen_frame(self, agent_id: str, frame_b64: str) -> bool:
        """Sends a screen capture frame to the API server."""
        url = f"{self.base_url}/api/v1/agent/screen-frame"
        try:
            response = self.session.post(url, json={"agent_id": agent_id, "frame": frame_b64}, verify=self.verify_certs, timeout=15)
            return response.status_code == 200
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error sending screen frame: {e}")
            return False

    def send_consent(self, agent_id: str, consent: bool) -> bool:
        """Sends user consent (accept/decline) response for screen share request."""
        url = f"{self.base_url}/api/v1/agent/screen-consent"
        try:
            response = self.session.post(url, json={"agent_id": agent_id, "consent": consent}, verify=self.verify_certs, timeout=10)
            return response.status_code == 200
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error sending consent: {e}")
            return False

    def screen_share_stop_ack(self, agent_id: str) -> bool:
        """Acknowledges screen share stop to the API server."""
        url = f"{self.base_url}/api/v1/agent/screen-share-stop-ack"
        try:
            response = self.session.post(url, json={"agent_id": agent_id}, verify=self.verify_certs, timeout=10)
            return response.status_code == 200
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error sending stop ack: {e}")
            return False

    def send_signal_offer(self, agent_id: str, sdp: dict) -> bool:
        """Sends WebRTC SDP offer to the signaling server."""
        url = f"{self.base_url}/api/v1/signal/offer/{agent_id}"
        try:
            response = self.session.post(url, json=sdp, verify=self.verify_certs, timeout=10)
            return response.status_code == 200
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error sending signal offer: {e}")
            return False

    def get_signal_answer(self, agent_id: str) -> dict | None:
        """Polls for WebRTC SDP answer from the signaling server."""
        url = f"{self.base_url}/api/v1/signal/answer/{agent_id}"
        try:
            response = self.session.get(url, verify=self.verify_certs, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("sdp"):
                    return data
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error getting signal answer: {e}")
            return None

    def send_ice_candidate(self, agent_id: str, candidate: dict) -> bool:
        """Sends WebRTC ICE candidate to the signaling server."""
        url = f"{self.base_url}/api/v1/signal/ice-candidate/{agent_id}"
        try:
            response = self.session.post(url, json=candidate, verify=self.verify_certs, timeout=10)
            return response.status_code == 200
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error sending ICE candidate: {e}")
            return False
