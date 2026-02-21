# Firewall Policy Converter — PAN-OS to Juniper SRX

A browser-based tool that converts Palo Alto Networks (PAN-OS) firewall configurations into Juniper SRX format. Paste or upload a PAN-OS XML config, review and edit the parsed rules through an interactive UI, optionally get AI-powered best-practice suggestions, then export as SRX set commands or XML.

## Features

### Parsing & Conversion
- **PAN-OS XML parser** — Extracts security policies, NAT rules, zones, address objects, address groups, service objects, and service groups from PAN-OS XML configs
- **SRX output** — Generates Juniper SRX `set` commands or hierarchical XML, including zones, address books, application mappings, security policies, and NAT rule-sets
- **Application mapping** — Automatically maps PAN-OS application names to Junos equivalents (e.g., `web-browsing` → `junos-http`)
- **Sanitization** — One-click replacement of sensitive data (IPs, hostnames, keys) with placeholders before sharing or sending to an LLM. Originals are restored on export

### Interactive Editing
- **Tabbed center panel** — Switch between Security Rules, Zones, Objects (addresses, groups, services), and NAT editors
- **Inline table editing** — Double-click any cell in the policy table to edit directly
- **Right panel rule details** — Full editable form for the selected rule: action, zones, addresses, applications, services, logging, security profiles, tags, description
- **Add / delete rules** — Create new rules or remove existing ones from the UI

### Hardware Awareness
- **Model selector** — Pick source PAN-OS model and target SRX model from a built-in hardware database with port counts and throughput specs
- **Auto-detection** — Heuristics detect the likely PAN-OS model from interface naming in the config
- **Interface mapper** — Per-zone mapping of PAN-OS interfaces (e.g., `ethernet1/1`) to SRX interfaces (e.g., `ge-0/0/0.0`) with auto-mapping, tunnel, and loopback support

### Rule Review Workflow
- **Review status tracking** — Every rule starts as *Unreviewed* and can progress through *LLM Reviewed* to *Accepted*. Disabled rules show a *Disabled* label. Status labels are color-coded in the policy table
- **Status filtering** — Filter the policy table by review status (All / Unreviewed / LLM Reviewed / Accepted / Disabled)
- **Per-rule LLM review** — Click "LLM Review" on any rule to get structured AI suggestions with specific field changes, reasons, and one-click Import buttons
- **Accept rules** — Mark rules as accepted individually. A progress counter in the navbar tracks how many rules are accepted
- **Full-ruleset review** — Once all rules are accepted, the "Review" button opens a chat interface for multi-turn LLM conversation about the entire ruleset, with inline suggestion cards you can accept or reject

### LLM Integration
- **Multiple providers** — Claude (Anthropic), OpenAI, Ollama, LM Studio, or any OpenAI-compatible endpoint
- **Browser-only API keys** — All credentials stay in `localStorage` and never touch the server
- **Editable system prompt** — Customize the expert system prompt used for all LLM reviews, with a built-in default covering SRX best practices, zone architecture, logging, UTM, NAT, compliance, and migration guidance
- **Structured responses** — LLM returns JSON with analysis, per-field suggestions, and a verdict — parsed into interactive cards with Import buttons
- **Multi-turn chat** — The full-ruleset review panel maintains conversation history so you can ask follow-up questions

## Quick Start

### Prerequisites

- **Node.js** 18+ (tested with Node 24)
- **npm** (comes with Node.js)

### Install & Run

```bash
git clone <repo-url> firewall-intent-converter
cd firewall-intent-converter
npm install
node server.js
```

Open **http://localhost:3000** in your browser.

That's it — a single command runs both the Express API server and the Vite dev server (with hot module replacement) on port 3000.

### Production Build

```bash
npm run build          # Vite compiles to dist/
NODE_ENV=production node server.js   # Serves static dist/ + API
```

## Usage

### 1. Load a Configuration

Paste a PAN-OS XML configuration into the left panel, or click one of the built-in sample configs (Basic, Medium, Complex, Edge Cases). Then click **Parse**.

### 2. Select Hardware Models

After parsing, a modal prompts you to select the source PAN-OS model and target SRX model. The tool auto-detects the likely source model from interface names in the config. You can skip this or change it later via the **Models** button.

### 3. Map Interfaces

The interface mapper shows every PAN-OS interface found in the config alongside the available SRX ports on the target model. The tool auto-maps `ethernet{slot}/{port}` to `ge-0/{slot-1}/{port-1}.0` by default. Adjust as needed and click **Done**.

### 4. Review & Edit Rules

The center panel shows all security rules in a sortable, filterable table. Click any rule to see its full details in the right panel, where every field is editable. Use the tabs to also edit Zones, Objects (addresses, groups, services), and NAT rules.

