import mongoose from "mongoose";
import dotenv from "dotenv";
import HelpArticle from "../models/help-article.model.js";
import WhatsNew from "../models/whats-new.model.js";

dotenv.config();

const helpArticles = [
  {
    title: "Getting Started with Event Planning",
    slug: "getting-started-event-planning",
    category: "getting-started",
    excerpt:
      "Learn the basics of using the Event Planner Platform to manage your events successfully.",
    content: `
# Getting Started with Event Planning

Welcome to the Event Planner Platform! This guide will help you get started with planning your first event.

## Creating Your First Event

1. Click on "Create Event" from your dashboard
2. Fill in the basic event details (name, date, location)
3. Add your client information
4. Set your budget
5. Start adding tasks and guests

## Key Features

- **Event Management**: Organize all your events in one place
- **Client Management**: Keep track of all your clients
- **Budget Tracking**: Monitor expenses and stay within budget
- **Task Management**: Never miss a deadline
- **Guest Management**: Track RSVPs and seating arrangements

## Next Steps

- Explore the dashboard to see all features
- Create your first event
- Invite team members if you have a Professional+ plan
- Check out our video tutorials for more guidance
    `,
    tags: ["getting-started", "basics", "tutorial"],
    featured: true,
    published: true,
  },
  {
    title: "How to Create an Event",
    slug: "how-to-create-event",
    category: "events",
    excerpt:
      "Step-by-step guide to creating and managing events on the platform.",
    content: `
# How to Create an Event

Creating an event is simple and straightforward. Follow these steps:

## Step 1: Navigate to Events

Click on "Events" in the sidebar menu, then click the "Create Event" button.

## Step 2: Fill in Event Details

- **Event Name**: Give your event a descriptive name
- **Event Type**: Select from Wedding, Corporate, Birthday, etc.
- **Date & Time**: Set the start and end date/time
- **Location**: Enter the venue address
- **Guest Count**: Estimate the number of guests

## Step 3: Add Client Information

Link the event to an existing client or create a new client profile.

## Step 4: Set Budget

Enter your total budget and allocate funds to different categories.

## Step 5: Add Tasks

Create a task list with deadlines to keep your planning on track.

## Tips

- Use the AI Event Planner for suggestions
- Set up automatic reminders for important tasks
- Share event details with your team
    `,
    tags: ["events", "create", "tutorial"],
    featured: true,
    published: true,
  },
  {
    title: "Managing Your Budget",
    slug: "managing-budget",
    category: "budget",
    excerpt:
      "Learn how to track expenses and stay within budget for your events.",
    content: `
# Managing Your Budget

Effective budget management is crucial for successful event planning.

## Setting Up Your Budget

1. Navigate to your event
2. Click on the "Budget" tab
3. Enter your total budget
4. Allocate funds to categories (venue, catering, decorations, etc.)

## Tracking Expenses

- Add expenses as they occur
- Upload receipts for documentation
- Monitor spending vs. budget in real-time
- Get alerts when approaching budget limits

## Budget Categories

- Venue
- Catering
- Decorations
- Entertainment
- Photography
- Transportation
- Miscellaneous

## Tips for Staying on Budget

- Set aside 10-15% for unexpected costs
- Track all expenses immediately
- Review budget regularly
- Use vendor quotes for accurate estimates
    `,
    tags: ["budget", "expenses", "finance"],
    featured: true,
    published: true,
  },
  {
    title: "Working with Vendors",
    slug: "working-with-vendors",
    category: "vendors",
    excerpt: "Find, compare, and book vendors for your events.",
    content: `
# Working with Vendors

The platform makes it easy to find and work with vendors.

## Finding Vendors

1. Go to the Vendor Directory
2. Use filters to narrow your search
3. Compare vendor profiles, ratings, and prices
4. Save favorites for later

## Booking Vendors

1. Click "Book" on a vendor profile
2. Select your event
3. Specify service requirements
4. Submit booking request
5. Wait for vendor response

## Managing Vendor Relationships

- Track all vendor communications
- Store contracts and agreements
- Monitor payment schedules
- Leave reviews after events

## Vendor Categories

- Venues
- Caterers
- Photographers
- Florists
- Entertainment
- Transportation
- And more!
    `,
    tags: ["vendors", "booking", "directory"],
    published: true,
  },
  {
    title: "Task Management Best Practices",
    slug: "task-management-best-practices",
    category: "tasks",
    excerpt:
      "Organize your event planning tasks effectively to never miss a deadline.",
    content: `
# Task Management Best Practices

Stay organized and on schedule with effective task management.

## Creating Tasks

- Be specific with task descriptions
- Set realistic deadlines
- Assign priority levels
- Add relevant notes and attachments

## Task Organization

- Group tasks by event
- Use categories (venue, catering, etc.)
- Set dependencies between tasks
- Create recurring tasks for regular activities

## Task Priorities

- **High**: Critical tasks with tight deadlines
- **Medium**: Important but not urgent
- **Low**: Nice to have, flexible timing

## Staying on Track

- Review tasks daily
- Set up email reminders
- Use the calendar view
- Mark tasks complete as you go

## Team Collaboration

- Assign tasks to team members
- Add comments for communication
- Track task completion rates
- Hold regular check-ins
    `,
    tags: ["tasks", "organization", "productivity"],
    published: true,
  },
  {
    title: "Guest List Management",
    slug: "guest-list-management",
    category: "guests",
    excerpt:
      "Manage your guest list, track RSVPs, and create seating arrangements.",
    content: `
# Guest List Management

Keep track of all your guests and their details.

## Adding Guests

- Add guests individually
- Import from CSV/Excel
- Include dietary restrictions
- Track plus-ones

## RSVP Tracking

- Send digital invitations
- Track response status
- Set RSVP deadlines
- Send reminders to non-responders

## Seating Arrangements

- Create table layouts
- Assign guests to tables
- Consider relationships and preferences
- Export seating charts

## Guest Categories

- VIP
- Family
- Friends
- Colleagues
- Plus-ones

## Communication

- Send group messages
- Share event updates
- Collect dietary preferences
- Manage special requests
    `,
    tags: ["guests", "rsvp", "seating"],
    published: true,
  },
];

