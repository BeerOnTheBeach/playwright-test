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

  await test.step('Step 2: intentional failure (50% chance)', async () => {
    if (Math.random() < 0.5) {
      expect(1).toBe(2);
    } else {
      expect(1).toBe(1);
    }
  });
});

