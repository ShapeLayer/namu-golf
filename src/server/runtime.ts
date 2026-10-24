// CVE-2026-111497: Bun's bundled Brotli decoder is fixed in 1.4.4.
export function assertSafeBun(version: string): void {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match) {
    const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number];
    if (major > 1 || (major === 1 && (minor > 4 || (minor === 4 && patch >= 4)))) return;
  }
  throw new Error(`Bun >=1.4.4 is required (CVE-2026-111497); found ${version}`);
}
assertSafeBun(Bun.version);
