import { describe, expect, it } from 'vitest';

import {
  CURRENT_VERSION,
  buildProjectCore,
  validateProjectFile,
  validateProjectStateCore,
} from '../public/utils/project-io.js';
import {
  PROJECT_SECURITY_MODES,
  inspectProjectImport,
  openProjectImport,
  serializeProjectExport,
} from '../public/utils/project-security.js';
import { ConversionOutputError } from '../src/conversion/conversion-output.js';

const IDENTIFIER_MAPPINGS = { version: 1, entries: [] };
const RECONVERT_WARNING = 'Generated output from this older project was cleared because it has no validated identifier mapping. Reconvert before export or device push.';
const PASSPHRASE = 'correct horse battery staple';
const SANITIZED_SECURITY = {
  schema: 1,
  mode: 'sanitized',
  containsOriginals: false,
  reversible: false,
  restorationAvailable: false,
};

const baseState = {
  configText: 'set system host-name source',
  intermediateConfig: { metadata: {} },
};

function project(version, srxOutput, outputFormat = 'set', state = {}) {
  return {
    fpic_version: version,
    name: 'project',
    savedAt: '2026-07-11T00:00:00.000Z',
    state: { ...baseState, srxOutput, outputFormat, ...state },
  };
}

function restorationTable(original = 'ORIGINAL-FW') {
  return [{
    type: 'device_hostname',
    placeholder: 'sanitized-fw',
    original,
  }];
}

function v5Project(mode, state, overrides = {}) {
  const security = mode === 'sanitized'
    ? { ...SANITIZED_SECURITY }
    : {
      schema: 1,
      mode: 'unsanitized',
      containsOriginals: true,
      reversible: false,
      restorationAvailable: false,
    };
  return {
    fpic_version: 5,
    name: 'project',
    savedAt: '2026-07-11T00:00:00.000Z',
    security,
    state,
    ...overrides,
  };
}

