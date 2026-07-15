/**
 * Test: PAN-OS NAT parser captures service protocol/port
 * ========================================================
 * Issue #55 Part B: parseNatRules should extract the <service> element
 * and resolve it to match_protocol/match_port for the converter.
 */

import { describe, it, expect } from 'vitest';
import { parsePanosConfig } from '../src/parsers/panos-parser.js';

describe('PAN-OS NAT parser — service capture (issue #55)', () => {
  it('captures service protocol and port from service object', () => {
    const xml = `<?xml version="1.0"?>
<config>
  <devices>
    <entry name="localhost.localdomain">
      <vsys>
        <entry name="vsys1">
          <service>
            <entry name="svc-web">
              <protocol><tcp><port>8080</port></tcp></protocol>
            </entry>
          </service>
          <rulebase>
            <nat>
              <rules>
                <entry name="nat-with-service">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>10.0.1.0/24</member></source>
                  <destination><member>any</member></destination>
                  <service>svc-web</service>
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address><interface>ethernet1/1</interface></interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                </entry>
              </rules>
            </nat>
          </rulebase>
        </entry>
      </vsys>
    </entry>
  </devices>
</config>`;

    const result = parsePanosConfig(xml);
    const natRules = result.intermediateConfig.nat_rules;
    expect(natRules).toHaveLength(1);
    const rule = natRules[0];
    expect(rule.name).toBe('nat-with-service');
    expect(rule.match_protocol).toBe('tcp');
    expect(rule.match_port).toBe('8080');
  });

  it('captures UDP service protocol and port', () => {
    const xml = `<?xml version="1.0"?>
<config>
  <devices>
    <entry name="localhost.localdomain">
      <vsys>
        <entry name="vsys1">
          <service>
            <entry name="svc-dns">
              <protocol><udp><port>53</port></udp></protocol>
            </entry>
          </service>
          <rulebase>
            <nat>
              <rules>
                <entry name="nat-udp">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>any</member></source>
                  <destination><member>any</member></destination>
                  <service>svc-dns</service>
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address><interface>ethernet1/1</interface></interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                </entry>
              </rules>
            </nat>
          </rulebase>
        </entry>
      </vsys>
    </entry>
  </devices>
</config>`;

    const result = parsePanosConfig(xml);
    const rule = result.intermediateConfig.nat_rules[0];
    expect(rule.match_protocol).toBe('udp');
    expect(rule.match_port).toBe('53');
  });

  it('leaves match_protocol/match_port unset for service "any"', () => {
    const xml = `<?xml version="1.0"?>
<config>
  <devices>
    <entry name="localhost.localdomain">
      <vsys>
        <entry name="vsys1">
          <rulebase>
            <nat>
              <rules>
                <entry name="nat-any-service">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>10.0.2.0/24</member></source>
                  <destination><member>any</member></destination>
                  <service>any</service>
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address><interface>ethernet1/2</interface></interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                </entry>
              </rules>
            </nat>
          </rulebase>
        </entry>
      </vsys>
    </entry>
  </devices>
</config>`;

    const result = parsePanosConfig(xml);
    const rule = result.intermediateConfig.nat_rules[0];
    expect(rule.match_protocol).toBeUndefined();
    expect(rule.match_port).toBeUndefined();
  });

  it('leaves match_protocol/match_port unset when service is absent', () => {
    const xml = `<?xml version="1.0"?>
<config>
  <devices>
    <entry name="localhost.localdomain">
      <vsys>
        <entry name="vsys1">
          <rulebase>
            <nat>
              <rules>
                <entry name="nat-no-service">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>10.0.3.0/24</member></source>
                  <destination><member>any</member></destination>
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address><interface>ethernet1/3</interface></interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                </entry>
              </rules>
            </nat>
          </rulebase>
        </entry>
      </vsys>
    </entry>
  </devices>
</config>`;

    const result = parsePanosConfig(xml);
    const rule = result.intermediateConfig.nat_rules[0];
    expect(rule.match_protocol).toBeUndefined();
    expect(rule.match_port).toBeUndefined();
  });

  it('leaves match_protocol/match_port unset for service "application-default"', () => {
    const xml = `<?xml version="1.0"?>
<config>
  <devices>
    <entry name="localhost.localdomain">
      <vsys>
        <entry name="vsys1">
          <rulebase>
            <nat>
              <rules>
                <entry name="nat-app-default">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>10.0.4.0/24</member></source>
                  <destination><member>any</member></destination>
                  <service>application-default</service>
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address><interface>ethernet1/4</interface></interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                </entry>
              </rules>
            </nat>
          </rulebase>
        </entry>
      </vsys>
    </entry>
  </devices>
</config>`;

    const result = parsePanosConfig(xml);
    const rule = result.intermediateConfig.nat_rules[0];
    expect(rule.match_protocol).toBeUndefined();
    expect(rule.match_port).toBeUndefined();
  });

  it('does not crash when service object is missing', () => {
    const xml = `<?xml version="1.0"?>
<config>
  <devices>
    <entry name="localhost.localdomain">
      <vsys>
        <entry name="vsys1">
          <rulebase>
            <nat>
              <rules>
                <entry name="nat-unknown-service">
                  <from><member>trust</member></from>
                  <to><member>untrust</member></to>
                  <source><member>10.0.5.0/24</member></source>
                  <destination><member>any</member></destination>
                  <service>svc-missing</service>
                  <source-translation>
                    <dynamic-ip-and-port>
                      <interface-address><interface>ethernet1/5</interface></interface-address>
                    </dynamic-ip-and-port>
                  </source-translation>
                </entry>
              </rules>
            </nat>
          </rulebase>
        </entry>
      </vsys>
    </entry>
  </devices>
</config>`;

    const result = parsePanosConfig(xml);
    const rule = result.intermediateConfig.nat_rules[0];
    // Unresolved service → leave unset (no crash)
    expect(rule.match_protocol).toBeUndefined();
    expect(rule.match_port).toBeUndefined();
  });
});
