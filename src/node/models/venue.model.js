import mongoose from "mongoose";

/**
 * Venue plan (roadmap Phase 9): spaces (halls) per venue, and reservations on them —
 * timed holds, bookings and blocked dates. Double booking is prevented by
 * VenueSlotLock: one document per space, day and half-day, with a unique index,
 * so two reservations can never hold the same slot even when requests race.
 */

const spaceSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    capacity: {
      seated: { type: Number, min: 0 },
      standing: { type: Number, min: 0 },
    },
    pricePerDay: { type: Number, min: 0 }, // naira, a guide for quotes
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const RESERVATION_ACTIVE = ["held", "booked", "blocked"];

const reservationSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
    space: { type: mongoose.Schema.Types.ObjectId, ref: "VenueSpace", required: true, index: true },
    status: {
      type: String,
      enum: ["held", "booked", "blocked", "released", "expired", "cancelled"],
      required: true,
      index: true,
    },
    // Days as the venue writes them (local dates), inclusive
    dateFrom: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    dateTo: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    session: { type: String, enum: ["full", "morning", "evening"], default: "full" },
    title: { type: String, trim: true, maxlength: 200 }, // "Adeyemi wedding reception"
    clientName: { type: String, trim: true, maxlength: 200 },
    clientEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
    clientPhone: { type: String, trim: true, maxlength: 40 },
    guestCount: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 2000 },
    // Holds
    holdExpiresAt: { type: Date, index: true },
    holdReminderSentAt: Date,
    // Bookings
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "VendorBooking", index: true },
    bookedAt: Date,
    endedAt: Date, // released, expired or cancelled
    history: [
      {
        action: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

reservationSchema.index({ vendor: 1, dateFrom: 1, dateTo: 1 });
reservationSchema.index({ status: 1, holdExpiresAt: 1 });

const lockSchema = new mongoose.Schema({
  space: { type: mongoose.Schema.Types.ObjectId, required: true },
  date: { type: String, required: true },
  half: { type: String, enum: ["am", "pm"], required: true },
  reservation: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
});
lockSchema.index({ space: 1, date: 1, half: 1 }, { unique: true });

export const VenueSpace = mongoose.model("VenueSpace", spaceSchema);
export const VenueReservation = mongoose.model("VenueReservation", reservationSchema);
export const VenueSlotLock = mongoose.model("VenueSlotLock", lockSchema);
