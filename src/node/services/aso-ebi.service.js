import mongoose from "mongoose";
import { AsoEbiFabric, AsoEbiOrder, ASO_EBI_SIZES } from "../models/aso-ebi.model.js";
import Guest from "../models/guest.model.js";
import { AppError } from "../utils/AppError.js";
import { findOwnedEvent } from "../utils/event-access.js";

/**
 * Aso-ebi tracking (Celebration Plus, roadmap Phase 8): fabrics on offer, each
 * person's order with size, what they've paid and whether they've collected.
 * Amounts are in naira.
 */

const MAX_FABRICS = 30;
const MAX_ORDERS = 3000;
const UNITS = ["yard", "piece", "set", "bundle"];
const METHODS = ["cash", "transfer", "pos", "other"];
const COLLECTION = ["pending", "ready", "collected"];
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const money = (v, label = "amount") => {
  const n = Number(v);
  if (v === "" || v === null || !Number.isFinite(n) || n < 0) throw new AppError(`Enter a valid ${label}`, 400);
  return Math.round(n * 100) / 100;
};
const quantity = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 1000) throw new AppError("Quantity should be 1 to 1000", 400);
  return n;
};
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheets running it as a formula
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const shapeOrder = (o) => {
  const doc = o.toObject ? o.toObject({ virtuals: true }) : o;
  const balance = Math.max((doc.amountDue || 0) - (doc.amountPaid || 0), 0);
  return {
    ...doc,
    balance,
    paymentStatus: (doc.amountPaid || 0) <= 0 ? (doc.amountDue > 0 ? "unpaid" : "paid") : balance === 0 ? "paid" : "partial",
  };
};

class AsoEbiService {
  /** Fabrics, orders and totals */
  async overview(user, eventId, { fabric, payment, collection, q } = {}) {
    const event = await findOwnedEvent(eventId, user);
    const [fabrics, allOrders] = await Promise.all([
      AsoEbiFabric.find({ event: event._id }).sort({ createdAt: 1 }).lean(),
      AsoEbiOrder.find({ event: event._id }).sort({ createdAt: -1 }).lean(),
    ]);
    const all = allOrders.map(shapeOrder);
    let orders = all;
    if (fabric && mongoose.isValidObjectId(fabric)) orders = orders.filter((o) => String(o.fabric) === String(fabric));
    if (["unpaid", "partial", "paid"].includes(payment)) orders = orders.filter((o) => o.paymentStatus === payment);
    if (COLLECTION.includes(collection)) orders = orders.filter((o) => o.collectionStatus === collection);
    if (typeof q === "string" && q.trim()) {
      const needle = q.trim().toLowerCase();
      orders = orders.filter((o) => o.name.toLowerCase().includes(needle) || (o.phone || "").includes(needle));
    }

    const byFabric = fabrics.map((f) => {
      const mine = all.filter((o) => String(o.fabric) === String(f._id));
      const ordered = mine.reduce((s, o) => s + o.quantity, 0);
      return {
        ...f,
        ordered,
        remaining: typeof f.stock === "number" ? Math.max(f.stock - ordered, 0) : null,
        orders: mine.length,
        due: mine.reduce((s, o) => s + o.amountDue, 0),
        paid: mine.reduce((s, o) => s + (o.amountPaid || 0), 0),
      };
    });
    const due = all.reduce((s, o) => s + o.amountDue, 0);
    const paid = all.reduce((s, o) => s + (o.amountPaid || 0), 0);
    const count = (key, value) => all.filter((o) => o[key] === value).length;
    return {
      fabrics: byFabric,
      orders,
      summary: {
        orders: all.length,
        due,
        paid,
        outstanding: all.reduce((s, o) => s + o.balance, 0),
        payment: { unpaid: count("paymentStatus", "unpaid"), partial: count("paymentStatus", "partial"), paid: count("paymentStatus", "paid") },
        collection: { pending: count("collectionStatus", "pending"), ready: count("collectionStatus", "ready"), collected: count("collectionStatus", "collected") },
      },
      sizes: ASO_EBI_SIZES,
    };
  }

  fabricInput(body, current) {
    const out = {};
    if (body.name !== undefined || !current) {
      const name = str(body.name, 120);
      if (!name) throw new AppError("Name the fabric", 400);
      out.name = name;
    }
    if (body.price !== undefined || !current) out.price = money(body.price, "price");
    if (body.description !== undefined) out.description = str(body.description, 1000) || undefined;
    if (body.color !== undefined) out.color = str(body.color, 60) || undefined;
    if (body.unit !== undefined) {
      if (!UNITS.includes(body.unit)) throw new AppError("Unknown unit", 400);
      out.unit = body.unit;
    }
    if (body.stock !== undefined) {
      if (body.stock === null || body.stock === "") out.stock = undefined;
      else {
        const n = Number(body.stock);
        if (!Number.isInteger(n) || n < 0) throw new AppError("Stock should be a whole number", 400);
        out.stock = n;
      }
    }
    if (body.active !== undefined) out.active = !!body.active;
    return out;
  }

