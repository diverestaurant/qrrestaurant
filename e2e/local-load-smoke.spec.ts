import { expect, test } from "@playwright/test";

test("local menu read burst stays healthy under a synthetic 30-request load", async ({ request }) => {
  const samples = await Promise.all(
    Array.from({ length: 30 }, async () => {
      const started = Date.now();
      const response = await request.get("/api/v1/customer/menu?restaurantSlug=dive-demo&branchSlug=main");
      return { elapsedMs: Date.now() - started, response };
    }),
  );

  expect(samples.every(({ response }) => response.ok())).toBe(true);
  const sorted = samples.map(({ elapsedMs }) => elapsedMs).sort((left, right) => left - right);
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  expect(p95).toBeLessThan(3000);
});
