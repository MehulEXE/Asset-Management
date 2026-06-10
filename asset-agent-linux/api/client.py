import requests
import logging
import ssl
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
from urllib3.util.retry import Retry

logger = logging.getLogger("AssetAgent")


class TLS12Adapter(HTTPAdapter):
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

        adapter = TLS12Adapter(verify_certs=self.verify_certs, retries=3, backoff_factor=2)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "User-Agent": "AssetAgent-Linux/1.0"
        })

    def checkin(self, payload: dict) -> bool:
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

    def heartbeat(self, payload: dict) -> bool:
        url = f"{self.base_url}/api/v1/agent/heartbeat"
        logger.debug(f"Sending heartbeat to: {url}")
        try:
            response = self.session.post(url, json=payload, verify=self.verify_certs, timeout=15)
            if response.status_code in [200, 201]:
                logger.debug("Heartbeat successfully sent.")
                return True
            else:
                logger.error(f"API returned failure status for heartbeat: {response.status_code} - {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Network error during heartbeat: {e}")
            return False
