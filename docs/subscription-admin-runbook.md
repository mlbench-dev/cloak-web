# Subscription admin runbook (stopgap)

There's no admin UI for subscriptions yet — Phase 0 intentionally scoped
that out (see `.claude/plans` / the Phase 0 plan doc). Until one exists,
use these against the `subscriptions`, `subscriptionEvents`, and `users`
collections directly (`mongosh "$DATABASE_URL"`).

## Check a user's current plan + subscription state

```js
db.users.findOne({ email: "person@example.com" }, { plan: 1, _id: 1 });
db.subscriptions.findOne({ userId: ObjectId("...") });
```

`users.plan` is a cache — `subscriptions` is the source of truth. If they
disagree, trust `subscriptions` and re-run the app's `resolveUserPlan`
logic mentally: a paid plan with `currentPeriodEnd` in the past and
(`cancelAtPeriodEnd: true` or `status !== "ACTIVE"`) should read as
`FREEMIUM` — the app self-heals this on the user's next request, but you
can also fix it by hand:

```js
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { plan: "FREEMIUM", updatedAt: new Date() } },
);
```

## Comp a plan (support gesture, refund goodwill, etc.)

```js
db.subscriptions.updateOne(
  { userId: ObjectId("...") },
  {
    $set: {
      plan: "CLOAK_PRO",
      status: "ACTIVE",
      billingType: "SUBSCRIPTION",
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    $setOnInsert: { userId: ObjectId("..."), createdAt: new Date() },
  },
  { upsert: true },
);
db.users.updateOne(
  { _id: ObjectId("...") },
  { $set: { plan: "CLOAK_PRO", updatedAt: new Date() } },
);
```

Note: this doesn't create anything on PayFast's side — it's a local-only
grant. If the user later goes through real checkout, the ITN handler will
overwrite this based on their `m_payment_id`, which is expected.

## Investigate a stuck/failed payment

```js
// Most recent events for a user, newest first
db.subscriptionEvents.find({ userId: ObjectId("...") }).sort({ createdAt: -1 }).limit(20);

// By PayFast's own payment id, if you have it from a support ticket
db.subscriptionEvents.findOne({ pfPaymentId: "..." });
```

Check `signatureValid` / `serverValidated` on the event — if either is
`false`, the ITN was received but deliberately not applied (see
`app/api/subscriptions/notify/route.ts`). That's either a genuine spoofed
request, or a signature-generation bug — check server logs around that
`createdAt` timestamp for `"PayFast ITN failed verification"`.

If `subscriptionEvents` has nothing at all for a payment the user says
went through, the ITN never arrived — check PayFast's own dashboard for
delivery attempts/failures against `notify_url`, and confirm
`NEXT_PUBLIC_APP_URL` was correctly reachable at the time.

## Force-cancel without going through PayFast

Only do this if the PayFast-side cancel API is failing and you've
confirmed (in PayFast's dashboard) the subscription is actually gone on
their end too — otherwise PayFast will keep charging even though the app
shows them downgraded.

```js
db.subscriptions.updateOne(
  { userId: ObjectId("...") },
  { $set: { cancelAtPeriodEnd: true, cancelledAt: new Date(), status: "CANCELLED", updatedAt: new Date() } },
);
```
