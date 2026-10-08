import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateReleaseVersion(tag, metadata, lockfile) {
  const version = metadata?.version;
  const match =
    typeof version === 'string' &&
    version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
  const invalidPrerelease =
    match &&
    match[4]
      ?.split('.')
      .some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'));
  if (!match || invalidPrerelease) {
    throw new Error('package.json must contain a valid release version such as 0.1.0 or 0.2.0-beta.1.');
  }
  const expected = `v${version}`;
  if (tag !== expected) throw new Error(`Release tag must be ${expected}; received ${tag || '(none)'}.`);
  if (lockfile?.version !== version || lockfile?.packages?.['']?.version !== version) {
    throw new Error('package-lock.json must match the package.json version. Run npm version before releasing.');
  }
  return expected;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
    const tag = validateReleaseVersion(process.argv[2] || process.env.GITHUB_REF_NAME, metadata, lockfile);
    console.log(`${tag} matches the package and lockfile versions.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
