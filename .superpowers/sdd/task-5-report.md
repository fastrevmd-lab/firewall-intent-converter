# Task 5 Report: Integrate Advanced Set Namespaces

## Status

Complete at commit `673e57b` (`feat: plan advanced Set identifiers`).

## RED evidence

Initial advanced collision command:

```text
npx vitest run tests/junos-identifier-integration.test.js -t "colliding"
```

Initial result: 1 failed file, 19 failed tests, 5 passed tests, and 19 skipped tests. The failures showed emitted Set commands still collapsing planned routing-instance, BGP, screen, VPN/IKE/IPsec, SNMP, DHCP, bridge-domain, PBF, flow, SSL, VLAN, QoS, AAA, and generated routing-policy names. Existing UTM/IDP/SecIntel/AppFW planner wiring accounted for the five initially green cases.

Additional TDD review cycles reproduced and then fixed:

- 3/3 failures for skipped static-route lookup ordering, all-disabled PBF lookup guards, and `decrypt-and-forward` SSL handling.
- A PBF hierarchy failure when the brief-required `firewall family inet filter` command pattern was introduced.
- QoS classifier/scheduler-map integration failures in both integration and catalog tests, including missing nested scheduler and forwarding-class paths.
- Generated BGP fallback-group failures in integration and catalog tests.
- 2/2 AppFW failures for missing and all-allow category definitions.
- Raw PBF IPv6/IPv4-prefix emission and mapping failures, including IPv4-embedded IPv6.
- SSL policy-profile reference collision failure.
- Missing exact UTM feature-definition and shared non-owner reference lookups.

## GREEN evidence

Final required focused command:

```text
npx vitest run tests/junos-identifier-integration.test.js tests/junos-identifiers.test.js tests/srx-injection-defense.test.js tests/junos-validation.test.js
```

Result: 4 files passed, 215 tests passed, 0 failed.

Broader Vitest regression command:

```text
npx vitest run tests/context-reducers.test.js tests/conversion-consumers.test.js tests/conversion-enforcement.test.js tests/conversion-output.test.js tests/conversion-security.test.js tests/credential-security.test.js tests/junos-identifier-integration.test.js tests/junos-identifiers.test.js tests/junos-serialization.test.js tests/junos-validation.test.js tests/llm-settings.test.js tests/parser-name-preservation.test.js tests/project-io.test.js tests/srx-injection-defense.test.js tests/triage.test.js tests/workflow-steps.test.js
```

Result: 16 files passed, 346 tests passed, 0 failed.

Additional verification:

- `node --check src/converters/srx-converter.js`: passed.
- `node --check src/security/junos-identifier-catalog.js`: passed.
- `npm run build`: passed.
- `git diff --check`: passed before commit.
- Independent read-only review: ready, with no Critical, Important, or Minor findings after fixes.

## Files

- `src/converters/srx-converter.js`
- `src/security/junos-identifier-catalog.js`
- `tests/junos-identifier-integration.test.js`
- `tests/junos-identifiers.test.js`

## Implementation and self-review

- Threaded the entry-point identifier plan and exact path prefix through advanced routing, screen, VPN, SNMP, AAA, DHCP, QoS, L2, PBF, SSL, and flow helpers.
- Replaced advanced cataloged definitions, references, and generated preferred names with exact `nameForDefinition`, `nameForReference`, and `nameForGenerated` lookups.
- Mirrored routing-instance first-definition/subsequent-reference ordering across static, BGP, OSPF/OSPFv3, EVPN, and VXLAN inputs, including skipped static routes.
- Planned BGP group definitions/references, generated redistribution policies, policy references, and the shared generated `BGP-PEERS` fallback group.
- Planned EVPN VLAN definitions and VXLAN-generated VLAN names without treating VNI/VLAN numeric values or interfaces as identifiers.
- Planned screen profiles and zone references, including generated default screen names.
- Planned VPN, IKE/IPsec proposals, policies, gateways, and all internal references; fallback proposals now receive emitted definitions through their registered roles.
- Consumed exact UTM/AppFW feature definitions and every shared profile reference path; aligned AppFW lookups with catalog emission guards. IDP and SecIntel generated definitions remain exact-role driven.
- Planned SSL decryption-rule definitions/references and security-policy SSL profile comments, including collision-safe reference-only policy profiles.
- Planned bridge-domain definitions/references, virtual-wire generated domains, PBF filters/terms/default terms/routing instances, and exact next-hop instance references.
- Kept PBF raw IPv4, IPv6, IPv4-embedded IPv6, prefixes, and `any` outside identifier planning; named address references still resolve through the address catalog.
- Updated PBF Set hierarchy to the brief-required `firewall family inet filter` form.
- Planned DHCP pools and canonical/named ranges, QoS schedulers/maps/classes/references, AAA profiles, all SNMP name kinds, flow sampling instances/templates/references, and canonical fallback templates.
- Aligned classifier-style QoS catalog records with their established emitted scheduler-map hierarchy and modeled nested schedulers/forwarding classes in their actual namespaces.
- Reviewed remaining `sanitizeJunosName()` calls: they are limited to application category tokens, extension match values, and quoted source identities rather than advanced cataloged Set identifiers.
- Exact-token command assertions prevent a collision-suffixed output from falsely proving emission of its shorter base name.