  async addFabric(user, eventId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    if ((await AsoEbiFabric.countDocuments({ event: event._id })) >= MAX_FABRICS) {
      throw new AppError(`Up to ${MAX_FABRICS} fabrics per event`, 400);
    }
    return AsoEbiFabric.create({ event: event._id, ...this.fabricInput(body) });
  }

  async findFabric(event, fabricId) {
    if (!mongoose.isValidObjectId(fabricId)) throw new AppError("Fabric not found", 404);
    const fabric = await AsoEbiFabric.findOne({ _id: fabricId, event: event._id });
    if (!fabric) throw new AppError("Fabric not found", 404);
    return fabric;
  }

  /** Price changes apply to new orders; existing orders keep what they owe */
  async updateFabric(user, eventId, fabricId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const fabric = await this.findFabric(event, fabricId);
    const changes = this.fabricInput(body, fabric);
    if (typeof changes.stock === "number") {
      const [agg] = await AsoEbiOrder.aggregate([{ $match: { fabric: fabric._id } }, { $group: { _id: null, qty: { $sum: "$quantity" } } }]);
      if ((agg?.qty || 0) > changes.stock) throw new AppError(`${agg.qty} already ordered; stock can't be lower`, 400);
    }
    for (const [key, value] of Object.entries(changes)) fabric.set(key, value);
    await fabric.save();
    return fabric;
  }

  async removeFabric(user, eventId, fabricId) {
    const event = await findOwnedEvent(eventId, user);
    const fabric = await this.findFabric(event, fabricId);
    if (await AsoEbiOrder.exists({ fabric: fabric._id })) {
      throw new AppError("People have ordered this fabric. Stop taking orders for it instead.", 400);
    }
    await fabric.deleteOne();
  }

  async assertStock(fabric, quantityWanted, excludeOrderId) {
    if (typeof fabric.stock !== "number") return;
    const match = { fabric: fabric._id, ...(excludeOrderId ? { _id: { $ne: excludeOrderId } } : {}) };
    const [agg] = await AsoEbiOrder.aggregate([{ $match: match }, { $group: { _id: null, qty: { $sum: "$quantity" } } }]);
    const left = fabric.stock - (agg?.qty || 0);
    if (quantityWanted > left) throw new AppError(`Only ${Math.max(left, 0)} ${fabric.unit}(s) of ${fabric.name} left`, 400);
  }

  orderDetails(body, out = {}) {
    if (body.phone !== undefined) out.phone = str(body.phone, 40) || undefined;
    if (body.size !== undefined) {
      if (body.size && !ASO_EBI_SIZES.includes(body.size)) throw new AppError("Unknown size", 400);
      out.size = body.size || undefined;
    }
    if (body.measurements !== undefined) out.measurements = str(body.measurements, 500) || undefined;
    if (body.notes !== undefined) out.notes = str(body.notes, 1000) || undefined;
    return out;
  }

  /** { fabric, name | guest, phone, quantity, size, measurements, amountDue?, amountPaid?, notes } */
  async addOrder(user, eventId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    if ((await AsoEbiOrder.countDocuments({ event: event._id })) >= MAX_ORDERS) throw new AppError("Order list is full", 400);
    const fabric = await this.findFabric(event, body.fabric);
    if (!fabric.active) throw new AppError(`${fabric.name} isn't taking orders`, 400);
    let guest = null;
    if (body.guest) {
      if (!mongoose.isValidObjectId(body.guest)) throw new AppError("Guest not found", 404);
      guest = await Guest.findOne({ _id: body.guest, event: event._id }).select("name phone").lean();
      if (!guest) throw new AppError("Guest not found", 404);
    }
    const name = str(body.name, 200) || guest?.name;
    if (!name) throw new AppError("Who is the order for?", 400);
    const qty = quantity(body.quantity ?? 1);
    await this.assertStock(fabric, qty);
    const amountDue = body.amountDue !== undefined && body.amountDue !== "" ? money(body.amountDue) : Math.round(fabric.price * qty * 100) / 100;
    const order = new AsoEbiOrder({
      event: event._id,
      fabric: fabric._id,
      guest: guest?._id,
      name,
      quantity: qty,
      amountDue,
      ...this.orderDetails({ phone: guest?.phone, ...body }),
    });
    const paid = body.amountPaid !== undefined && body.amountPaid !== "" ? money(body.amountPaid) : 0;
    if (paid > amountDue) throw new AppError("Paid is more than the amount due", 400);
    if (paid > 0) {
      order.amountPaid = paid;
      order.payments.push({ amount: paid, method: METHODS.includes(body.paymentMethod) ? body.paymentMethod : "transfer" });
    }
    await order.save();
    return shapeOrder(order);
  }

  async findOrder(event, orderId) {
    if (!mongoose.isValidObjectId(orderId)) throw new AppError("Order not found", 404);
    const order = await AsoEbiOrder.findOne({ _id: orderId, event: event._id });
    if (!order) throw new AppError("Order not found", 404);
    return order;
  }

