import { describe, expect, it } from 'vitest';

import {
  ConversionOutputError,
  assertConversionOutput,
  filterEffectiveSetCommands,
  getConversionOutputText,
  getSetCommands,
  hasConversionOutput,
  normalizeConversionOutput,
  replaceSetCommands,
} from '../src/conversion/conversion-output.js';

const SET_COMMANDS = [
  'set system host-name edge-1',
  'set system services ssh',
];
const XML = '<configuration><system><host-name>edge-1</host-name></system></configuration>';

describe('canonical conversion output', () => {
  it('normalizes converter set output and preserves metadata', () => {
    const summary = { policies_converted: 2 };
    const output = normalizeConversionOutput({ commands: SET_COMMANDS, warnings: [], summary }, 'set');

    expect(output).toEqual({ format: 'set', commands: SET_COMMANDS, warnings: [], summary });
    expect(output.commands).not.toBe(SET_COMMANDS);
    expect(getConversionOutputText(output)).toBe(SET_COMMANDS.join('\n'));
    expect(getSetCommands(output)).toEqual(SET_COMMANDS);
  });

  it('normalizes converter XML output', () => {
    const output = normalizeConversionOutput({ xml: XML, warnings: [] }, 'xml');

    expect(output).toEqual({ format: 'xml', xml: XML, warnings: [] });
    expect(getConversionOutputText(output)).toBe(XML);
    expect(() => getSetCommands(output)).toThrow(/Set Commands/);
  });

  it('normalizes a legacy set string only with an explicit hint', () => {
    expect(normalizeConversionOutput(SET_COMMANDS.join('\n'), 'set')).toEqual({
      format: 'set',
      commands: SET_COMMANDS,
    });
    expect(() => normalizeConversionOutput(SET_COMMANDS.join('\n'))).toThrow(ConversionOutputError);
    expect(() => normalizeConversionOutput(XML, 'xml')).toThrow(ConversionOutputError);
  });

  it('preserves metadata when replacing filtered commands', () => {
    const original = normalizeConversionOutput({
      commands: SET_COMMANDS,
      warnings: [{ type: 'warning' }],
      summary: { policies_converted: 2 },
      auditId: 'conversion-7',
    }, 'set');

    const filtered = replaceSetCommands(original, [SET_COMMANDS[0]]);

    expect(filtered).toEqual({
      format: 'set',
      commands: [SET_COMMANDS[0]],
      warnings: [{ type: 'warning' }],
      summary: { policies_converted: 2 },
      auditId: 'conversion-7',
    });
    expect(original.commands).toEqual(SET_COMMANDS);
  });

  it('identifies only effective Set and deactivate device commands', () => {
    expect(filterEffectiveSetCommands([
      '# generated configuration',
      '  # retained converter note',
      'set system host-name edge-1',
      'deactivate system services ssh',
    ])).toEqual([
      'set system host-name edge-1',
      'deactivate system services ssh',
    ]);
  });

  it.each([
    null,
    '',
    '   ',
    {},
    { format: 'set', commands: [] },
    { format: 'set', commands: [''] },
    { format: 'set', commands: [7] },
    { format: 'xml', xml: '' },
    { format: 'xml', xml: 7 },
    { format: 'set', commands: SET_COMMANDS, xml: XML },
    { format: 'xml', xml: XML, commands: SET_COMMANDS },
    { format: 'yaml', commands: SET_COMMANDS },
    { format: 'set', srxCommands: SET_COMMANDS.join('\n') },
  ])('rejects missing, empty, mixed, or malformed output: %j', value => {
    expect(() => assertConversionOutput(value)).toThrow(ConversionOutputError);
    expect(hasConversionOutput(value)).toBe(false);
  });

  it('rejects mismatched format hints and unsafe artifacts', () => {
    expect(() => normalizeConversionOutput({ format: 'set', commands: SET_COMMANDS }, 'xml'))
      .toThrow(/does not match/);
    expect(() => normalizeConversionOutput({
      commands: ['set system host-name safe', 'set system services telnet'],
    }, 'set')).toThrow(ConversionOutputError);
  });

  it('does not include rejected configuration in errors', () => {
    const secret = 'set system root-authentication encrypted-password SECRET-HASH';
    let error;
    try {
      normalizeConversionOutput({ commands: [secret] }, 'set');
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ConversionOutputError);
    expect(error.message).not.toContain(secret);
    expect(error.message).not.toContain('SECRET-HASH');
  });
});
