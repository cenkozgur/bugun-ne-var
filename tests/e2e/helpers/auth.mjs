import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const STORAGE_STATE_PATH = resolve(
  process.cwd(),
  'tests/e2e/.auth/user.json'
);

export function hasAuthState() {
  return existsSync(STORAGE_STATE_PATH);
}

export function requireAuthOrSkip(test) {
  test.skip(!hasAuthState(), 'no auth state — run `npm run test:e2e:login` once');
}
