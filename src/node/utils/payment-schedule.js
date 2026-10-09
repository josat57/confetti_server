/**
 * Deposit and balance schedule for a VendorBooking (roadmap Phase 9).
 * Money received (booking.payments) is applied to the instalments in due-date
 * order, so the schedule always reflects what has actually been paid.
 * Without an explicit schedule, one is derived from depositAmount/depositDueDate
 * and the balance due on the event date.
 */

const DAY = 86400000;
export const DUE_SOON_DAYS = 3;

const totalOf = (b) => b.totalAmount ?? b.payment?.totalAmount ?? b.quote?.amount ?? 0;
const paidOf = (b) => (b.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0) || b.payment?.paidAmount || 0;

/** The instalments to track: the explicit schedule, or deposit + balance */
export const instalmentsFor = (b) => {
  if (b.paymentSchedule?.length) {
    return [...b.paymentSchedule]
      .map((i) => ({ _id: i._id, label: i.label || "Instalment", amount: i.amount, dueDate: i.dueDate, reminders: i.reminders || [], explicit: true }))
      .sort((a, b2) => new Date(a.dueDate) - new Date(b2.dueDate));
  }
  const total = totalOf(b);
  const deposit = b.depositAmount || 0;
  const items = [];
  if (deposit > 0) items.push({ label: "Deposit", amount: deposit, dueDate: b.depositDueDate || null, reminders: [] });
  if (total > deposit) items.push({ label: deposit > 0 ? "Balance" : "Full payment", amount: total - deposit, dueDate: b.eventDate || null, reminders: [] });
  return items;
};

/** Each instalment with what's paid against it and its state */
export const scheduleView = (b, now = new Date()) => {
  let remaining = paidOf(b);
  const items = instalmentsFor(b).map((i) => {
    const paid = Math.min(remaining, i.amount);
    remaining = Math.max(remaining - paid, 0);
    const due = i.dueDate ? new Date(i.dueDate) : null;
    const outstanding = Math.max(i.amount - paid, 0);
    let status = "upcoming";
    if (outstanding === 0) status = "paid";
    else if (due && due < now) status = "overdue";
    else if (due && due - now <= DUE_SOON_DAYS * DAY) status = "due_soon";
    else if (paid > 0) status = "partial";
    return { _id: i._id, label: i.label, amount: i.amount, dueDate: i.dueDate, paid, outstanding, status, explicit: !!i.explicit };
  });
  const total = totalOf(b);
  const paid = paidOf(b);
  const next = items.find((i) => i.outstanding > 0) || null;
  return {
    items,
    total,
    paid,
    balance: Math.max(total - paid, 0),
    nextDue: next ? { label: next.label, amount: next.outstanding, dueDate: next.dueDate, status: next.status } : null,
    overdue: items.filter((i) => i.status === "overdue").reduce((s, i) => s + i.outstanding, 0),
  };
};
