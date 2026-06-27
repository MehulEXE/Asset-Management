import threading
import logging
import time
import os
import subprocess

logger = logging.getLogger("AssetAgent")

_consent_result = None
_event = threading.Event()


def show_consent_dialog(timeout: int = 60) -> bool | None:
    global _consent_result, _event
    _consent_result = None
    _event.clear()

    t = threading.Thread(target=_run_dialog, daemon=True)
    t.start()

    if not _event.wait(timeout=timeout):
        logger.info("Consent dialog timed out, defaulting to decline")
        _consent_result = False
    return _consent_result


def _notify_desktop(title: str, message: str):
    try:
        subprocess.run(
            ["notify-send", title, message, "--urgency", "critical", "--expire-time", "60000"],
            capture_output=True, timeout=5
        )
    except Exception:
        pass


def _run_dialog():
    global _consent_result, _event
    _notify_desktop("Screen Share Request", "Your IT administrator has requested remote access to view your screen.")

    try:
        import tkinter as tk
        from tkinter import font

        root = tk.Tk()
        root.title("Screen Share Request")
        root.attributes("-topmost", True)
        root.focus_force()
        root.grab_set()

        screen_w = root.winfo_screenwidth()
        screen_h = root.winfo_screenheight()
        w, h = 480, 260
        x = (screen_w - w) // 2
        y = (screen_h - h) // 2
        root.geometry(f"{w}x{h}+{x}+{y}")
        root.resizable(False, False)
        root.protocol("WM_DELETE_WINDOW", lambda: None)

        root.configure(bg="#1a1a2e")

        title_font = font.Font(family="Ubuntu", size=14, weight="bold")
        msg_font = font.Font(family="Ubuntu", size=11)
        btn_font = font.Font(family="Ubuntu", size=11, weight="bold")

        container = tk.Frame(root, bg="#1a1a2e", padx=30, pady=25)
        container.pack(fill="both", expand=True)

        tk.Label(
            container, text="\U0001f441 Screen Share Request",
            font=title_font, bg="#1a1a2e", fg="#ffffff"
        ).pack(pady=(0, 15))

        tk.Label(
            container,
            text="Your IT administrator has requested\nremote access to view your screen.\n\nDo you want to allow this?",
            font=msg_font, bg="#1a1a2e", fg="#cccccc",
            justify="center",
        ).pack(pady=(0, 20))

        btn_frame = tk.Frame(container, bg="#1a1a2e")
        btn_frame.pack()

        def on_accept():
            global _consent_result, _event
            _consent_result = True
            _event.set()
            root.destroy()

        def on_decline():
            global _consent_result, _event
            _consent_result = False
            _event.set()
            root.destroy()

        accept_btn = tk.Button(
            btn_frame, text="Accept", font=btn_font,
            bg="#2ecc71", fg="#ffffff", activebackground="#27ae60",
            activeforeground="#ffffff", relief="flat", padx=30, pady=8,
            cursor="hand2", command=on_accept,
        )
        accept_btn.pack(side="left", padx=(0, 10))

        decline_btn = tk.Button(
            btn_frame, text="Decline", font=btn_font,
            bg="#e74c3c", fg="#ffffff", activebackground="#c0392b",
            activeforeground="#ffffff", relief="flat", padx=30, pady=8,
            cursor="hand2", command=on_decline,
        )
        decline_btn.pack(side="left", padx=(10, 0))

        root.mainloop()

    except Exception as e:
        logger.error(f"Consent dialog error: {e}", exc_info=True)
        _consent_result = None
        _event.set()