## Concerns

- No Task 5 implementation concern remains.
- Node emits an existing non-failing experimental `localStorage` warning in broader/focused suites.
- The production build emits existing non-failing ineffective-dynamic-import warnings.
- A blanket `npx vitest run` also discovers six legacy self-running Node test files that have no Vitest suites and reports “No test suite found”; the actual Vitest suites were run explicitly and pass 346/346.

## Formal review fix wave

The formal Task 5 review findings were resolved in a follow-up TDD wave.

### RED evidence

- Shared AppFW feature use across different UTM combinations failed with `missing_catalog_coverage` because the converter used the combination owner rather than the canonical feature owner.
- Equivalent virus/wildfire UTM inputs changed generated roles and stable-parent identities when policy order changed.
- The same raw SSL profile used by forward and inbound modes resolved by encounter order instead of failing as ambiguous.
- PBF accepted invalid IP/prefix, protocol, and port values, always emitted `family inet`, and accepted mixed IPv4/IPv6 match families.
- Fallback `default-utm`, VPN traffic selectors, and SSL PKI CA profile/identity names were emitted without catalog definitions and exact planned consumers.

### Implemented corrections

- Added one pure canonical security-feature model shared by collection and conversion. UTM/AppFW owner paths, roles, and stable-parent keys now depend on feature semantics rather than profile type or encounter order.
- Mode-qualified SSL forward/inbound definitions now share the raw source identity, so an unqualified policy reference to both modes fails deterministically with `ambiguous_reference` in either input order.
- Added typed PBF address, service protocol, and port validation with safe field-addressable errors. PBF filter terms and interface bindings now select `family inet` or `family inet6` from validated raw or named-object values, and mixed families fail at the conflicting field.
- Added generated definition/reference planning and active consumption for the default UTM fallback.
- Added semantic, reorder-stable generated VPN traffic-selector definitions and exact reference consumption.
- Added planned SSL PKI CA-profile and CA-identity definitions and used their planned names in active configuration and operational comments.

### Final verification

- Focused four-file command: 4 files passed, 228 tests passed, 0 failed.
- Broader sixteen-file command: 16 files passed, 359 tests passed, 0 failed.
- Syntax checks passed for `srx-converter.js`, `junos-identifier-catalog.js`, and `junos-input-validation.js`.
- `npm run build`: passed.
- `git diff --check`: passed.

The existing non-failing Node `localStorage` warning and Vite ineffective-dynamic-import warnings remain unchanged.

## Final Task 5 guard and family fix wave

### RED evidence

- The focused policy-only SSL regression failed because `convertSslProxyConfig()` returned when `decryption_rules` was empty, before inspecting the allow policy with `_srx_decrypt`. The mapping contained PKI identities and an unresolved fallback SSL reference, but no matching SSL/PKI output was emitted.
- A catalog/emitter parity regression using an explicit rule profile named `ssl-fwd-proxy` failed with `missing_catalog_coverage` when the emitter attempted to consume a second generated policy owner.
- The IPv6-next-hop PBF regression emitted the filter and interface binding under `family inet` when both matches were `any`.
- Both IPv4-match/IPv6-next-hop and IPv6-match/IPv4-next-hop regressions converted without an error instead of failing at `pbf_rules[0].next_hop_value`.

### Implemented corrections

- The SSL emitter now derives eligible fallback decrypt policies before its early-return guard. The catalog generates the fallback `ssl-fwd-proxy` definition on the canonical policy owner only when no active rule already owns that shared identity, and the emitter consumes the exact generated definition, every fallback reference, and the planned PKI CA profile/identity.
- The SSL catalog and emitter use matching guards for allow policies without explicit profiles and for rule-owned shared fallback definitions. Configurations with neither decrypt rules nor fallback decrypt policies still catalog and emit no SSL fallback state.
- PBF validation now compares a forward rule's literal next-hop family with all concrete source/destination match families and reports conflicts safely at the exact next-hop field.
- PBF emission includes the literal forward next hop in family inference, so IPv6 next hops with `any` matches use `family inet6` for both filter terms and interface bindings.

### TDD and verification results

- Targeted red/green command: 1 file passed, 6 tests passed, 0 failed after fixes.
- Focused four-file command: 4 files passed, 234 tests passed, 0 failed.
- Broader sixteen-file command: 16 files passed, 365 tests passed, 0 failed.
- `node --check` passed for `srx-converter.js`, `junos-identifier-catalog.js`, and `junos-input-validation.js`.
- `npm run build`: passed.
- `git diff --check`: passed.

No new concerns were found in self-review. The existing non-failing Node `localStorage` and Vite ineffective-dynamic-import warnings remain unchanged.
