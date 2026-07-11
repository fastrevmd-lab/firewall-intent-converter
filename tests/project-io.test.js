import { describe, expect, it } from 'vitest';

import { buildProjectPayload, validateProjectFile } from '../public/utils/project-io.js';

const baseState = {
  configText: 'set system host-name source',
  intermediateConfig: { metadata: {} },
};

function legacyProject(srxOutput, outputFormat = 'set') {
  return {
    fpic_version: 2,
    name: 'legacy',
    savedAt: '2026-07-11T00:00:00.000Z',
    state: { ...baseState, srxOutput, outputFormat },
  };
}

describe('canonical project output', () => {
  it('writes version 3 projects with canonical output', () => {
    const payload = buildProjectPayload({
      ...baseState,
      srxOutput: { format: 'set', commands: ['set system host-name edge-1'] },
      outputFormat: 'set',
    }, 'canonical');

    expect(payload.fpic_version).toBe(3);
    expect(payload.state.srxOutput).toEqual({
      format: 'set',
      commands: ['set system host-name edge-1'],
    });
  });

  it('migrates version 2 string, set-object, and XML-object output', () => {
    const stringResult = validateProjectFile(legacyProject('set system host-name edge-1'));
    const objectResult = validateProjectFile(legacyProject({
      commands: ['set system host-name edge-2'],
      warnings: [],
    }));
    const xmlResult = validateProjectFile(legacyProject({
      xml: '<configuration><system><host-name>edge-3</host-name></system></configuration>',
    }, 'xml'));

    expect(stringResult.valid).toBe(true);
    expect(stringResult.project.state.srxOutput.format).toBe('set');
    expect(objectResult.project.state.srxOutput).toMatchObject({ format: 'set' });
    expect(xmlResult.project.state.srxOutput).toMatchObject({ format: 'xml' });
    expect(stringResult.project.fpic_version).toBe(3);
  });

  it.each([
    { commands: [] },
    { srxCommands: 'set system host-name bypass' },
    { commands: ['set system host-name edge-1'], xml: '<configuration/>' },
  ])('rejects malformed legacy output: %j', srxOutput => {
    const result = validateProjectFile(legacyProject(srxOutput));

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/conversion output/i);
  });

  it('preserves null output', () => {
    const result = validateProjectFile(legacyProject(null));

    expect(result.valid).toBe(true);
    expect(result.project.state.srxOutput).toBeNull();
  });
});