  /** Edit details; quantity or fabric changes re-price unless amountDue is given */
  async updateOrder(user, eventId, orderId, body = {}) {
    const event = await findOwnedEvent(eventId, user);
    const order = await this.findOrder(event, orderId);
    let fabric = null;
    if (body.fabric !== undefined && String(body.fabric) !== String(order.fabric)) {
      fabric = await this.findFabric(event, body.fabric);
      if (!fabric.active) throw new AppError(`${fabric.name} isn't taking orders`, 400);
    }
    const qty = body.quantity !== undefined ? quantity(body.quantity) : order.quantity;
    if (fabric || qty !== order.quantity) {
      const target = fabric || (await AsoEbiFabric.findById(order.fabric));
      if (target) await this.assertStock(target, qty, order._id);
      order.quantity = qty;
      if (fabric) order.fabric = fabric._id;
      if (body.amountDue === undefined && target) order.amountDue = Math.round(target.price * qty * 100) / 100;
    }
    if (body.name !== undefined) {
      const name = str(body.name, 200);
      if (!name) throw new AppError("Who is the order for?", 400);
      order.name = name;
    }
    if (body.amountDue !== undefined) order.amountDue = money(body.amountDue);
    if (order.amountPaid > order.amountDue) throw new AppError(`They've already paid ₦${order.amountPaid.toLocaleString()}`, 400);
    for (const [key, value] of Object.entries(this.orderDetails(body))) order.set(key, value);
    if (body.collectionStatus !== undefined) this.applyCollection(order, body.collectionStatus, body.collectedBy);
    await order.save();
    return shapeOrder(order);
  }

  /** Record money received for an order */
  async recordPayment(user, eventId, orderId, { amount, method, note } = {}) {
    const event = await findOwnedEvent(eventId, user);
    const order = await this.findOrder(event, orderId);
    const value = money(amount);
    if (value <= 0) throw new AppError("Enter the amount received", 400);
    const balance = Math.max(order.amountDue - order.amountPaid, 0);
    if (value > balance) throw new AppError(`Only ₦${balance.toLocaleString()} is outstanding`, 400);
    order.payments.push({ amount: value, method: METHODS.includes(method) ? method : "transfer", note: str(note, 200) });
    order.amountPaid = Math.round((order.amountPaid + value) * 100) / 100;
    await order.save();
    return shapeOrder(order);
  }

  /** Undo a payment recorded by mistake */
  async removePayment(user, eventId, orderId, paymentId) {
    const event = await findOwnedEvent(eventId, user);
    const order = await this.findOrder(event, orderId);
    const payment = order.payments.id(paymentId);
    if (!payment) throw new AppError("Payment not found", 404);
    order.amountPaid = Math.max(Math.round((order.amountPaid - payment.amount) * 100) / 100, 0);
    payment.deleteOne();
    await order.save();
    return shapeOrder(order);
  }

  applyCollection(order, status, collectedBy) {
    if (!COLLECTION.includes(status)) throw new AppError("Unknown collection status", 400);
    order.collectionStatus = status;
    if (status === "collected") {
      order.collectedAt = order.collectedAt || new Date();
      order.collectedBy = str(collectedBy, 200) || order.collectedBy;
    } else {
      order.collectedAt = undefined;
      order.collectedBy = undefined;
    }
  }

  /** Bulk: mark several orders ready or collected */
  async setCollection(user, eventId, { orderIds, status, collectedBy }) {
    const event = await findOwnedEvent(eventId, user);
    const ids = (Array.isArray(orderIds) ? orderIds : [orderIds]).filter((id) => mongoose.isValidObjectId(id));
    if (!ids.length) throw new AppError("Choose at least one order", 400);
    const orders = await AsoEbiOrder.find({ _id: { $in: ids }, event: event._id });
    for (const order of orders) {
      this.applyCollection(order, status, collectedBy);
      await order.save();
    }
    return { updated: orders.length };
  }

  async removeOrder(user, eventId, orderId) {
    const event = await findOwnedEvent(eventId, user);
    const order = await this.findOrder(event, orderId);
    await order.deleteOne();
  }

  /** CSV of every order, for the fabric seller or tailor */
  async ordersCsv(user, eventId) {
    const { fabrics, orders } = await this.overview(user, eventId);
    const fabricName = new Map(fabrics.map((f) => [String(f._id), f.name]));
    const header = ["Name", "Phone", "Fabric", "Quantity", "Size", "Measurements", "Amount due", "Paid", "Balance", "Payment", "Collection", "Notes"];
    const rows = orders.map((o) => [
      o.name, o.phone, fabricName.get(String(o.fabric)) || "", o.quantity, o.size, o.measurements,
      o.amountDue, o.amountPaid || 0, o.balance, o.paymentStatus, o.collectionStatus, o.notes,
    ]);
    return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  }
}

export default new AsoEbiService();
