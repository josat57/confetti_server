import mongoose from "mongoose";

/**
 * Day-of schedule and vendor run sheet for an event (Celebration Plus, roadmap Phase 8).
 * Times are kept as the organiser typed them ("YYYY-MM-DD" + "HH:MM", local to the event)
 * so they read the same in the app, the PDF and the vendor links whatever the server's timezone.
 */
const itemSchema = new mongoose.Schema({
  day: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // optional: for events over several days
  start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  end: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  location: { type: String, trim: true, maxlength: 200 },
  // Who is responsible: one of the sheet's vendors, or nobody (a moment for everyone)
  vendorKey: { type: mongoose.Schema.Types.ObjectId },
  // Show this item on every vendor's link (e.g. "Couple arrives", "Hall must be cleared")
  forAllVendors: { type: Boolean, default: false },
  notes: { type: String, trim: true, maxlength: 1000 },
});

const vendorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }, // when booked through Confetti
  role: { type: String, trim: true, maxlength: 80 }, // "Caterer", "DJ"
  contactName: { type: String, trim: true, maxlength: 120 },
  contactPhone: { type: String, trim: true, maxlength: 40 },
  contactEmail: { type: String, trim: true, lowercase: true, maxlength: 160 },
  arrivalTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  // Read-only link for this vendor; null when the organiser hasn't shared it (or revoked it)
  shareToken: String,
  sharedAt: Date,
  lastViewedAt: Date,
});

const runSheetSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, unique: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Who vendors call on the day
    dayOfContact: {
      name: { type: String, trim: true, maxlength: 120 },
      phone: { type: String, trim: true, maxlength: 40 },
    },
    notes: { type: String, trim: true, maxlength: 4000 }, // general notes for all vendors
    vendors: [vendorSchema],
    items: [itemSchema],
  },
  { timestamps: true }
);

runSheetSchema.index({ "vendors.shareToken": 1 });

const RunSheet = mongoose.model("RunSheet", runSheetSchema);
export default RunSheet;
