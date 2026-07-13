export const BRAND = Object.freeze({
  product: 'firewallintentconverter',
  endorsement: 'a mechub project',
  accessibleName: 'firewallintentconverter · a mechub project',
});

export function brandMarkFilename(theme) {
  return theme === 'light' ? 'mechub-mark-light.svg' : 'mechub-mark.svg';
}

export function brandAssetUrl(filename, baseUrl = import.meta.env.BASE_URL) {
  return `${baseUrl}brand/${filename}`;
}
