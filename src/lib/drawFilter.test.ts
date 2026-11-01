import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { N_TERBAWA, PIPING_CROSS_SECONDS, createPipingMotion, filterPore, stepPiping } from "./drawFilter.ts";
import { filterDesign } from "./hydraulics.ts";

describe("drawFilter DM-02", () => {
  it("pori D15f/4 sejalan dengan retains: tertahan tepat bila D85b ≥ pori", () => {
    for (const [bD50, bCu, fD50, fCu] of [
      [0.2, 6, 3, 6],
      [0.2, 6, 30, 6],
      [0.15, 1.4, 1.2, 6],
      [1, 3, 10, 2],
      [0.05, 10, 80, 1.2],
    ]) {
      const r = filterDesign(bD50, bCu, fD50, fCu);
      assert.equal(r.base.d85 >= filterPore(r.filter), r.retains, `${bD50} ${bCu} ${fD50} ${fCu}`);
    }
  });

  it("butir terbawa tidak pernah lebih besar daripada pori, laju skematik tetap", () => {
    const r = filterDesign(0.2, 6, 30, 6);
    assert.equal(r.retains, false);
    const m = createPipingMotion();
    stepPiping(m, 0, r.base, r.filter);
    const x0 = Array.from(m.x);
    stepPiping(m, 0.1, r.base, r.filter);
    for (let i = 0; i < N_TERBAWA; i++) {
      assert.ok(m.d[i] <= filterPore(r.filter) + 1e-9);
      let dx = m.x[i] - x0[i];
      if (dx < 0) dx += 1;
      assert.ok(Math.abs(dx - 0.1 / PIPING_CROSS_SECONDS) < 1e-6);
    }
  });
});
