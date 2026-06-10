import sqlite3
import json
import os
import logging

logger = logging.getLogger("AssetAgent")


class SQLiteQueue:
    def __init__(self, db_path):
        self.db_path = db_path
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            try:
                os.makedirs(db_dir, exist_ok=True)
            except Exception as e:
                logger.error(f"Failed to create DB directory {db_dir}: {e}")

        self._init_db()

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payload_type TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    attempts INTEGER DEFAULT 0
                )
            """)
            conn.commit()
            logger.debug(f"Queue database initialized at: {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
        finally:
            if conn:
                conn.close()

    def enqueue(self, payload_type: str, payload: dict) -> bool:
        conn = None
        try:
            payload_str = json.dumps(payload)
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO queue (payload_type, payload) VALUES (?, ?)",
                (payload_type, payload_str)
            )
            conn.commit()
            logger.info(f"Queued message of type '{payload_type}' locally due to offline status.")
            return True
        except Exception as e:
            logger.error(f"Error enqueuing message: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def dequeue_all(self):
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, payload_type, payload, attempts FROM queue ORDER BY id ASC")
            rows = cursor.fetchall()

            messages = []
            for row in rows:
                try:
                    messages.append({
                        "id": row[0],
                        "type": row[1],
                        "payload": json.loads(row[2]),
                        "attempts": row[3]
                    })
                except json.JSONDecodeError:
                    logger.error(f"Corrupt JSON in queue item ID {row[0]}, deleting.")
                    self.remove(row[0])
            return messages
        except Exception as e:
            logger.error(f"Error retrieving messages from queue: {e}")
            return []
        finally:
            if conn:
                conn.close()

    def increment_attempt(self, item_id: int):
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE queue SET attempts = attempts + 1 WHERE id = ?", (item_id,))
            conn.commit()
        except Exception as e:
            logger.error(f"Error incrementing attempt for ID {item_id}: {e}")
        finally:
            if conn:
                conn.close()

    def remove(self, item_id: int) -> bool:
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("DELETE FROM queue WHERE id = ?", (item_id,))
            conn.commit()
            logger.debug(f"Removed ID {item_id} from queue.")
            return True
        except Exception as e:
            logger.error(f"Error removing message ID {item_id} from queue: {e}")
            return False
        finally:
            if conn:
                conn.close()

    def get_queue_size(self) -> int:
        conn = None
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM queue")
            return cursor.fetchone()[0]
        except Exception as e:
            logger.error(f"Error getting queue size: {e}")
            return 0
        finally:
            if conn:
                conn.close()