describe('version 5 project security formats', () => {
  it('writes an irreversible sanitized v5 file by default', async () => {
    const state = {
      ...baseState,
      isSanitized: true,
      sanitizationTable: restorationTable('UNIQUE-ORIGINAL-HOST'),
    };
    const result = await serializeProjectExport(state, 'safe project', { mode: 'sanitized' });
    const parsed = JSON.parse(result.serialized);
    expect(parsed).toMatchObject({
      fpic_version: 5,
      security: {
        mode: 'sanitized',
        containsOriginals: false,
        reversible: false,
        restorationAvailable: false,
      },
    });
    expect(result.filename).toBe('safe-project.sanitized.fpic.json');
    expect(result.serialized).not.toContain('UNIQUE-ORIGINAL-HOST');
    expect(result.serialized).not.toContain('sanitizationTable');
  });

  it('requires exact confirmation for unsanitized v5 export', async () => {
    await expect(serializeProjectExport(baseState, 'unsafe', {
      mode: 'unsanitized',
      confirmation: '',
    })).rejects.toMatchObject({ code: 'invalid_confirmation' });
    await expect(serializeProjectExport(baseState, 'unsafe', {
      mode: 'unsanitized',
      confirmation: 'EXPORT UNSANITIZED',
    })).resolves.toMatchObject({
      filename: 'unsafe.unsanitized.fpic.json',
    });
  });

  it('writes exact plaintext unsanitized metadata after rescanning state', async () => {
    const result = await serializeProjectExport({
      ...baseState,
      isSanitized: false,
      sanitizationTable: restorationTable(),
    }, 'unsafe', {
      mode: 'unsanitized', confirmation: 'EXPORT UNSANITIZED',
    });
    const parsed = JSON.parse(result.serialized);
    expect(Object.keys(parsed)).toEqual(['fpic_version', 'name', 'savedAt', 'security', 'state']);
    expect(parsed.security).toEqual({
      schema: 1,
      mode: 'unsanitized',
      containsOriginals: true,
      reversible: false,
      restorationAvailable: true,
    });
    const opened = await openProjectImport(result.serialized, {});
    expect(opened).toMatchObject({
      security: parsed.security,
      requiresConfirmation: true,
    });
    expect(opened.project.state.sanitizationTable).toEqual(restorationTable());
  });

  it.each([
    ['missing acknowledgement', { confirmationPassphrase: PASSPHRASE }],
    ['missing confirmation', { acknowledgement: true }],
    ['mismatched confirmation', {
      acknowledgement: true, confirmationPassphrase: 'correct horse battery stapler',
    }],
  ])('enforces reversible confirmation at the boundary: %s', async (_label, options) => {
    const state = {
      ...baseState,
      isSanitized: true,
      sanitizationTable: restorationTable(),
    };
    await expect(serializeProjectExport(state, 'backup', {
      mode: 'reversible-encrypted',
      passphrase: PASSPHRASE,
      ...options,
    })).rejects.toMatchObject({ code: 'invalid_confirmation' });
  });

  it('round-trips an authenticated encrypted export without plaintext originals', async () => {
    const exported = await serializeProjectExport({
      ...baseState,
      isSanitized: true,
      sanitizationTable: restorationTable('ENCRYPTED-ORIGINAL-FW'),
    }, 'encrypted backup', {
      mode: PROJECT_SECURITY_MODES.REVERSIBLE,
      passphrase: PASSPHRASE,
      confirmationPassphrase: PASSPHRASE,
      acknowledgement: true,
    });
    expect(exported.filename).toBe('encrypted-backup.reversible.fpic.enc.json');
    expect(exported.serialized).not.toContain('ENCRYPTED-ORIGINAL-FW');
    const inspected = inspectProjectImport(exported.serialized);
    expect(inspected).toMatchObject({
      kind: 'reversible-encrypted',
      security: { mode: 'reversible-encrypted' },
    });
    const opened = await openProjectImport(exported.serialized, { passphrase: PASSPHRASE });
    expect(opened).toMatchObject({
      security: { mode: 'reversible-encrypted' },
      requiresConfirmation: true,
      project: { fpic_version: 5, name: 'encrypted backup' },
    });
    expect(opened.project.state.sanitizationTable).toEqual(
      restorationTable('ENCRYPTED-ORIGINAL-FW'),
    );
  });

  it('imports sanitized files with no restoration capability', async () => {
    const exported = await serializeProjectExport({
      ...baseState,
      isSanitized: true,
      sanitizationTable: [{
        type: 'key', placeholder: 'SANITIZED_KEY_0', original: 'IMPORT-ORIGINAL',
      }],
    }, 'safe', { mode: 'sanitized' });
    const opened = await openProjectImport(exported.serialized, {});
    expect(opened.security.mode).toBe('sanitized');
    expect(opened.security.restorationAvailable).toBe(false);
    expect(opened.requiresConfirmation).toBe(false);
    expect(opened.project.state.sanitizationTable).toBeNull();
    expect(JSON.stringify(opened.project)).not.toContain('IMPORT-ORIGINAL');
  });

  it('classifies mixed merge slots and populated greenfield state as unsanitized', async () => {
    const mixed = {
      ...baseState,
      isSanitized: true,
      sanitizationTable: restorationTable(),
      mergeMode: true,
      configSlots: [{
        configText: 'set system host-name raw-slot',
        intermediateConfig: { metadata: {} },
        isSanitized: false,
      }],
    };
    await expect(serializeProjectExport(mixed, 'mixed', { mode: 'sanitized' }))
      .rejects.toMatchObject({ code: 'unsanitized_source' });

    const greenfield = {
      configText: '',
      intermediateConfig: null,
      greenfieldMode: true,
      greenfieldTemplate: { hostname: 'generated' },
      isSanitized: true,
    };
    await expect(serializeProjectExport(greenfield, 'greenfield', { mode: 'sanitized' }))
      .rejects.toMatchObject({ code: 'unsanitized_source' });
  });

  it.each([
    ['unknown outer key', value => { value.extra = true; }],
    ['unknown security key', value => { value.security.extra = true; }],
    ['wrong sanitized claim', value => { value.security.containsOriginals = true; }],
    ['wrong unsanitized claim', value => { value.security.containsOriginals = false; }],
    ['unmatched restoration claim', value => { value.security.restorationAvailable = true; }],
    ['plaintext reversible mode', value => { value.security.mode = 'reversible-encrypted'; }],
  ])('rejects malformed or cross-mode v5 metadata: %s', (_label, mutate) => {
    const value = v5Project('sanitized', {
      ...baseState,
      isSanitized: true,
    });
    if (_label.includes('unsanitized') || _label.includes('restoration')) {
      value.security = {
        schema: 1, mode: 'unsanitized', containsOriginals: true,
        reversible: false, restorationAvailable: false,
      };
      value.state.isSanitized = false;
    }
    mutate(value);
    expect(() => inspectProjectImport(JSON.stringify(value))).toThrow(expect.objectContaining({
      code: 'invalid_project',
    }));
  });

  it('rejects nested restoration fields and unproven populated sources in sanitized v5 files', () => {
    const nested = v5Project('sanitized', {
      ...baseState,
      isSanitized: true,
      future: { sanitizationTable: null },
    });
    expect(() => inspectProjectImport(JSON.stringify(nested))).toThrow(expect.objectContaining({
      code: 'invalid_project',
    }));

    const unproven = v5Project('sanitized', {
      ...baseState,
      isSanitized: false,
    });
    expect(() => inspectProjectImport(JSON.stringify(unproven))).toThrow(expect.objectContaining({
      code: 'invalid_project',
    }));
  });

  it('classifies legacy v1-v4 sanitized projects with tables as secret-bearing', async () => {
    for (const version of [1, 2, 3, 4]) {
      const serialized = JSON.stringify(project(version, null, 'set', {
        isSanitized: true,
        sanitizationTable: restorationTable(`LEGACY-${version}`),
      }));
      expect(inspectProjectImport(serialized)).toMatchObject({
        kind: 'legacy-secret-bearing',
        security: { mode: 'legacy-secret-bearing', restorationAvailable: true },
      });
      await expect(openProjectImport(serialized, {})).resolves.toMatchObject({
        security: { mode: 'legacy-secret-bearing' },
        requiresConfirmation: true,
        project: { fpic_version: 5 },
      });
    }
  });

  it('rescans legacy sanitized projects without tables before classifying them safe', async () => {
    const safe = JSON.stringify(project(4, null, 'set', {
      configText: 'set system host-name sanitized-fw',
      isSanitized: true,
      sanitizationTable: null,
    }));
    expect(inspectProjectImport(safe)).toMatchObject({
      kind: 'sanitized', security: { mode: 'sanitized' },
    });
    const opened = await openProjectImport(safe, {});
    expect(opened.requiresConfirmation).toBe(false);
    expect(opened.project.state.sanitizationTable).toBeNull();

    const unsafe = JSON.stringify(project(4, null, 'set', {
      configText: 'set password "RAW-LEGACY-SECRET"',
      isSanitized: true,
      sanitizationTable: null,
    }));
    expect(() => inspectProjectImport(unsafe)).toThrow(expect.objectContaining({
      code: 'invalid_project',
    }));
  });

  it('rejects unsupported versions with a fixed failure', () => {
    expect(() => inspectProjectImport(JSON.stringify({ fpic_version: 6 }))).toThrow(
      expect.objectContaining({
        code: 'unsupported_version',
        message: 'Project file version is not supported.',
      }),
    );
  });
});

