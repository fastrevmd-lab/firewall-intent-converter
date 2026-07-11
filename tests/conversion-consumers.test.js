import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const read = relativePath => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

describe('canonical conversion output consumers', () => {
  it('routes render, push, diff, PDF, report, and workflow checks through shared helpers', () => {
    expect(read('public/components/SRXOutput.jsx')).toContain('getConversionOutputText(output)');
    expect(read('public/hooks/usePush.js')).toContain('getConversionOutputText(srxOutput)');
    expect(read('public/hooks/usePush.js')).toContain('hasConversionOutput(srxOutput)');
    expect(read('public/components/ConfigDiff.jsx')).toContain('getConversionOutputText(currentOutput)');
    expect(read('public/utils/pdf-report-generator.js')).toContain('getConversionOutputText(srxOutput)');
    expect(read('public/components/ConversionReport.jsx')).toContain('getSetCommands(srxOutput)');
    expect(read('public/components/layout/WorkflowStepper.jsx')).toContain('hasConversionOutput(srxOutput)');
  });

  it('makes batch conversion consume the engine envelope', () => {
    const source = read('public/components/BatchMigrationPanel.jsx');

    expect(source).toContain('getConversionOutputText(convertResult.output)');
    expect(source).toContain('convertResult.output.warnings');
    expect(source).not.toContain('(convertResult.commands || [])');
  });

  it('removes permissive output fallbacks from security-sensitive paths', () => {
    const combined = [
      read('public/components/SRXOutput.jsx'),
      read('public/hooks/usePush.js'),
      read('public/components/ConfigDiff.jsx'),
      read('public/utils/pdf-report-generator.js'),
    ].join('\n');

    expect(combined).not.toMatch(/srxOutput\?\.srxCommands|srxOutput\.srxCommands/);
    expect(combined).not.toContain("(srxOutput.commands || []).join('\\n')");
    expect(combined).not.toContain("output.xml || ''");
  });
});
