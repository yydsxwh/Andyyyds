import assert from "node:assert/strict";
import {
  evaluateMathcodeQuota,
  MATHCODE_GUEST_CENTS_PER_PAGE,
  MATHCODE_MEMBERSHIP_PAGES,
  nextMembershipGrant,
} from "./mathcode-quota";

const now = new Date("2026-09-05T08:00:00.000Z");

function wallet(partial: {
  memberPages?: number;
  memberUntil?: Date | null;
  guestPages?: number;
}) {
  return {
    memberPages: partial.memberPages ?? 0,
    memberUntil: partial.memberUntil ?? null,
    guestPages: partial.guestPages ?? 0,
  };
}

{
  const admin = evaluateMathcodeQuota({
    unlimited: true,
    wallet: wallet({}),
    pageCount: 99,
    now,
  });
  assert.equal(admin.ok, true);
  if (admin.ok) assert.equal(admin.unlimited, true);
}

{
  const needPay = evaluateMathcodeQuota({
    wallet: wallet({}),
    pageCount: 3,
    now,
  });
  assert.equal(needPay.ok, false);
  if (!needPay.ok) {
    assert.equal(needPay.code, "NEED_PAY");
    if (needPay.code === "NEED_PAY") {
      assert.equal(needPay.pagesNeeded, 3);
      assert.equal(needPay.amountCents, 3 * MATHCODE_GUEST_CENTS_PER_PAGE);
    }
  }
}

{
  const partial = evaluateMathcodeQuota({
    wallet: wallet({ guestPages: 2 }),
    pageCount: 5,
    now,
  });
  assert.equal(partial.ok, false);
  if (!partial.ok && partial.code === "NEED_PAY") {
    assert.equal(partial.pagesNeeded, 3);
  }
}

{
  const enoughGuest = evaluateMathcodeQuota({
    wallet: wallet({ guestPages: 5 }),
    pageCount: 3,
    now,
  });
  assert.equal(enoughGuest.ok, true);
}

{
  const memberOk = evaluateMathcodeQuota({
    wallet: wallet({
      memberPages: 10,
      memberUntil: new Date("2026-10-01T00:00:00.000Z"),
    }),
    pageCount: 8,
    now,
  });
  assert.equal(memberOk.ok, true);
}

{
  const mix = evaluateMathcodeQuota({
    wallet: wallet({
      memberPages: 10,
      memberUntil: new Date("2026-10-01T00:00:00.000Z"),
      guestPages: 5,
    }),
    pageCount: 12,
    now,
  });
  assert.equal(mix.ok, true);
}

{
  const renew = evaluateMathcodeQuota({
    wallet: wallet({
      memberPages: 10,
      memberUntil: new Date("2026-10-01T00:00:00.000Z"),
      guestPages: 5,
    }),
    pageCount: 16,
    now,
  });
  assert.equal(renew.ok, false);
  if (!renew.ok) assert.equal(renew.code, "NEED_RENEW");
}

{
  const emptyMember = evaluateMathcodeQuota({
    wallet: wallet({
      memberPages: 0,
      memberUntil: new Date("2026-10-01T00:00:00.000Z"),
    }),
    pageCount: 1,
    now,
  });
  assert.equal(emptyMember.ok, false);
  if (!emptyMember.ok) assert.equal(emptyMember.code, "NEED_RENEW");
}

{
  const expiredLeftover = evaluateMathcodeQuota({
    wallet: wallet({
      memberPages: 20,
      memberUntil: new Date("2026-08-01T00:00:00.000Z"),
    }),
    pageCount: 1,
    now,
  });
  assert.equal(expiredLeftover.ok, false);
  if (!expiredLeftover.ok) assert.equal(expiredLeftover.code, "NEED_PAY");
}

{
  const expiredGrant = nextMembershipGrant(
    wallet({
      memberPages: 20,
      memberUntil: new Date("2026-08-01T00:00:00.000Z"),
    }),
    now,
  );
  assert.equal(expiredGrant.memberPages, MATHCODE_MEMBERSHIP_PAGES);
  assert.equal(expiredGrant.memberUntil.toISOString(), "2026-10-05T08:00:00.000Z");
}

{
  const activeGrant = nextMembershipGrant(
    wallet({
      memberPages: 20,
      memberUntil: new Date("2026-10-01T00:00:00.000Z"),
    }),
    now,
  );
  assert.equal(activeGrant.memberPages, 170);
  assert.equal(activeGrant.memberUntil.toISOString(), "2026-10-31T00:00:00.000Z");
}

console.log("mathcode-quota tests passed");
