const paths = {
  shield:
    '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  helmet:
    '<path d="M4 15a8 8 0 0 1 5-7.4V5h6v2.6a8 8 0 0 1 5 7.4M9 8v5m6-5v5M3 15h18v4H3zM8 19v2h8v-2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/><circle cx="9" cy="7" r="4"/>',
  trainer:
    '<rect x="4" y="6" width="16" height="13" rx="4"/><path d="M12 3v3M2 11v4m20-4v4m-13-1h.01M15 14h.01M9 17h6"/><circle cx="8.5" cy="11" r=".5"/><circle cx="15.5" cy="11" r=".5"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3Z"/>',
  send: '<path d="m22 2-11 11M22 2 15 22l-4-9-9-4 20-7Z"/>',
  chart: '<path d="M3 3v18h18M7 14l4-4 4 3 5-7m-5 0h5v5"/>',
  bars: '<path d="M5 20v-6m7 6V4m7 16V9"/>',
  settings:
    '<path d="m9 3-1 3-3 1-1 4 2 2-1 3 3 3 3-1 2 2 4-1 1-3 3-1 1-4-2-2 1-3-3-3-3 1-2-2Z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  circle: '<circle cx="12" cy="12" r="9"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  key: '<circle cx="8" cy="8" r="5"/><path d="m12 12 9 9m-4-4 3-3m-6 0 3-3"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="m3 3 18 18M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.5 6.5A18 18 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.5-1.5M10 10a3 3 0 0 0 4 4"/>',
  search: '<circle cx="10.8" cy="10.8" r="7.5"/><path d="m16.5 16.5 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon: '<path d="M20.9 13.2A9 9 0 0 1 10.8 3.1 9 9 0 1 0 20.9 13.2Z"/>',
  logout: '<path d="M9 4H4v16h5m6-12 4 4-4 4m-7-4h11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4h.01"/>',
  alert:
    '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01"/>',
  award:
    '<circle cx="12" cy="8" r="5"/><path d="m8.2 12-1.8 9 5.6-3 5.6 3-1.8-9"/>',
  trophy:
    '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H3v2a5 5 0 0 0 5 5m8-7h5v2a5 5 0 0 1-5 5m-4 1v5m-5 3h10m-8 0v-3h6v3"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  print: '<path d="M6 9V3h12v6M6 18H3v-9h18v9h-3M6 14h12v7H6Zm11-2h.01"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm-3 3 5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3m-10 0 1 15h12l1-15M10 10v7m4-7v7"/>',
  pause: '<path d="M7 5v14M17 5v14"/>',
  play: '<path d="m7 4 14 8-14 8V4Z"/>',
  refresh:
    '<path d="M20 7v5h-5M4 17v-5h5m11 0a8 8 0 0 0-14-5M4 12a8 8 0 0 0 14 5"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-6-6-12 12"/>',
  package:
    '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5"/>',
  ladder: '<path d="M6 3v18M18 3v18M6 6h12M6 12h12M6 18h12"/>',
  book: '<path d="M12 6C8 3 4 3 2 4v15c4-1 7 0 10 2m0-15c4-3 8-3 10-2v15c-4-1-7 0-10 2V6Z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 10h18c0-3-3-3-3-10M10 21h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sparkles:
    '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM21 2v4m-2-2h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 5 9 8 9-8"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M3 17v4h18v-4"/>',
  quote:
    '<path d="M3 12V6h7v8a5 5 0 0 1-5 5m9-7V6h7v8a5 5 0 0 1-5 5M3 12h7m4 0h7"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
};
export const icon = (name, size = 20, cls = "") =>
  `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.circle}</svg>`;
export function brand(dark = false, compact = false, tag = null) {
  return `<a class="brand ${dark ? "brand-dark" : ""} ${compact ? "brand-compact" : ""}" href="#/" aria-label="Zero Incident home"><span class="brand-symbol">${icon("shield", 32)}</span><span><strong>ZERO <em>INCIDENT</em></strong><small>${compact ? tag || (dark ? "SAFETY ADMIN CONSOLE" : "EMPLOYEE LEARNING HUB") : "SAFETY SIMULATOR ENVIRONMENT"}</small></span></a>`;
}
