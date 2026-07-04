import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeEventStats, buildRegistrantRows, questionLabels } from "../../src/lib/event-registrations.js";

const orders = [
  { _id: "o1", email: "a@x.com", clientDonation: 170, totals: { total: 510 } },
  { _id: "o2", email: "b@x.com", clientDonation: 0, totals: { total: 340 } },
];
const tickets = [
  { orderId: "o1", firstName: "Amy", lastName: "Lee", ticketTypeName: "Full Weekend — Adult", status: "complete",
    checkIn: { checkedIn: true }, additionalFields: [{ questionId: "q1", value: "Dorm A" }, { questionId: "q2", value: "Vegetarian" }] },
  { orderId: "o1", firstName: "Sam", lastName: "Lee", ticketTypeName: "Full Weekend — Minor", status: "complete", additionalFields: [{ questionId: "q1", value: "Dorm A" }] },
  { orderId: "o2", firstName: "Bo", lastName: "Ng", ticketTypeName: "Local / Commuter", status: "cancelled", additionalFields: [] },
];
const questions = [{ _id: "q1", question: "Where will you stay?" }, { _id: "q2", question: "Meal preference" }];

describe("computeEventStats", () => {
  it("counts live tickets, revenue, and donations", () => {
    const s = computeEventStats(orders, tickets);
    assert.equal(s.registrations, 2); // cancelled excluded
    assert.equal(s.revenue, 850);
    assert.equal(s.donationTotal, 170);
    assert.equal(s.donationCount, 1);
    assert.deepEqual(s.byTicketType, { "Full Weekend — Adult": 1, "Full Weekend — Minor": 1 });
  });
  it("empty input → zeros", () => {
    assert.deepEqual(computeEventStats([], []), { registrations: 0, orders: 0, revenue: 0, donationTotal: 0, donationCount: 0, byTicketType: {} });
  });
});

describe("buildRegistrantRows", () => {
  it("maps attendees with email (from order) + labeled answers, excludes cancelled", () => {
    const rows = buildRegistrantRows(tickets, orders, questions);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].name, "Amy Lee");
    assert.equal(rows[0].email, "a@x.com");
    assert.equal(rows[0].checkedIn, true);
    assert.deepEqual(rows[0].answers, [{ label: "Where will you stay?", value: "Dorm A" }, { label: "Meal preference", value: "Vegetarian" }]);
  });
  it("questionLabels maps id → label", () => {
    assert.equal(questionLabels(questions).get("q1"), "Where will you stay?");
  });
});
