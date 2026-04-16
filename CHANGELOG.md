# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-04-16

### Added
- Expanded `src/data/app-mappings.json` from 236 to 280+ canonical apps covering cloud SaaS (Adobe Creative Cloud, Apple APNs, Google FCM, Salesforce, ServiceNow, Dropbox, Box, GitHub, Bitbucket, Okta, Azure AD, AWS API, Google Workspace, Jira, Zendesk, HubSpot, Workday, Concur, Twilio, PagerDuty, Splunk Cloud, Datadog), collaboration (WeChat, Line, GoToMeeting), management/infrastructure (TACACS+, sFlow, DNS-over-TLS, DNS-over-HTTPS, syslog-TLS, LDAP-TLS, RADIUS Accounting), remote access/VPN (Cisco AnyConnect, GlobalProtect, Pulse Secure, FortiClient VPN, SSTP, IKEv2), database/middleware (ActiveMQ, NATS, ZooKeeper, ScyllaDB, Couchbase, Hazelcast, Pulsar, Hive), and industrial/ICS protocols (Modbus, DNP3, IEC-104, S7comm, BACnet, Niagara Fox).
- Multi-vendor support broadened to include Check Point, SonicWall, and Huawei USG aliases on 40 core protocols (HTTP, HTTPS, SSH, DNS, LDAP, NTP, etc.) — previously these vendors had null fatcat keys and could not resolve anything against the mapping table.
- New `getJunosEmission(appName, sourceVendor)` helper returning a discriminated union (`predefined` / `custom` / `null`) that powers concrete custom-application emission when a canonical entry has known ports but no Junos predefined equivalent.

### Changed
- Placeholder unmapped-application output now funnels into a single `INTERVIEW REQUIRED` block with `<name>-UNMAPPED` placeholders, instead of emitting a per-app `destination-port 1` definition line with a `Customfwic` suffix. Each unmapped app appears once with clearly-labeled sentinel values and a TODO comment naming the original vendor app.
- `mapAppToJunos()` now passes through input names that are already valid Junos predefined applications (e.g. `junos-ldap` stays `junos-ldap` instead of being corrupted into `junos-ldapCustomfwic`).
- Multi-port canonical apps (e.g. Apple APNs on 5223/2195/2196) emit an `application-set` with one sub-application per port, wrapped under a single canonical name the policy can reference.

### Fixed
- `_buildIndex()` in `src/utils/app-mappings.js` now tolerates vendor entries with `name: null`, required by the expanded schema that declares which vendors have no published signature for an app.
- `autoGenerateMissingAppDefinitions()` check ordering: standard predefined Junos applications (`junos-https`, `junos-ldap`, etc.) are no longer incorrectly aliased as `custom-*` definitions.

## [1.1.0.0] - 2026-03-28

### Added
- **DESIGN.md** — Design system documentation with color conventions, typography, spacing, and component patterns
- **LAG/aggregate interface support** — All 7 vendor parsers (PAN-OS, FortiGate, Cisco ASA, SRX, Huawei, SonicWall, Check Point) now parse LAG/LACP/port-channel/bond interfaces, with SRX ae converter output and Interface Mapper visual grouping
- **Conversion Report** — 8-section tabbed report under Output: rule count comparison, unused objects, shadowed rules, AI-disabled rules, migration delta dashboard, exportable summary, per-command decision tracking, rollback plan generation
- **Light/dark theme toggle** — User-selectable themes with OS preference detection, TopBar toggle, and localStorage persistence
- **3-node and 4-node MNHA support** — Extended chassis cluster / MNHA generation beyond 2-node configurations
- **Hardware capacity validation** — Post-conversion validation against SRX model limits (policies, sessions, zones, NAT rules, address objects)
- **Pre/post migration checklist** — Auto-generated task checklist based on parsed config features (certificates, JIMS, IDP, SecIntel, RADIUS, VPN, NAT, HA, syslog)
- **Interface mapping templates** — Save/load mapping profiles per source→target model pair for repeated migrations
- **Config version diff** — Side-by-side diff comparison of SRX outputs with LCS-based line diff and green/red highlighting
- **Policy dependency graph** — Interactive SVG showing address/service object relationships to policies with force-directed layout
- **Terraform/Ansible export** — Generate Junos Terraform provider resources or Ansible junos_config playbooks from SRX output
- **vSRX integration test harness** — PyEZ-based test script that pushes all 11 sample configs to a live vSRX and verifies commit

### Fixed
- **~45 SRX converter bugs** found during live vSRX testing (11/11 sample configs now commit clean):
  - UTM profile names avoid Junos reserved identifiers (`junos-av-*` → `custom-av-*`)
  - UTM web-filtering uses correct `juniper-enhanced profile` hierarchy
  - IKE proposals use `sha-256` (not `hmac-sha-256-128`)
  - IPsec proposals use `hmac-sha-256-128` correctly
  - NAT match addresses resolved from names to IPs
  - NAT pool addresses resolved for all vendor address field variants
  - Global policies use `security policies global policy` syntax when zone is `any`
  - Default-policy `permit-all` emitted when global policies exist
  - OSPF/OSPF3 interface names mapped through `mapInterfaceName` (loopback→lo0)
  - OSPF areas with no mapped interfaces skipped to prevent commit errors
  - Application-sets avoid name conflicts with member applications
  - `any` deduplicated in policy match (Junos constraint)
  - Interface deduplication prevents same interface in multiple zones
  - Address-book entries with host IP + non-host mask corrected to /32
  - Platform-dependent `junos-*` apps (mysql, mssql, oracle, postgres, quic, ocsp) auto-defined as `custom-*` aliases
  - Uppercase app names mapped for Huawei (HTTP→junos-http)
  - Firewall filter addresses resolved from names to IPs
  - Static route `metric` corrected to `preference`
  - Screen/IDP values clamped to Junos-valid ranges
  - SSL proxy and JIMS/user-ID generation skipped (requires manual PKI/server setup)
  - Custom application names sanitized (no leading digits, no dots)
  - Service objects with comma-separated ports converted to application-sets

### Changed
- **CSS transitions** — All 22 `transition: all` instances replaced with specific property transitions
- **Touch targets** — Toolbar buttons increased to 36px min, sidebar toggle to 32px min
- **Font sizes** — Status labels 9→10px, btn-sm 11→12px, nav items 12→13px, sidebar headers 11→12px
- **Empty states** — Added SVG icons and headings to WarningsPanel, SRXOutput, ContentRouter empty states
- **Accessibility** — Added `prefers-reduced-motion` media query
