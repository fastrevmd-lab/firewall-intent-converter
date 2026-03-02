"""
PyEZ Bridge — Lightweight REST API for pushing SRX configurations via NETCONF.

Wraps Juniper PyEZ (junos-eznc) behind Flask endpoints so the browser-based
Firewall Intent Converter can push configs, run commit checks, and manage
commits on live SRX devices.

Usage:
    pip install -r requirements.txt
    python app.py                     # starts on 127.0.0.1:8830
    python app.py --port 9000         # custom port
    python app.py --bind 0.0.0.0      # listen on all interfaces (use with care)
"""

import argparse
import os
import sys
import time
import traceback
from pathlib import Path

import yaml
from flask import Flask, jsonify, request
from flask_cors import CORS

# PyEZ imports
from jnpr.junos import Device
from jnpr.junos.utils.config import Config
from jnpr.junos.exception import (
    ConnectError,
    ConnectAuthError,
    ConnectRefusedError,
    ConnectTimeoutError,
    CommitError,
    ConfigLoadError,
    LockError,
    UnlockError,
    RpcError,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DEVICES_FILE = Path(__file__).parent / "devices.yaml"
CONNECT_TIMEOUT = 10   # seconds
OPERATION_TIMEOUT = 30  # seconds

app = Flask(__name__)
CORS(app)


# ---------------------------------------------------------------------------
# Device store helpers
# ---------------------------------------------------------------------------
def _load_devices():
    """Read devices.yaml and return the list of device dicts."""
    if not DEVICES_FILE.exists():
        return []
    with open(DEVICES_FILE, "r") as f:
        data = yaml.safe_load(f) or {}
    return data.get("devices", []) or []


def _save_devices(devices):
    """Write devices list back to devices.yaml."""
    with open(DEVICES_FILE, "w") as f:
        yaml.dump({"devices": devices}, f, default_flow_style=False)


def _find_device(name):
    """Look up a device by name. Returns (device_dict, index) or (None, -1)."""
    devices = _load_devices()
    for i, d in enumerate(devices):
        if d.get("name") == name:
            return d, i
    return None, -1


def _safe_device_info(dev_dict):
    """Return device info without sensitive fields (password, ssh_key)."""
    return {
        "name": dev_dict.get("name", ""),
        "host": dev_dict.get("host", ""),
        "port": dev_dict.get("port", 830),
        "username": dev_dict.get("username", ""),
        "has_password": bool(dev_dict.get("password")),
        "has_ssh_key": bool(dev_dict.get("ssh_key")),
    }


def _connect(dev_dict):
    """Open a PyEZ Device connection. Caller must close it."""
    kwargs = {
        "host": dev_dict["host"],
        "user": dev_dict.get("username", "root"),
        "port": dev_dict.get("port", 830),
        "conn_open_timeout": CONNECT_TIMEOUT,
    }
    if dev_dict.get("ssh_key"):
        key_path = os.path.expanduser(dev_dict["ssh_key"])
        kwargs["ssh_private_key_file"] = key_path
    elif dev_dict.get("password"):
        kwargs["passwd"] = dev_dict["password"]

    dev = Device(**kwargs)
    dev.open()
    dev.timeout = OPERATION_TIMEOUT
    return dev


def _error_response(message, status=400, details=None):
    """Build a standard error JSON response."""
    body = {"ok": False, "error": message}
    if details:
        body["details"] = details
    return jsonify(body), status


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    """Liveness check — matches the existing UI expectation."""
    return jsonify({"status": "ok", "version": "1.0.0", "service": "pyez-bridge"})


@app.route("/devices", methods=["GET"])
def list_devices():
    """List configured devices. Use ?probe=true to test connectivity (slower)."""
    devices = _load_devices()
    probe = request.args.get("probe", "false").lower() in ("true", "1", "yes")
    result = []
    for dev_dict in devices:
        info = _safe_device_info(dev_dict)
        info["status"] = "unknown"
        if probe:
            try:
                dev = _connect(dev_dict)
                facts = dev.facts or {}
                info["hostname"] = facts.get("hostname", "")
                info["model"] = facts.get("model", "")
                info["version"] = facts.get("version", "")
                info["serial"] = facts.get("serialnumber", "")
                info["status"] = "connected"
                dev.close()
            except Exception:
                info["status"] = "unreachable"
        result.append(info)
    return jsonify({"devices": result})


@app.route("/devices", methods=["POST"])
def add_device():
    """Add a new device to devices.yaml."""
    data = request.get_json(silent=True)
    if not data:
        return _error_response("Request body must be JSON.")

    name = (data.get("name") or "").strip()
    host = (data.get("host") or "").strip()
    username = (data.get("username") or "").strip()

    if not name:
        return _error_response("Device name is required.")
    if not host:
        return _error_response("Device host/IP is required.")
    if not username:
        return _error_response("Username is required.")

    devices = _load_devices()
    # Check duplicate name
    if any(d.get("name") == name for d in devices):
        return _error_response(f"Device '{name}' already exists.", 409)

    entry = {
        "name": name,
        "host": host,
        "port": data.get("port", 830),
        "username": username,
    }
    if data.get("password"):
        entry["password"] = data["password"]
    if data.get("ssh_key"):
        entry["ssh_key"] = data["ssh_key"]

    devices.append(entry)
    _save_devices(devices)
    return jsonify({"ok": True, "device": _safe_device_info(entry)}), 201


@app.route("/devices/<name>", methods=["DELETE"])
def remove_device(name):
    """Remove a device from devices.yaml."""
    devices = _load_devices()
    filtered = [d for d in devices if d.get("name") != name]
    if len(filtered) == len(devices):
        return _error_response(f"Device '{name}' not found.", 404)
    _save_devices(filtered)
    return jsonify({"ok": True})


@app.route("/devices/<name>/facts", methods=["GET"])
def device_facts(name):
    """Fetch device facts via PyEZ."""
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    try:
        dev = _connect(dev_dict)
        facts = dev.facts or {}
        result = {
            "hostname": facts.get("hostname", ""),
            "model": facts.get("model", ""),
            "version": facts.get("version", ""),
            "serial_number": facts.get("serialnumber", ""),
            "uptime": facts.get("RE0", {}).get("up_time", ""),
            "personality": facts.get("personality", ""),
            "fqdn": facts.get("fqdn", ""),
        }
        dev.close()
        return jsonify(result)
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        return _error_response(f"Unexpected error: {e}", 500)


@app.route("/devices/<name>/unlock", methods=["POST"])
def unlock_config(name):
    """Clear any stale configuration lock on the device.

    Useful when a previous session left a lock behind.  Connects, rolls back
    the candidate to discard uncommitted edits, and closes cleanly.
    """
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    dev = None
    try:
        dev = _connect(dev_dict)
        cu = Config(dev)
        # rollback discards candidate changes; no lock required
        try:
            cu.rollback(0)
        except Exception:
            pass
        # unlock releases the lock if this session holds it
        try:
            cu.unlock()
        except UnlockError:
            pass
        dev.close()
        return jsonify({"ok": True, "message": "Lock cleared (if any)."})
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Unlock failed: {e}", 500)


def _acquire_lock(dev_dict, cu, dev):
    """Try to lock the candidate config.  On LockError, reconnect and retry once."""
    try:
        cu.lock()
        return cu, dev
    except LockError:
        # Previous session may have left a stale lock.
        # Close this connection (which releases any lock *we* hold),
        # wait briefly, reconnect, and try once more.
        print("  Lock failed — retrying after reconnect...")
        try:
            cu.rollback(0)
        except Exception:
            pass
        try:
            cu.unlock()
        except Exception:
            pass
        try:
            dev.close()
        except Exception:
            pass
        time.sleep(2)
        dev = _connect(dev_dict)
        cu = Config(dev)
        cu.lock()          # If this also fails, LockError propagates to caller
        return cu, dev


@app.route("/devices/<name>/load", methods=["POST"])
def load_config(name):
    """Load configuration into candidate configuration."""
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    data = request.get_json(silent=True)
    if not data or not data.get("config"):
        return _error_response("Request body must include 'config' field.")

    fmt = data.get("format", "set")
    if fmt not in ("set", "xml", "text"):
        return _error_response("Format must be 'set', 'xml', or 'text'.")

    config_text = data["config"]
    # Strip comment lines and blanks for set format — NETCONF rejects non-command lines
    if fmt == "set":
        lines = [l for l in config_text.splitlines() if l.strip() and not l.strip().startswith("#")]
        config_text = "\n".join(lines)
    if not config_text.strip():
        return _error_response("Configuration is empty after filtering.")

    dev = None
    locked = False
    try:
        dev = _connect(dev_dict)
        cu = Config(dev)
        cu, dev = _acquire_lock(dev_dict, cu, dev)
        locked = True

        # First try loading the full config at once
        try:
            cu.load(config_text, format=fmt)
            cu.unlock()
            locked = False
            dev.close()
            total = len(config_text.splitlines())
            return jsonify({"ok": True, "message": f"Configuration loaded ({total} lines)."})
        except ConfigLoadError:
            cu.rollback()  # Clean slate for line-by-line

        # Batch load failed — fall back to line-by-line for set format
        if fmt != "set":
            cu.unlock()
            locked = False
            dev.close()
            return _error_response("Configuration load failed. Check syntax.", 400)

        errors = []
        loaded = 0
        skipped = 0
        for i, line in enumerate(config_text.splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            try:
                cu.load(line, format="set")
                loaded += 1
            except ConfigLoadError as e:
                skipped += 1
                msg = str(e).split("\n")[0][:200] if str(e) else "syntax error"
                errors.append({"line": i, "command": line[:120], "message": msg})
                print(f"  Line {i} SKIP: {line[:80]}")
                print(f"    Error: {msg}")

        cu.unlock()
        locked = False
        dev.close()

        if loaded == 0:
            return _error_response(
                f"All {skipped} lines failed to load.",
                400,
                details=errors[:50],
            )

        return jsonify({
            "ok": True,
            "message": f"Loaded {loaded} commands, skipped {skipped} with errors.",
            "warnings": errors[:50] if errors else None,
            "loaded": loaded,
            "skipped": skipped,
        })
    except LockError:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(
            "Could not lock configuration after retry. "
            "Another CLI/NETCONF session may hold the lock. "
            "Try 'clear system commit' on the device CLI, or use the Unlock button.",
            409,
        )
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        # Always try to unlock + close on unexpected errors
        if dev:
            if locked:
                try:
                    Config(dev).unlock()
                except Exception:
                    pass
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Unexpected error: {e}", 500)


@app.route("/devices/<name>/diff", methods=["GET"])
def config_diff(name):
    """Show candidate vs active configuration diff."""
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    dev = None
    try:
        dev = _connect(dev_dict)
        cu = Config(dev)
        diff = cu.diff() or ""
        dev.close()
        return jsonify({"ok": True, "diff": diff})
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Unexpected error: {e}", 500)


@app.route("/devices/<name>/commit-check", methods=["POST"])
def commit_check(name):
    """Dry-run commit check — validates candidate without applying."""
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    dev = None
    try:
        dev = _connect(dev_dict)
        cu = Config(dev)
        cu.commit_check()
        dev.close()
        return jsonify({"ok": True, "message": "Commit check passed."})
    except CommitError as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        errors = []
        if hasattr(e, "errs") and e.errs:
            for err in e.errs:
                errors.append({
                    "message": err.get("message", str(err)),
                    "severity": err.get("severity", "error"),
                })
        else:
            errors.append({"message": str(e), "severity": "error"})
        return jsonify({"ok": False, "errors": errors})
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Unexpected error: {e}", 500)


@app.route("/devices/<name>/commit", methods=["POST"])
def commit(name):
    """Commit the candidate configuration."""
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    data = request.get_json(silent=True) or {}
    comment = data.get("comment", "")
    confirm_minutes = data.get("confirm_minutes")

    dev = None
    try:
        dev = _connect(dev_dict)
        cu = Config(dev)

        kwargs = {}
        if comment:
            kwargs["comment"] = comment
        if confirm_minutes and int(confirm_minutes) > 0:
            kwargs["confirm"] = int(confirm_minutes)

        cu.commit(**kwargs)
        dev.close()

        msg = "Configuration committed successfully."
        if confirm_minutes and int(confirm_minutes) > 0:
            msg = (
                f"Configuration committed with {confirm_minutes}-minute confirm timer. "
                f"Run 'confirm' within {confirm_minutes} minutes or the device will auto-rollback."
            )
        return jsonify({"ok": True, "message": msg, "confirm_active": bool(confirm_minutes)})
    except CommitError as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Commit failed: {e}", 400, details=str(e))
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Unexpected error: {e}", 500)


@app.route("/devices/<name>/confirm", methods=["POST"])
def confirm_commit(name):
    """Confirm a pending commit-confirm (cancel the auto-rollback timer)."""
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    dev = None
    try:
        dev = _connect(dev_dict)
        cu = Config(dev)
        cu.commit()  # A bare commit after commit-confirm confirms it
        dev.close()
        return jsonify({"ok": True, "message": "Commit confirmed. Auto-rollback cancelled."})
    except CommitError as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Confirm failed: {e}", 400, details=str(e))
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Unexpected error: {e}", 500)


@app.route("/devices/<name>/rollback", methods=["POST"])
def rollback(name):
    """Rollback the candidate configuration to the last committed state."""
    dev_dict, _ = _find_device(name)
    if not dev_dict:
        return _error_response(f"Device '{name}' not found.", 404)

    data = request.get_json(silent=True) or {}
    rollback_id = data.get("id", 0)

    dev = None
    try:
        dev = _connect(dev_dict)
        cu = Config(dev)
        cu.rollback(int(rollback_id))
        cu.commit(comment="Rollback via PyEZ Bridge")
        dev.close()
        return jsonify({"ok": True, "message": f"Rolled back to configuration {rollback_id}."})
    except (CommitError, RpcError) as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Rollback failed: {e}", 400, details=str(e))
    except (ConnectError, ConnectAuthError, ConnectRefusedError, ConnectTimeoutError) as e:
        return _error_response(f"Connection failed: {e}", 502)
    except Exception as e:
        if dev:
            try:
                dev.close()
            except Exception:
                pass
        return _error_response(f"Unexpected error: {e}", 500)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PyEZ Bridge — REST API for SRX device management")
    parser.add_argument("--port", type=int, default=8830, help="Port to listen on (default: 8830)")
    parser.add_argument("--bind", default="127.0.0.1", help="Address to bind to (default: 127.0.0.1)")
    args = parser.parse_args()

    print(f"PyEZ Bridge starting on {args.bind}:{args.port}")
    print(f"Device config: {DEVICES_FILE}")
    print(f"Devices configured: {len(_load_devices())}")
    app.run(host=args.bind, port=args.port, debug=False)