describe('canonical project output', () => {
  it('builds version 5 project cores with canonical output', () => {
    const payload = buildProjectCore({
      ...baseState,
      srxOutput: {
        format: 'set',
        commands: ['set system host-name edge-1'],
        identifierMappings: IDENTIFIER_MAPPINGS,
      },
      outputFormat: 'set',
    }, 'canonical', SANITIZED_SECURITY);

    expect(CURRENT_VERSION).toBe(5);
    expect(payload.fpic_version).toBe(5);
    expect(payload.security).toEqual(SANITIZED_SECURITY);
    expect(payload.state.srxOutput).toEqual({
      format: 'set',
      commands: ['set system host-name edge-1'],
      identifierMappings: IDENTIFIER_MAPPINGS,
    });
  });

  it('round-trips version 5 mapping-bearing output through core validation', () => {
    const payload = buildProjectCore({
      ...baseState,
      srxOutput: {
        format: 'set',
        commands: ['set system host-name edge-1'],
        identifierMappings: IDENTIFIER_MAPPINGS,
      },
    }, 'round-trip', SANITIZED_SECURITY);
    const result = validateProjectStateCore(JSON.parse(JSON.stringify(payload)));

    expect(result.project).toMatchObject({
      fpic_version: 5,
      name: 'round-trip',
      state: {
        outputFormat: 'set',
        srxOutput: {
          format: 'set',
          commands: ['set system host-name edge-1'],
          identifierMappings: IDENTIFIER_MAPPINGS,
        },
      },
    });
    expect(Object.isFrozen(result.project.state.srxOutput.identifierMappings)).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('rejects invalid output at the new-project core boundary', () => {
    for (const srxOutput of [
      'set system host-name legacy',
      { commands: ['set system host-name legacy-object'], identifierMappings: IDENTIFIER_MAPPINGS },
      { srxCommands: 'set system host-name bypass', identifierMappings: IDENTIFIER_MAPPINGS },
    ]) {
      expect(() => buildProjectCore({ ...baseState, srxOutput }, 'invalid', SANITIZED_SECURITY))
        .toThrow(ConversionOutputError);
    }
  });

  it('corrects a stale output format when building canonical Set Commands output', () => {
    const payload = buildProjectCore({
      ...baseState,
      srxOutput: {
        format: 'set',
        commands: ['set system host-name edge-1'],
        identifierMappings: IDENTIFIER_MAPPINGS,
      },
      outputFormat: 'xml',
    }, 'stale-format', SANITIZED_SECURITY);
    expect(payload.state.outputFormat).toBe('set');
  });

  it('clears unmapped legacy artifacts but preserves editable state', () => {
    const result = validateProjectFile(project(3, {
      format: 'set',
      commands: ['set system host-name edge'],
    }, 'set', {
      convertWarnings: [{ type: 'warning' }],
      conversionSummary: { policies_converted: 1 },
      sourceVendor: 'fortigate',
      targetModel: 'srx1600',
      parseWarnings: [{ type: 'parser-warning' }],
    }));

    expect(result.valid).toBe(true);
    expect(result.project.fpic_version).toBe(5);
    expect(result.project.state.intermediateConfig).toEqual(baseState.intermediateConfig);
    expect(result.project.state.configText).toBe(baseState.configText);
    expect(result.project.state.sourceVendor).toBe('fortigate');
    expect(result.project.state.targetModel).toBe('srx1600');
    expect(result.project.state.parseWarnings).toEqual([{ type: 'parser-warning' }]);
    expect(result.project.state.outputFormat).toBe('set');
    expect(result.project.state.srxOutput).toBeNull();
    expect(result.project.state.convertWarnings).toEqual([]);
    expect(result.project.state.conversionSummary).toBeNull();
    expect(result.warnings).toEqual([RECONVERT_WARNING]);
  });

  it('migrates mapped conversion output through secure legacy import', async () => {
    const legacy = project(2, {
      commands: ['set system host-name edge-2'],
      warnings: [],
      identifierMappings: IDENTIFIER_MAPPINGS,
    }, 'set', { isSanitized: false });
    const opened = await openProjectImport(JSON.stringify(legacy), {});
    expect(opened.project.fpic_version).toBe(5);
    expect(opened.project.state.srxOutput).toEqual({
      format: 'set',
      commands: ['set system host-name edge-2'],
      warnings: [],
      identifierMappings: IDENTIFIER_MAPPINGS,
    });
    expect(opened.warnings).toEqual([]);
  });

  it('rejects malformed mapped and current conversion output without reflecting details', () => {
    const malformed = validateProjectFile(project(3, {
      commands: ['set system host-name edge-1'],
      identifierMappings: { version: 2, entries: [] },
    }));
    expect(malformed.valid).toBe(false);
    expect(malformed.error).toMatch(/identifier mapping/i);

    const missing = validateProjectFile(project(5, {
      format: 'set', commands: ['set system host-name edge-1'],
    }));
    expect(missing.valid).toBe(false);
    expect(missing.error).toMatch(/identifier mapping/i);

    const invalid = validateProjectFile(project(5, {
      format: 'set',
      commands: ['set system host-name edge-1'],
      identifierMappings: { version: 1, entries: [], artifact: 'SECRET-MAPPING-FIELD' },
    }));
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toMatch(/identifier mapping/i);
    expect(invalid.error).not.toContain('SECRET-MAPPING-FIELD');
  });

  it('rejects malformed legacy output that claims a valid mapping', () => {
    const result = validateProjectFile(project(2, {
      commands: [], identifierMappings: IDENTIFIER_MAPPINGS,
    }));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/conversion output/i);
  });

  it('preserves null output without clearing unrelated conversion state', () => {
    const result = validateProjectFile(project(2, null, 'xml', {
      convertWarnings: [{ type: 'retained' }],
      conversionSummary: { policies_converted: 1 },
    }));
    expect(result.valid).toBe(true);
    expect(result.project.fpic_version).toBe(5);
    expect(result.project.state.srxOutput).toBeNull();
    expect(result.project.state.outputFormat).toBe('xml');
    expect(result.project.state.convertWarnings).toEqual([{ type: 'retained' }]);
    expect(result.project.state.conversionSummary).toEqual({ policies_converted: 1 });
    expect(result.warnings).toEqual([]);
  });
});
