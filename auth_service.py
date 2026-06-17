"""
ITAM Auth Service — Supabase Implementation
=============================================
"""

import logging
import os
from supabase import create_client, Client
from datetime import datetime, timezone

logger = logging.getLogger("ITAM_AuthService")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

_anon_client: Client | None = None
_admin_client: Client | None = None


def _get_anon() -> Client:
    global _anon_client
    if _anon_client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env or environment variables.")
        _anon_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _anon_client


def _get_admin() -> Client:
    global _admin_client
    if _admin_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables not set. "
                "Ensure they are configured in the .env file."
            )
        _admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _admin_client


class AuthService:

    def register(self, name: str, email: str, password: str) -> dict:
        if not name or not email or not password:
            raise ValueError("Name, email, and password are required.")
        if len(password) < 6:
            raise ValueError("Password must be at least 6 characters.")

        client = _get_anon()
        data = client.auth.sign_up({
            "email": email.strip().lower(),
            "password": password,
            "options": {"data": {"name": name.strip(), "role": "user"}},
        })

        if not data.user:
            raise ValueError("Registration failed: no user returned")

        return {
            "user": self._user_to_public(data.user),
        }

    def login(self, email: str, password: str) -> dict:
        if not email or not password:
            raise ValueError("Email and password are required.")

        client = _get_anon()
        data = client.auth.sign_in_with_password({
            "email": email.strip().lower(),
            "password": password,
        })

        if not data.user or not data.session:
            raise ValueError("Invalid email or password.")

        logger.info(f"User logged in: {email}")
        return {
            "token": data.session.access_token,
            "user": self._user_to_public(data.user),
        }

    def logout(self, token: str) -> bool:
        try:
            client = _get_admin()
            client.auth.admin.sign_out(token)
            return True
        except Exception:
            return False

    def get_current_user(self, token: str) -> dict | None:
        if not token:
            return None
        try:
            client = _get_anon()
            data = client.auth.get_user(token)
            if data and data.user:
                return self._user_to_public(data.user)
            return None
        except Exception:
            return None

    def list_users(self) -> list[dict]:
        try:
            client = _get_admin()
            users_raw = client.auth.admin.list_users()
            if isinstance(users_raw, list):
                return [self._user_to_public(u) for u in users_raw]
            users_raw = users_raw.users if hasattr(users_raw, "users") else []
            return [self._user_to_public(u) for u in users_raw]
        except Exception as e:
            logger.error(f"Failed to list users: {e}")
            return []

    def get_user_by_email(self, email: str) -> dict | None:
        users = self.list_users()
        for u in users:
            if u["email"] == email.strip().lower():
                return u
        return None

    def set_role(self, target_email: str, new_role: str, admin_email: str) -> dict:
        if new_role not in ("admin", "user"):
            raise ValueError("Role must be 'admin' or 'user'.")

        client = _get_admin()

        users_raw = client.auth.admin.list_users()
        users_list = users_raw if isinstance(users_raw, list) else (users_raw.users if hasattr(users_raw, "users") else [])
        target_user = None
        for u in users_list:
            if u.email == target_email.strip().lower():
                target_user = u
                break

        if not target_user:
            raise ValueError("User not found.")

        if target_user.user_metadata.get("role") == "admin" and new_role == "user":
            admin_count = sum(
                1 for u in users_list
                if u.user_metadata.get("role") == "admin"
            )
            if admin_count <= 1:
                raise ValueError("Cannot demote the last admin. Promote another user first.")

        client.auth.admin.update_user_by_id(
            target_user.id,
            {"user_metadata": {"role": new_role, "name": target_user.user_metadata.get("name", "")}},
        )

        logger.info(f"User {target_email} role changed to {new_role} (by {admin_email})")
        return {"user": self._user_to_public(target_user)}

    @staticmethod
    def _user_to_public(user) -> dict:
        meta = getattr(user, "user_metadata", {}) or {}
        return {
            "name": meta.get("name", user.email.split("@")[0] if user.email else ""),
            "email": user.email or "",
            "role": meta.get("role", "user"),
            "created_at": getattr(user, "created_at", datetime.now(timezone.utc).isoformat()),
        }
