# Junos Configuration Injection Defense Design

## Scope

This design resolves GitHub issue #12 by treating every imported, project-supplied, and LLM-generated intermediate value as untrusted until it has passed field-aware serialization. It covers both Junos set output and Junos XML output, validates the completed artifacts before export or push, and independently validates payloads again in the PyEZ bridge.

The work applies to every converter feature currently emitted by `src/converters/srx-converter.js` and `src/converters/srx-xml-builder.js`, not only descriptions or the proof-of-concept fields. Name-collision handling remains tracked by issue #10, while this issue guarantees that a normalized name cannot escape its syntactic position.

## Security invariants

- One set-command array entry can produce at most one Junos command.
- Untrusted input cannot add a newline, carriage return, NUL, Unicode line separator, or other control character to generated output.
- Printable quotes and backslashes in legitimate free text are preserved through correct Junos escaping rather than removed.
- An untrusted value cannot terminate a quoted set value, add a new token, or change the command hierarchy around it.
- XML data can appear only as text or an attribute value in its intended element. It cannot create elements, attributes, comments, processing instructions, entities, siblings, or ancestors.
- Dynamic XML element names come only from explicit allowlists.
- Invalid enums, numbers, addresses, prefixes, ports, and identifiers stop conversion with the exact intermediate-config path and reason.
- Completed set and XML artifacts must pass structural validation before they can be displayed as successful output, exported, or pushed.
- The PyEZ bridge rejects malformed or forbidden configuration independently of browser validation and before opening a NETCONF connection.

## Shared serialization module

Create `src/security/junos-serialization.js` as the only implementation of Junos scalar serialization. It will export a typed `JunosSerializationError` carrying `fieldPath`, `valueKind`, and a safe user-facing reason.

The module will provide these primitives:

- `assertSafeScalar(value, fieldPath)`: convert supported scalar values to strings and reject C0/C1 controls, CR/LF, NUL, DEL, U+2028, and U+2029.
- `setToken(value, fieldPath, pattern)`: validate an unquoted token against its field-specific pattern after the control-character check.
- `setIdentifier(value, fieldPath)`: normalize with the established Junos-name function and verify that the result contains only Junos identifier characters.
- `setQuoted(value, fieldPath)`: escape backslashes and double quotes and return one quoted Junos value.
- `setEnum(value, allowed, fieldPath)`, `setInteger(value, bounds, fieldPath)`, `setPort(value, fieldPath)`, and `setAddressOrPrefix(value, fieldPath)`: reject values that do not match their domain.
- `setCommand(verb, hierarchy, values)`: join only already-serialized tokens and reject embedded whitespace or command delimiters in unquoted pieces.
- `xmlText(value, fieldPath)` and `xmlAttribute(value, fieldPath)`: apply the scalar check and XML-encode `&`, `<`, `>`, quotes, and apostrophes.
- `xmlElementName(value, allowed, fieldPath)`: return only a member of a fixed element-name allowlist.
- `xmlComment(value, fieldPath)`: produce valid comment text by preventing `--` and a trailing `-`; diagnostic comments must never embed raw values directly.

Normal printable punctuation remains valid in free-text fields. Unsafe controls and domain-invalid values are rejected rather than silently stripped or normalized into a potentially different security policy.

## Intermediate-config validation

Create `src/security/junos-input-validation.js` to validate the complete intermediate configuration before either converter begins emission. A recursive scalar walk provides the first universal control-character boundary and reports paths such as `security_policies[2].description` or `metadata.siteName`.

Field-aware validators then cover:

- identifiers and references;
- IP addresses, prefixes, ranges, next hops, and DNS names;
- ports and port ranges;
- VLAN/VNI/AS numbers, metrics, timers, thresholds, priorities, and other numeric fields;
- policy, NAT, protocol, authentication, encryption, HA, routing, and service enums; and
- free text such as descriptions, banners, contact/location values, metadata, and LLM notes.

The validator returns a validated view used by both set and XML conversion so the two formats cannot disagree about whether an input is safe. LLM output enters through the same path and receives no exemptions.

## Set-format emission

All dynamic set-format values will pass through the shared primitives. Free-text description and banner emitters will use `setQuoted`; identifiers will use `setIdentifier`; numeric, enum, and network values will use their matching typed serializer. The existing pattern of placing raw `${value}` expressions inside quoted strings will be removed.