const whatsNewReleases = [
  {
    version: "2.0.0",
    title: "Major Platform Update - Enhanced Features",
    description:
      "We've released a major update with new features and improvements across the platform.",
    features: [
      {
        title: "AI Event Planner",
        description: "Get intelligent event planning suggestions powered by AI",
        icon: "sparkles",
        category: "new",
      },
      {
        title: "Advanced Search",
        description: "Search across all your events, clients, tasks, and more",
        icon: "search",
        category: "new",
      },
      {
        title: "Team Collaboration",
        description: "Invite team members and collaborate on events",
        icon: "users",
        category: "new",
      },
      {
        title: "Performance Improvements",
        description: "Faster page loads and smoother interactions",
        icon: "zap",
        category: "improvement",
      },
      {
        title: "Mobile Optimization",
        description: "Better experience on mobile devices",
        icon: "smartphone",
        category: "improvement",
      },
    ],
    releaseDate: new Date("2024-11-01"),
    published: true,
    featured: true,
  },
  {
    version: "1.5.0",
    title: "Calendar Integration & Notifications",
    description: "Sync with Google Calendar and get real-time notifications.",
    features: [
      {
        title: "Calendar Sync",
        description: "Sync events with Google Calendar and Outlook",
        icon: "calendar",
        category: "new",
      },
      {
        title: "Push Notifications",
        description: "Get instant notifications for important updates",
        icon: "bell",
        category: "new",
      },
      {
        title: "Email Notifications",
        description: "Customizable email alerts for tasks and deadlines",
        icon: "mail",
        category: "improvement",
      },
    ],
    releaseDate: new Date("2024-10-15"),
    published: true,
  },
  {
    version: "1.4.0",
    title: "Budget Management Enhancements",
    description:
      "New features for better budget tracking and expense management.",
    features: [
      {
        title: "Expense Categories",
        description: "Organize expenses by custom categories",
        icon: "folder",
        category: "new",
      },
      {
        title: "Budget Alerts",
        description: "Get notified when approaching budget limits",
        icon: "alert-triangle",
        category: "new",
      },
      {
        title: "Receipt Upload",
        description: "Attach receipts to expenses for better tracking",
        icon: "paperclip",
        category: "improvement",
      },
      {
        title: "Budget Reports",
        description: "Generate detailed budget reports",
        icon: "bar-chart",
        category: "new",
      },
    ],
    releaseDate: new Date("2024-10-01"),
    published: true,
  },
];

async function seedHelpContent() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Clear existing data
    await HelpArticle.deleteMany({});
    await WhatsNew.deleteMany({});
    console.log("Cleared existing help content");

    // Insert help articles
    const insertedArticles = await HelpArticle.insertMany(helpArticles);
    console.log(`Inserted ${insertedArticles.length} help articles`);

    // Insert what's new releases
    const insertedReleases = await WhatsNew.insertMany(whatsNewReleases);
    console.log(`Inserted ${insertedReleases.length} what's new releases`);

    console.log("Help content seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding help content:", error);
    process.exit(1);
  }
}

// Run the seed function
seedHelpContent();
