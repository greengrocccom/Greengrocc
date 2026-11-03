import test from "node:test";
import assert from "node:assert/strict";
import Order from "../models/order/Order.js";
import Cart from "../models/Cart.js";
import { parseSegment, resolveNotificationAudience } from "./notificationAudience.js";

test("invalid filters fail closed instead of becoming all users", () => {
  for (const input of [{ segment: "unknown" }, { days: 0 }, { days: 1.5 }, { days: "bad" }]) {
    assert.throws(() => parseSegment(input), { status: 400 });
  }
});

test("all users preserves the requested account scope", async () => {
  assert.deepEqual(await resolveNotificationAudience({ role: "user", accountType: "bulk" }), { role: "user", accountType: "bulk" });
});

test("inactive means previous purchasers excluding recent purchasers", async (t) => {
  let calls = 0;
  t.mock.method(Order, "distinct", async (field, filter) => {
    assert.equal(field, "user");
    assert.equal(filter.status.$in.includes("attempted"), false);
    return ++calls === 1 ? ["old-buyer", "recent-buyer"] : ["recent-buyer"];
  });
  assert.deepEqual(await resolveNotificationAudience({ role: "user" }, { segment: "inactive", days: 30 }), {
    role: "user", _id: { $in: ["old-buyer", "recent-buyer"], $nin: ["recent-buyer"] },
  });
});

test("never purchased excludes existing buyers", async (t) => {
  t.mock.method(Order, "distinct", async () => ["buyer"]);
  assert.deepEqual(await resolveNotificationAudience({ role: "user" }, { segment: "never_purchased" }), {
    role: "user", _id: { $nin: ["buyer"] },
  });
});

test("abandoned audiences require idle activity and exclude subsequent purchases", async (t) => {
  for (const segment of ["buy_now_abandoned", "cart_abandoned", "checkout_abandoned"]) {
    const source = segment === "cart_abandoned" ? Cart : Order;
    const mock = t.mock.method(source, "aggregate", async (pipeline) => {
      const match = pipeline[0].$match;
      if (segment === "cart_abandoned") assert.deepEqual(match, { "items.0": { $exists: true } });
      else assert.equal(match.status, "attempted");
      if (segment === "buy_now_abandoned") assert.equal(match.checkoutMode, "buyNow");
      assert.ok(pipeline[2].$match.activityAt.$lte instanceof Date);
      assert.equal(pipeline[3].$lookup.from, Order.collection.name);
      assert.deepEqual(pipeline[4].$match, { "purchases.0": { $exists: false } });
      return [{ _id: "eligible-user" }];
    });
    assert.deepEqual(await resolveNotificationAudience({ role: "user", accountType: "bulk" }, { segment }), {
      role: "user", accountType: "bulk", _id: { $in: ["eligible-user"] },
    });
    mock.mock.restore();
  }
});
