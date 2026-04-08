import { createWarning } from '../parsers/parser-utils.js';

/**
 * Returns true if any command matches the given string prefix or regex pattern.
 * @param {string[]} commands
 * @param {string|RegExp} pattern
 * @returns {boolean}
 */
function hasCommand(commands, pattern) {
  if (typeof pattern === 'string') return commands.some(c => c.startsWith(pattern));
  return commands.some(c => pattern.test(c));
}

/**
 * Runs a suite of compliance checks (C1–C12) against an array of SRX set commands.
 * @param {string[]} commands - Array of SRX set command strings
 * @returns {Array<{severity: string, element: string, message: string, suggestion: string, timestamp: string}>}
 */
export function runComplianceChecks(commands) {
  const warnings = [];

  // C1 — No NTP configured
  if (!hasCommand(commands, 'set system ntp server')) {
    warnings.push(createWarning(
      'warning',
      'compliance/no-ntp',
      'No NTP server configured.',
      'Add "set system ntp server <ip>" to synchronize system time.'
    ));
  }

  // C2 — No DNS configured
  if (!hasCommand(commands, 'set system name-server')) {
    warnings.push(createWarning(
      'info',
      'compliance/no-dns',
      'No DNS name-server configured.',
      'Add "set system name-server <ip>" for hostname resolution.'
    ));
  }

  // C3 — No syslog configured
  if (!hasCommand(commands, 'set system syslog host')) {
    warnings.push(createWarning(
      'warning',
      'compliance/no-syslog',
      'No remote syslog host configured.',
      'Add "set system syslog host <ip> ..." to forward logs to a SIEM.'
    ));
  }

  // C4 — SNMP community is public or private
  if (hasCommand(commands, /^set snmp community (public|private)\b/)) {
    warnings.push(createWarning(
      'warning',
      'compliance/default-snmp',
      'SNMP community string is set to a default value (public/private).',
      'Change the SNMP community string to a unique, non-guessable value.'
    ));
  }

  // C5 — No login banner
  if (!hasCommand(commands, 'set system login message')) {
    warnings.push(createWarning(
      'info',
      'compliance/no-login-banner',
      'No login banner (message of the day) configured.',
      'Add "set system login message \\"...\\"" to display a warning banner.'
    ));
  }

  // C6 — No console/aux timeout
  if (!hasCommand(commands, 'set system ports console')) {
    warnings.push(createWarning(
      'info',
      'compliance/no-console-timeout',
      'No console port idle timeout configured.',
      'Add "set system ports console insecure" or a timeout to lock idle console sessions.'
    ));
  }

  // C7 — Telnet enabled
  if (hasCommand(commands, 'set system services telnet')) {
    warnings.push(createWarning(
      'warning',
      'compliance/telnet-enabled',
      'Telnet service is enabled — transmits credentials in cleartext.',
      'Remove "set system services telnet" and use SSH instead.'
    ));
  }

  // C8 — No SSH configured
  if (!hasCommand(commands, 'set system services ssh')) {
    warnings.push(createWarning(
      'info',
      'compliance/no-ssh',
      'SSH management service is not configured.',
      'Add "set system services ssh" to enable encrypted remote access.'
    ));
  }

  // C9 — Weak password policy (users exist but no minimum-length)
  const hasUsers = hasCommand(commands, 'set system login user');
  if (hasUsers && !hasCommand(commands, 'set system login password minimum-length')) {
    warnings.push(createWarning(
      'info',
      'compliance/weak-password-policy',
      'Local users exist but no minimum password length is enforced.',
      'Add "set system login password minimum-length <N>" to enforce password complexity.'
    ));
  }

  // C10 — No login retry/lockout
  if (hasUsers && !hasCommand(commands, 'set system login retry-options')) {
    warnings.push(createWarning(
      'info',
      'compliance/no-login-lockout',
      'Local users exist but no login retry/lockout policy is configured.',
      'Add "set system login retry-options ..." to lock accounts after failed attempts.'
    ));
  }

  // C11 — HTTP management enabled without HTTPS
  if (
    hasCommand(commands, 'set system services web-management http') &&
    !hasCommand(commands, 'set system services web-management https')
  ) {
    warnings.push(createWarning(
      'warning',
      'compliance/http-management',
      'HTTP web management is enabled without HTTPS.',
      'Replace "set system services web-management http" with the https variant.'
    ));
  }

  // C12 — No root authentication
  if (!hasCommand(commands, 'set system root-authentication')) {
    warnings.push(createWarning(
      'warning',
      'compliance/no-root-auth',
      'No root authentication method is configured.',
      'Add "set system root-authentication ssh-rsa ..." or set a root password.'
    ));
  }

  return warnings;
}
