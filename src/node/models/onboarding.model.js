import mongoose from "mongoose";

const onboardingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    tourCompleted: {
      type: Boolean,
      default: false,
    },
    tourSteps: {
      dashboard: { type: Boolean, default: false },
      events: { type: Boolean, default: false },
      clients: { type: Boolean, default: false },
      vendors: { type: Boolean, default: false },
      budget: { type: Boolean, default: false },
      tasks: { type: Boolean, default: false },
      calendar: { type: Boolean, default: false },
    },
    tourSkipped: {
      type: Boolean,
      default: false,
    },
    tourCompletedAt: {
      type: Date,
    },
    tutorialCompleted: {
      type: Boolean,
      default: false,
    },
    tutorialSteps: {
      createEvent: { type: Boolean, default: false },
      addClient: { type: Boolean, default: false },
      addTask: { type: Boolean, default: false },
      addGuest: { type: Boolean, default: false },
      setBudget: { type: Boolean, default: false },
    },
    tutorialCompletedAt: {
      type: Date,
    },
    sampleDataLoaded: {
      type: Boolean,
      default: false,
    },
    sampleDataLoadedAt: {
      type: Date,
    },
    helpArticlesViewed: [
      {
        articleId: String,
        viewedAt: Date,
      },
    ],
    keyboardShortcutsViewed: {
      type: Boolean,
      default: false,
    },
    whatsNewViewed: [
      {
        version: String,
        viewedAt: Date,
      },
    ],
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
onboardingSchema.index({ user: 1 });
onboardingSchema.index({ tourCompleted: 1 });
onboardingSchema.index({ tutorialCompleted: 1 });

// Methods
onboardingSchema.methods.markTourStepComplete = function (step) {
  if (this.tourSteps[step] !== undefined) {
    this.tourSteps[step] = true;
  }

  // Check if all steps are complete
  const allStepsComplete = Object.values(this.tourSteps).every(
    (step) => step === true
  );
  if (allStepsComplete && !this.tourCompleted) {
    this.tourCompleted = true;
    this.tourCompletedAt = new Date();
  }

  return this.save();
};

onboardingSchema.methods.markTutorialStepComplete = function (step) {
  if (this.tutorialSteps[step] !== undefined) {
    this.tutorialSteps[step] = true;
  }

  // Check if all steps are complete
  const allStepsComplete = Object.values(this.tutorialSteps).every(
    (step) => step === true
  );
  if (allStepsComplete && !this.tutorialCompleted) {
    this.tutorialCompleted = true;
    this.tutorialCompletedAt = new Date();
  }

  return this.save();
};

onboardingSchema.methods.skipTour = function () {
  this.tourSkipped = true;
  this.tourCompleted = true;
  this.tourCompletedAt = new Date();
  return this.save();
};

onboardingSchema.methods.resetTour = function () {
  this.tourCompleted = false;
  this.tourSkipped = false;
  this.tourCompletedAt = null;
  Object.keys(this.tourSteps).forEach((key) => {
    this.tourSteps[key] = false;
  });
  return this.save();
};

onboardingSchema.methods.getProgress = function () {
  const tourStepsCompleted = Object.values(this.tourSteps).filter(
    (step) => step === true
  ).length;
  const tourStepsTotal = Object.keys(this.tourSteps).length;
  const tourProgress = (tourStepsCompleted / tourStepsTotal) * 100;

  const tutorialStepsCompleted = Object.values(this.tutorialSteps).filter(
    (step) => step === true
  ).length;
  const tutorialStepsTotal = Object.keys(this.tutorialSteps).length;
  const tutorialProgress = (tutorialStepsCompleted / tutorialStepsTotal) * 100;

  return {
    tour: {
      completed: this.tourCompleted,
      skipped: this.tourSkipped,
      progress: Math.round(tourProgress),
      stepsCompleted: tourStepsCompleted,
      stepsTotal: tourStepsTotal,
    },
    tutorial: {
      completed: this.tutorialCompleted,
      progress: Math.round(tutorialProgress),
      stepsCompleted: tutorialStepsCompleted,
      stepsTotal: tutorialStepsTotal,
    },
    sampleDataLoaded: this.sampleDataLoaded,
  };
};

const Onboarding = mongoose.model("Onboarding", onboardingSchema);

export default Onboarding;
