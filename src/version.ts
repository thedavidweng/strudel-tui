import pkg from '../package.json' with { type: 'json' };

/** Single source of truth for the app version (bundled from package.json at build time). */
export const VERSION: string = pkg.version;