### 5. LLM Review (Optional)

Configure an LLM provider in **Settings** (gear icon). For each rule:

1. Select the rule in the table
2. Click **LLM Review** in the right panel
3. Review the structured suggestions — each shows the field, current value, suggested value, and reasoning
4. Click **Import** on suggestions you agree with, or **Import All**
5. Click **Accept Rule** when satisfied

### 6. Full-Ruleset Review (Optional)

Once all rules are accepted, the **Review** button in the tab bar becomes active. Click it to open a chat interface where the LLM analyzes the entire ruleset for:

- Rule ordering and shadowed rules
- Missing deny-all cleanup rules
- Inconsistent logging
- Zone coverage gaps
- Security profile recommendations

Accept or reject individual suggestions inline, and ask follow-up questions.

### 7. Convert

Click **Convert to SRX** to generate the output. Switch between **Set Commands** and **XML** formats in the bottom panel. The **Warnings** tab shows any conversion notes.

## Project Structure

```
firewall-intent-converter/
├── server.js                     # Express server (API + Vite middleware)
├── vite.config.js                # Vite config (React, publicDir: 'static')
├── package.json
├── index.html                    # Entry HTML
├── src/                          # Server-side modules
│   ├── parsers/
│   │   ├── panos-parser.js       # PAN-OS XML → intermediate JSON
│   │   └── parser-utils.js       # Shared parsing helpers
│   ├── converters/
│   │   ├── srx-converter.js      # Intermediate JSON → SRX set commands
│   │   └── srx-xml-builder.js    # Intermediate JSON → SRX XML
│   ├── validators/
│   │   └── srx-validator.js      # SRX output validation
│   └── interview/
│       ├── llm-client.js         # Server-side LLM client (unused in browser mode)
│       └── question-engine.js    # Interview question logic
├── public/                       # React frontend (transpiled by Vite)
│   ├── main.jsx                  # React entry point
│   ├── app.jsx                   # Root component — layout, state, routing
│   ├── styles/
│   │   └── main.css              # All styles (dark theme, components, layout)
│   ├── components/
│   │   ├── ConfigInput.jsx       # Left panel — paste/upload config, parse/sanitize
│   │   ├── PolicyTable.jsx       # Center panel — sortable/filterable/editable rule table
│   │   ├── ZoneEditor.jsx        # Center panel tab — zone editing
│   │   ├── ObjectEditor.jsx      # Center panel tab — address/service object editing
│   │   ├── NATEditor.jsx         # Center panel tab — NAT rule editing
│   │   ├── InterviewPanel.jsx    # Right panel — rule details, LLM review, accept
│   │   ├── ReviewChatPanel.jsx   # Right panel — full-ruleset LLM chat review
│   │   ├── SRXOutput.jsx         # Bottom panel — SRX output display
│   │   ├── WarningsPanel.jsx     # Bottom panel — conversion warnings
│   │   ├── ModelSelector.jsx     # Modal — source/target hardware model picker
│   │   ├── InterfaceMapper.jsx   # Modal — per-zone interface mapping
│   │   ├── LLMSettings.jsx       # Modal — LLM provider config + system prompt
│   │   └── sample-configs.jsx    # Built-in sample PAN-OS configs
│   ├── utils/
│   │   └── llm-client.js         # Browser-side LLM API client (multi-provider)
│   └── data/
│       └── hardware-db.js        # PAN-OS + SRX model database
└── dist/                         # Production build output (generated)
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/parse` | Parse PAN-OS XML text into vendor-neutral intermediate JSON |
| `POST` | `/api/convert` | Convert intermediate JSON to SRX output (set commands or XML) |
| `POST` | `/api/sanitize` | Replace sensitive data in config text with placeholders |

## Configuration

### LLM Settings

All LLM configuration is stored in `localStorage` under the key `llm-settings`. No API keys are ever sent to the server. Supported providers:

| Provider | Key Required | Default URL |
|----------|-------------|-------------|
| Claude (Anthropic) | Yes | `api.anthropic.com` |
| OpenAI | Yes | `api.openai.com` |
| Ollama | No | `localhost:11434` |
| LM Studio | No | `localhost:1234` |
| Custom | Optional | User-specified |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server listen port |
| `NODE_ENV` | — | Set to `production` to serve static build instead of Vite HMR |

## Tech Stack

- **Frontend**: React 18, JSX (no TypeScript, no bundled CSS framework)
- **Backend**: Express 4, fast-xml-parser
- **Build**: Vite 5 with `@vitejs/plugin-react`
- **Styling**: Custom CSS with dark theme (CSS variables, no preprocessor)
- **LLM**: Direct browser-to-provider API calls (no server proxy)
