import { expect, test } from '@playwright/test';

test('successful test', async () => {
  await test.step('Step 1: simple equality assertion', async () => {
    expect(1).toBe(1);
  });

  await test.step('Step 2: string includes assertion', async () => {
    expect('playwright demo report').toContain('demo');
  });
});

test('failing test', async () => {
  await test.step('Step 1: still successful', async () => {
    expect(true).toBeTruthy();
  });

  await test.step('Step 2: intentional failure', async () => {
    expect(1).toBe(2);
  });

  await test.step('Step 3: should not be reached', async () => {
    expect('this should not run').toBe('unreachable');
  });
});

