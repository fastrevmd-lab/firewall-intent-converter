# PyEZ Bridge

Lightweight REST API that wraps Juniper PyEZ for pushing SRX configurations via NETCONF. Runs locally alongside the Firewall Intent Converter web app.

## Architecture

```
Browser (React SPA)  ──HTTP──▸  PyEZ Bridge (localhost:8830)  ──NETCONF──▸  SRX Device (port 830)
```

## Prerequisites

- Python 3.9+
- Network access to target SRX devices on NETCONF port (830)
- NETCONF enabled on SRX: `set system services netconf ssh`

## Setup

```bash
cd tools/pyez-bridge
pip install -r requirements.txt
```

## Configure Devices

Edit `devices.yaml` to add your SRX devices:

```yaml
devices:
  - name: srx-lab-01
    host: 192.168.1.1
    port: 830
    username: admin
    password: juniper123

  - name: srx-prod-fw
    host: 10.0.0.1
    port: 830
    username: netops
    ssh_key: ~/.ssh/id_rsa
```

Devices can also be added/removed via the REST API or the web UI (Settings > SRX Device Connection).

**Security:** `devices.yaml` contains credentials. Set restrictive permissions:
```bash
chmod 600 devices.yaml
```

## Run

```bash
python app.py                     # default: 127.0.0.1:8830
python app.py --port 9000         # custom port
python app.py --bind 0.0.0.0      # all interfaces (use with care)
```

## Test

```bash
curl http://localhost:8830/health
# {"service":"pyez-bridge","status":"ok","version":"1.0.0"}
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness check |
| `GET` | `/devices` | List devices with connection status |
| `POST` | `/devices` | Add device |
| `DELETE` | `/devices/<name>` | Remove device |
| `GET` | `/devices/<name>/facts` | Device facts |
| `POST` | `/devices/<name>/load` | Load config into candidate |
| `GET` | `/devices/<name>/diff` | Candidate vs active diff |
| `POST` | `/devices/<name>/commit-check` | Dry-run validation |
| `POST` | `/devices/<name>/commit` | Commit (with optional confirm timer) |
| `POST` | `/devices/<name>/confirm` | Confirm pending commit |
| `POST` | `/devices/<name>/rollback` | Rollback to previous config |

## Connecting from the Web App

1. Start the bridge: `python app.py`
2. In the web app, go to Settings > SRX Device Connection
3. Enter `http://localhost:8830` as the bridge URL
4. Click "Test Connection" to verify
