import unittest
import os
import shutil
import tempfile
import json
import sys

# Add project root to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config_manager import ConfigManager
from storage.sqlite_queue import SQLiteQueue
from collector.hardware import get_hardware_info
from collector.os_info import get_os_and_user_info
from collector.software import get_installed_software
from collector.security import get_security_info

class TestConfigManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.test_dir, "config.json")

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_default_config_generation(self):
        """Verify that standard fields are correctly generated and populated."""
        mgr = ConfigManager(self.config_path)
        self.assertTrue(mgr.config["agent_id"].startswith("AGENT-WIN-"))
        self.assertEqual(mgr.config["api_url"], "https://asset-management-gciq.onrender.com")

    def test_config_encryption_decryption(self):
        """Verify that ConfigManager encrypts and decrypts values successfully."""
        mgr = ConfigManager(self.config_path)
        original_token = "secret_api_token"
        mgr.config["agent_token"] = original_token
        mgr.save_config()

        # Reload configuration
        mgr_reload = ConfigManager(self.config_path)
        self.assertEqual(mgr_reload.config["agent_token"], original_token)


class TestSQLiteQueue(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test_queue.db")
        self.queue = SQLiteQueue(self.db_path)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_enqueue_dequeue(self):
        """Test enqueuing and dequeuing payloads from SQLite queue."""
        payload = {"agent_id": "TEST-01", "hostname": "PC-TEST"}
        
        # Enqueue
        success = self.queue.enqueue("checkin", payload)
        self.assertTrue(success)
        self.assertEqual(self.queue.get_queue_size(), 1)

        # Dequeue
        items = self.queue.dequeue_all()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["type"], "checkin")
        self.assertEqual(items[0]["payload"]["hostname"], "PC-TEST")

        # Remove
        remove_success = self.queue.remove(items[0]["id"])
        self.assertTrue(remove_success)
        self.assertEqual(self.queue.get_queue_size(), 0)


class TestCollectors(unittest.TestCase):
    def test_hardware_collector(self):
        """Verify hardware collector runs and outputs correct datatypes without exception."""
        hw = get_hardware_info()
        self.assertIsInstance(hw, dict)
        self.assertIn("hostname", hw)
        self.assertIn("cpu_cores", hw)
        self.assertIn("ram_total", hw)
        self.assertIsInstance(hw["disks"], list)

    def test_os_collector(self):
        """Verify OS & user details collector runs and returns essential attributes."""
        os_info = get_os_and_user_info()
        self.assertIsInstance(os_info, dict)
        self.assertIn("os_name", os_info)
        self.assertIn("logged_in_user", os_info)

    def test_software_collector(self):
        """Verify software registry collector runs successfully."""
        sw = get_installed_software()
        self.assertIsInstance(sw, list)
        if len(sw) > 0:
            item = sw[0]
            self.assertIn("name", item)
            self.assertIn("version", item)

    def test_security_collector(self):
        """Verify security attributes collector outputs defender and firewall status."""
        sec = get_security_info()
        self.assertIsInstance(sec, dict)
        self.assertIn("windows_defender", sec)
        self.assertIn("firewall_status", sec)
        self.assertIn("bitlocker_status", sec)

if __name__ == "__main__":
    unittest.main()
