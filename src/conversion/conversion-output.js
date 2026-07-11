import {
  validateSetOutput,
  validateXmlOutput,
} from '../security/junos-output-validation.js';

/**
 * @typedef {Object} SetConversionOutput
 * @property {'set'} format
 * @property {string[]} commands
 */

/**
 * @typedef {Object} XmlConversionOutput
 * @property {'xml'} format
 * @property {string} xml
 */

/** @typedef {SetConversionOutput | XmlConversionOutput} ConversionOutput */

export class ConversionOutputError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'ConversionOutputError';
    this.reason = reason;
  }
}

function fail(reason) {
  throw new ConversionOutputError(reason);
}

function validateArtifact(output) {
  try {
    if (output.format === 'set') validateSetOutput(output.commands);
    else validateXmlOutput(output.xml);
  } catch {
    fail(`Generated ${output.format === 'set' ? 'Set Commands' : 'XML'} output failed Junos artifact validation.`);
  }
}

export function normalizeConversionOutput(rawOutput, formatHint) {
  if (!['set', 'xml', undefined].includes(formatHint)) {
    fail('Conversion output format hint must be set or xml.');
  }

  if (typeof rawOutput === 'string') {
    if (formatHint !== 'set') {
      fail('Legacy string output requires an explicit Set Commands format hint.');
    }
    rawOutput = {
      commands: rawOutput.split('\n').filter(line => line.trim().length > 0),
    };
  }

  if (!rawOutput || typeof rawOutput !== 'object' || Array.isArray(rawOutput)) {
    fail('Conversion output must be an object.');
  }
  if (Object.hasOwn(rawOutput, 'srxCommands')) {
    fail('Conversion output uses an unsupported command field.');
  }

  const format = rawOutput.format ?? formatHint;
  if (rawOutput.format && formatHint && rawOutput.format !== formatHint) {
    fail('Conversion output format does not match its format hint.');
  }
  if (!['set', 'xml'].includes(format)) {
    fail('Conversion output format must be set or xml.');
  }

  if (format === 'set') {
    if (Object.hasOwn(rawOutput, 'xml')) fail('Set Commands output cannot contain XML content.');
    if (!Array.isArray(rawOutput.commands) || rawOutput.commands.length === 0) {
      fail('Set Commands output must contain at least one command.');
    }
    if (rawOutput.commands.some(command => typeof command !== 'string' || !command.trim())) {
      fail('Set Commands output must contain only non-empty strings.');
    }
    const output = { ...rawOutput, format: 'set', commands: [...rawOutput.commands] };
    validateArtifact(output);
    return output;
  }

  if (Object.hasOwn(rawOutput, 'commands')) fail('XML output cannot contain Set Commands content.');
  if (typeof rawOutput.xml !== 'string' || !rawOutput.xml.trim()) {
    fail('XML output must contain non-empty XML text.');
  }
  const output = { ...rawOutput, format: 'xml', xml: rawOutput.xml };
  validateArtifact(output);
  return output;
}

export function assertConversionOutput(output) {
  if (!output || typeof output !== 'object' || !Object.hasOwn(output, 'format')) {
    fail('Canonical conversion output is missing its format.');
  }
  return normalizeConversionOutput(output, output.format);
}

export function getConversionOutputText(output) {
  const canonical = assertConversionOutput(output);
  return canonical.format === 'set' ? canonical.commands.join('\n') : canonical.xml;
}

export function getSetCommands(output) {
  const canonical = assertConversionOutput(output);
  if (canonical.format !== 'set') {
    fail('Validation and license enforcement require Set Commands output.');
  }
  return [...canonical.commands];
}

export function replaceSetCommands(output, commands) {
  const canonical = assertConversionOutput(output);
  if (canonical.format !== 'set') {
    fail('Only Set Commands output can be filtered.');
  }
  return normalizeConversionOutput({ ...canonical, commands }, 'set');
}

export function hasConversionOutput(output) {
  try {
    assertConversionOutput(output);
    return true;
  } catch {
    return false;
  }
}