The converter will finish with `validateSetOutput(commands)`, which verifies:

- every array entry is a string without controls or embedded line boundaries;
- non-comment entries begin with `set` or `deactivate` only;
- quotes and escapes form a complete lexical sequence;
- semicolons, shell-style command substitution, and unexpected comment delimiters cannot occur outside a quoted value;
- each top-level hierarchy is one the converter supports; and
- known forbidden management, scripting, event-automation, and credential-changing hierarchies are absent.

Comments remain separate array entries and receive their own safe-comment serializer. They are filtered before bridge load as today, but they still cannot contain an injected command line.

## XML emission

Every dynamic XML text and attribute position will call `xmlText` or `xmlAttribute`. All existing raw interpolations in unsupported-item comments, source annotations, numeric fields, VPN fields, HA fields, routing values, and other late-file builders will be migrated.

Dynamic element positions—policy action, IDP action, schedule day, category, and context wrapper—will use explicit maps or `xmlElementName`; XML escaping is not treated as element-name validation.

`validateXmlOutput(xml)` will parse with entity processing disabled and require:

- exactly one document and one `<configuration>` root;
- no DTD, entity declaration, processing instruction beyond the XML declaration, CDATA, or content outside the root;
- only supported top-level Junos configuration hierarchies;
- no forbidden management, script, event, credential, or clear-text service hierarchy; and
- well-formed element and attribute structure.

The output validator returns the original artifact on success and a `JunosSerializationError` on failure.

## Browser integration and errors

Both converter entry points will validate input before emission and validate output before returning. Conversion state will never receive a successful `srxOutput` when serialization fails.

`useConversion` will catch `JunosSerializationError`, clear stale output, and present a blocking message containing the safe field path and reason. The UI must not echo the rejected secret or attacker-controlled value. Export, copy, download, and push remain unavailable because no valid output object exists.

Existing non-security warnings continue to use the warning system. Serialization failures are errors, not warnings that a user can ignore.

## Bridge defense-in-depth

Create `tools/pyez-bridge/config_validation.py` and call it in `/devices/<name>/load` before `_connect`, locking, or PyEZ construction.

For set format, the bridge will enforce the same one-command-per-line lexical rules, accept only `set` and `deactivate`, reject controls and malformed quoting, and deny known dangerous hierarchies not produced by the converter. It will report a one-based line number without reflecting the full rejected command.

For XML format, the bridge will use `lxml.etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=False)`, explicitly reject DTD/entity declarations and processing instructions, require one `<configuration>` root, inspect the hierarchy allowlist, and deny dangerous paths. Text-format load will be disabled for the browser bridge because brace-format parsing cannot provide the same structural assurance; the current frontend emits set or XML only.

Validation failures return HTTP `400` with `ok: false`, a generic message, and safe structured details. A test will mock `_connect` and prove it is not called for every rejected payload class.

## Testing

JavaScript serializer unit tests will cover every primitive with valid and invalid values. Converter regression fixtures will place adversarial data in descriptions, site/group metadata, system fields, names, policy actions, tags, comments, VPN/routing fields, numbers, addresses, and LLM-derived fields.

Required attack cases include:

- CR/LF command injection and Unicode line separators;
- NUL and other controls;
- quote/backslash termination attempts;
- semicolon and command-substitution text;
- XML closing-tag and sibling-element fragments;
- comment termination using `-->`;
- malicious dynamic tag names;
- numeric and enum fields containing XML or set syntax; and
- forbidden but otherwise well-formed set and XML hierarchy.

Tests will prove both that attacks fail with a field/line error and that ordinary punctuation, quotes, ampersands, Unicode text, valid addresses, valid enums, and current fixtures still convert and round-trip correctly.

Python bridge tests will exercise set, XML, and disabled text validation through the real Flask test client and prove rejection occurs before any device connection.

Static source-contract tests will prevent direct raw interpolation from returning to protected free-text and dynamic-tag emission sites. The complete existing JavaScript, Python, build, and GitHub Actions suites remain required.

## Out of scope

- Changing the semantic intent of valid firewall policies.
- Resolving normalized-name collisions tracked by issue #10.
- Replacing PyEZ with RustEZ.
- Providing a general-purpose arbitrary Junos configuration loader; the bridge accepts the converter's supported set/XML subset.
