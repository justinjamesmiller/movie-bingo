import { execFileSync } from 'node:child_process';
import { getFileInfo } from 'prettier';
import { describe, expect, it } from 'vitest';
import { version } from '../package.json';
import releaseConfig from '../release-please-config.json';
import releaseManifest from '../.release-please-manifest.json';
import { validateReleaseVersion } from './release-version.js';

function lockfile(version) {
  return { version, packages: { '': { version } } };
}

describe('release version validation', () => {
  it('does not block a managed release on generated changelog formatting', async () => {
    const info = await getFileInfo('CHANGELOG.md', { ignorePath: '.prettierignore' });
    expect(info.ignored).toBe(true);
  });

  it('uses the Node strategy to update package metadata and an unprefixed v-tag with a changelog', () => {
    expect(releaseConfig['release-type']).toBe('node');
    expect(releaseConfig['include-component-in-tag']).toBe(false);
    expect(releaseConfig['include-v-in-tag']).toBe(true);
    expect(releaseConfig.packages['.']['changelog-path']).toBe('CHANGELOG.md');
  });

  it('keeps bootstrap or managed manifest metadata aligned with the displayed package version', () => {
    expect(Object.keys(releaseManifest).every((path) => path === '.')).toBe(true);
    if (releaseManifest['.']) expect(releaseManifest['.']).toBe(version);
    else expect(releaseConfig['initial-version']).toBe(version);
  });

  it('retains minor feature bumps and uses minor breaking bumps while the app is pre-1.0', () => {
    expect(releaseConfig['bump-minor-pre-major']).toBe(true);
    expect(releaseConfig['bump-patch-for-minor-pre-major']).toBe(false);
  });

  it.each(['0.1.0', '1.0.0', '0.2.0-beta.1'])('accepts matching release metadata for %s', (version) => {
    expect(validateReleaseVersion(`v${version}`, { version }, lockfile(version))).toBe(`v${version}`);
  });

  it.each(['v0.0.0', '0.1.0', undefined])('rejects an incorrect or missing release tag: %s', (tag) => {
    expect(() => validateReleaseVersion(tag, { version: '0.1.0' }, lockfile('0.1.0'))).toThrow(
      'Release tag must be v0.1.0',
    );
  });

  it('rejects an out-of-date lockfile version or root package version', () => {
    expect(() => validateReleaseVersion('v0.1.0', { version: '0.1.0' }, lockfile('0.0.0'))).toThrow(
      'package-lock.json must match',
    );
    expect(() =>
      validateReleaseVersion(
        'v0.1.0',
        { version: '0.1.0' },
        { version: '0.1.0', packages: { '': { version: '0.0.0' } } },
      ),
    ).toThrow('package-lock.json must match');
  });

  it.each(['banana', '0.1', '01.0.0', '0.1.0-beta..1', '0.1.0-01'])('rejects invalid package version %s', (version) => {
    expect(() => validateReleaseVersion(`v${version}`, { version }, lockfile(version))).toThrow(
      'valid release version',
    );
  });

  it('checks the actual repository metadata through the release command', () => {
    const output = execFileSync(process.execPath, ['scripts/release-version.js', `v${version}`], { encoding: 'utf8' });
    expect(output).toContain(`v${version} matches the package and lockfile versions.`);
  });
});
