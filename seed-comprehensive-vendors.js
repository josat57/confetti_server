import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./src/node/models/user.model.js";
import Vendor from "./src/node/models/vendor.model.js";
import dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected for vendor seeding");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Comprehensive vendor data organized by category
const vendorCategories = {
  venue: [
    {
      name: "Grand Ballroom Lagos",
      businessName: "Grand Ballroom Events Center",
      email: "info@grandballroomlagos.com",
      phone: "+234-801-234-5678",
      tagline: "Elegant venues for unforgettable celebrations",
      description:
        "Premier event venue in Victoria Island with stunning waterfront views, accommodating 50-500 guests. Features include in-house catering, AV equipment, and professional event coordination.",
      address: {
        street: "15 Tiamiyu Savage Street",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "101241",
      },
      location: { coordinates: [3.4273, 6.4281] },
      capacity: 500,
      averagePrice: 250000,
      priceRange: { min: 150000, max: 400000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Hall Rental (8 hours)",
          price: { amount: 200000, currency: "NGN" },
        },
        { name: "Setup & Cleanup", price: { amount: 50000, currency: "NGN" } },
        {
          name: "Security Deposit",
          price: { amount: 100000, currency: "NGN" },
        },
      ],
      features: [
        "Air Conditioning",
        "Parking",
        "Kitchen",
        "Sound System",
        "Lighting",
      ],
      rating: 4.5,
      reviewCount: 127,
    },
    {
      name: "Emerald Gardens",
      businessName: "Emerald Gardens Event Center",
      email: "bookings@emeraldgardens.ng",
      phone: "+234-802-345-6789",
      tagline: "Beautiful outdoor and indoor event spaces",
      description:
        "Versatile event center with lush gardens and modern indoor facilities. Perfect for weddings, corporate events, and social gatherings. Capacity for 100-300 guests.",
      address: {
        street: "Plot 45, Admiralty Way",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "101241",
      },
      location: { coordinates: [3.4195, 6.4474] },
      capacity: 300,
      averagePrice: 180000,
      priceRange: { min: 120000, max: 250000 },
      eventTypes: ["wedding", "birthday", "corporate"],
      services: [
        {
          name: "Garden Venue (6 hours)",
          price: { amount: 150000, currency: "NGN" },
        },
        {
          name: "Indoor Hall (6 hours)",
          price: { amount: 120000, currency: "NGN" },
        },
        { name: "Decoration Setup", price: { amount: 30000, currency: "NGN" } },
      ],
      features: [
        "Garden Setting",
        "Indoor Backup",
        "Bridal Suite",
        "Parking",
        "Catering Kitchen",
      ],
      rating: 4.3,
      reviewCount: 89,
    },
    {
      name: "Royal Palace Events",
      businessName: "Royal Palace Event Center",
      email: "events@royalpalace.ng",
      phone: "+234-803-456-7890",
      tagline: "Luxury venues fit for royalty",
      description:
        "Luxurious event center with opulent decor and world-class amenities. Specializing in high-end weddings and corporate events. Capacity for 200-800 guests.",
      address: {
        street: "12 Bourdillon Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "106104",
      },
      location: { coordinates: [3.4536, 6.4474] },
      capacity: 800,
      averagePrice: 500000,
      priceRange: { min: 300000, max: 800000 },
      eventTypes: ["wedding", "corporate"],
      services: [
        {
          name: "Grand Hall (10 hours)",
          price: { amount: 450000, currency: "NGN" },
        },
        { name: "VIP Lounge", price: { amount: 100000, currency: "NGN" } },
        {
          name: "Red Carpet Service",
          price: { amount: 50000, currency: "NGN" },
        },
      ],
      features: [
        "Luxury Decor",
        "VIP Areas",
        "Valet Parking",
        "Premium Sound",
        "Chandelier Lighting",
      ],
      rating: 4.8,
      reviewCount: 156,
    },
  ],

  catering: [
    {
      name: "Delicious Delights Catering",
      businessName: "Delicious Delights Ltd",
      email: "orders@deliciousdelights.ng",
      phone: "+234-804-567-8901",
      tagline: "Exquisite cuisine for every occasion",
      description:
        "Premium catering service specializing in Nigerian and continental cuisine. From intimate gatherings to large celebrations, we deliver exceptional culinary experiences.",
      address: {
        street: "23 Allen Avenue",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "101233",
      },
      location: { coordinates: [3.3792, 6.5244] },
      capacity: 1000,
      averagePrice: 3500,
      priceRange: { min: 2000, max: 8000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Nigerian Buffet (per person)",
          price: { amount: 3000, currency: "NGN" },
        },
        {
          name: "Continental Menu (per person)",
          price: { amount: 4500, currency: "NGN" },
        },
        {
          name: "Premium Package (per person)",
          price: { amount: 6500, currency: "NGN" },
        },
        {
          name: "Service Staff (per person)",
          price: { amount: 15000, currency: "NGN" },
        },
      ],
      features: [
        "Halal Options",
        "Vegetarian Menu",
        "Live Cooking",
        "Professional Staff",
      ],
      rating: 4.6,
      reviewCount: 203,
    },
    {
      name: "Mama's Kitchen Catering",
      businessName: "Mama's Kitchen Services",
      email: "info@mamaskitchen.ng",
      phone: "+234-805-678-9012",
      tagline: "Authentic Nigerian flavors with love",
      description:
        "Traditional Nigerian catering with authentic recipes passed down through generations. Specializing in cultural events and traditional ceremonies.",
      address: {
        street: "67 Opebi Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100218",
      },
      location: { coordinates: [3.3517, 6.5244] },
      capacity: 500,
      averagePrice: 2500,
      priceRange: { min: 1500, max: 4000 },
      eventTypes: ["wedding", "birthday"],
      services: [
        {
          name: "Traditional Nigerian (per person)",
          price: { amount: 2200, currency: "NGN" },
        },
        {
          name: "Jollof Rice Special (per person)",
          price: { amount: 1800, currency: "NGN" },
        },
        {
          name: "Small Chops Platter",
          price: { amount: 25000, currency: "NGN" },
        },
      ],
      features: [
        "Traditional Recipes",
        "Cultural Presentation",
        "Affordable Pricing",
        "Family Style",
      ],
      rating: 4.4,
      reviewCount: 145,
    },
    {
      name: "Elite Culinary Services",
      businessName: "Elite Culinary Ltd",
      email: "bookings@eliteculinary.ng",
      phone: "+234-806-789-0123",
      tagline: "Gourmet experiences for discerning palates",
      description:
        "High-end catering service offering international cuisine and innovative presentations. Perfect for luxury weddings, corporate galas, and exclusive events.",
      address: {
        street: "5 Banana Island Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "106104",
      },
      location: { coordinates: [3.4536, 6.4474] },
      capacity: 300,
      averagePrice: 8000,
      priceRange: { min: 5000, max: 15000 },
      eventTypes: ["wedding", "corporate"],
      services: [
        {
          name: "Gourmet Plated Dinner (per person)",
          price: { amount: 8500, currency: "NGN" },
        },
        {
          name: "Cocktail Reception (per person)",
          price: { amount: 6000, currency: "NGN" },
        },
        {
          name: "Wine Pairing Service",
          price: { amount: 150000, currency: "NGN" },
        },
      ],
      features: [
        "Gourmet Cuisine",
        "Wine Service",
        "Elegant Presentation",
        "Celebrity Chef",
      ],
      rating: 4.9,
      reviewCount: 78,
    },
  ],

  photography: [
    {
      name: "Moments Photography Studio",
      businessName: "Moments Photography Ltd",
      email: "hello@momentsphotography.ng",
      phone: "+234-807-890-1234",
      tagline: "Capturing your precious moments beautifully",
      description:
        "Professional wedding and event photography with a creative eye for detail. Specializing in candid moments and artistic compositions that tell your unique story.",
      address: {
        street: "18 Fola Osibo Street",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "106104",
      },
      location: { coordinates: [3.4536, 6.4474] },
      capacity: 1,
      averagePrice: 150000,
      priceRange: { min: 80000, max: 300000 },
      eventTypes: ["wedding", "birthday", "corporate"],
      services: [
        {
          name: "Wedding Photography (8 hours)",
          price: { amount: 180000, currency: "NGN" },
        },
        {
          name: "Event Photography (4 hours)",
          price: { amount: 100000, currency: "NGN" },
        },
        {
          name: "Photo Editing & Album",
          price: { amount: 50000, currency: "NGN" },
        },
        { name: "Engagement Shoot", price: { amount: 75000, currency: "NGN" } },
      ],
      features: [
        "Professional Equipment",
        "Same Day Preview",
        "Online Gallery",
        "Print Services",
      ],
      rating: 4.7,
      reviewCount: 167,
    },
    {
      name: "Lens Masters Photography",
      businessName: "Lens Masters Studio",
      email: "info@lensmasters.ng",
      phone: "+234-808-901-2345",
      tagline: "Masters of light and emotion",
      description:
        "Award-winning photography studio with expertise in luxury weddings and high-profile events. Known for dramatic lighting and cinematic style photography.",
      address: {
        street: "25 Admiralty Way",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "101241",
      },
      location: { coordinates: [3.4195, 6.4474] },
      capacity: 1,
      averagePrice: 250000,
      priceRange: { min: 150000, max: 500000 },
      eventTypes: ["wedding", "corporate"],
      services: [
        {
          name: "Premium Wedding Package",
          price: { amount: 300000, currency: "NGN" },
        },
        {
          name: "Corporate Event Coverage",
          price: { amount: 200000, currency: "NGN" },
        },
        {
          name: "Drone Photography",
          price: { amount: 100000, currency: "NGN" },
        },
      ],
      features: [
        "Award Winning",
        "Drone Services",
        "Luxury Albums",
        "International Style",
      ],
      rating: 4.9,
      reviewCount: 89,
    },
  ],

  videography: [
    {
      name: "Cinematic Visions",
      businessName: "Cinematic Visions Productions",
      email: "productions@cinematicvisions.ng",
      phone: "+234-809-012-3456",
      tagline: "Your story, cinematically told",
      description:
        "Professional videography service creating cinematic wedding films and event documentaries. Using state-of-the-art equipment to capture your special moments in stunning detail.",
      address: {
        street: "12 Ozumba Mbadiwe",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "101241",
      },
      location: { coordinates: [3.4273, 6.4281] },
      capacity: 1,
      averagePrice: 200000,
      priceRange: { min: 120000, max: 400000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Wedding Videography (Full Day)",
          price: { amount: 250000, currency: "NGN" },
        },
        {
          name: "Event Highlight Reel",
          price: { amount: 150000, currency: "NGN" },
        },
        {
          name: "Live Streaming Service",
          price: { amount: 100000, currency: "NGN" },
        },
      ],
      features: [
        "4K Recording",
        "Drone Footage",
        "Same Day Edit",
        "Live Streaming",
      ],
      rating: 4.6,
      reviewCount: 134,
    },
  ],

  entertainment: [
    {
      name: "Rhythm & Beats Entertainment",
      businessName: "Rhythm & Beats Ltd",
      email: "bookings@rhythmbeats.ng",
      phone: "+234-810-123-4567",
      tagline: "Setting the perfect mood for your celebration",
      description:
        "Professional DJ and live music services for all types of events. From intimate acoustic sets to high-energy dance parties, we provide the perfect soundtrack for your celebration.",
      address: {
        street: "34 Awolowo Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "106104",
      },
      location: { coordinates: [3.4536, 6.4474] },
      capacity: 1000,
      averagePrice: 80000,
      priceRange: { min: 50000, max: 200000 },
      eventTypes: ["wedding", "birthday", "corporate"],
      services: [
        {
          name: "DJ Service (6 hours)",
          price: { amount: 75000, currency: "NGN" },
        },
        {
          name: "Live Band Performance",
          price: { amount: 150000, currency: "NGN" },
        },
        {
          name: "Sound System Rental",
          price: { amount: 40000, currency: "NGN" },
        },
      ],
      features: [
        "Professional DJ",
        "Live Musicians",
        "Sound Equipment",
        "Lighting Effects",
      ],
      rating: 4.5,
      reviewCount: 198,
    },
    {
      name: "Lagos Live Band",
      businessName: "Lagos Live Entertainment",
      email: "info@lagosliveband.ng",
      phone: "+234-811-234-5678",
      tagline: "Live music that moves your soul",
      description:
        "Professional live band specializing in Afrobeats, Jazz, and contemporary music. Perfect for weddings, corporate events, and cultural celebrations.",
      address: {
        street: "56 Herbert Macaulay Way",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "101212",
      },
      location: { coordinates: [3.3792, 6.5244] },
      capacity: 500,
      averagePrice: 200000,
      priceRange: { min: 120000, max: 350000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Full Band Performance (4 hours)",
          price: { amount: 220000, currency: "NGN" },
        },
        {
          name: "Acoustic Duo (2 hours)",
          price: { amount: 80000, currency: "NGN" },
        },
        {
          name: "Cultural Drummers",
          price: { amount: 60000, currency: "NGN" },
        },
      ],
      features: [
        "Live Band",
        "Cultural Music",
        "Professional Musicians",
        "Custom Playlist",
      ],
      rating: 4.7,
      reviewCount: 112,
    },
  ],

  decoration: [
    {
      name: "Elegant Decor Solutions",
      businessName: "Elegant Decor Ltd",
      email: "design@elegantdecor.ng",
      phone: "+234-812-345-6789",
      tagline: "Transforming spaces into magical experiences",
      description:
        "Full-service event decoration company specializing in luxury weddings and corporate events. From concept to execution, we create stunning visual experiences.",
      address: {
        street: "78 Ogudu Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100218",
      },
      location: { coordinates: [3.3517, 6.5244] },
      capacity: 1000,
      averagePrice: 150000,
      priceRange: { min: 80000, max: 400000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Wedding Decoration Package",
          price: { amount: 200000, currency: "NGN" },
        },
        {
          name: "Corporate Event Setup",
          price: { amount: 120000, currency: "NGN" },
        },
        {
          name: "Floral Arrangements",
          price: { amount: 80000, currency: "NGN" },
        },
        { name: "Lighting Design", price: { amount: 100000, currency: "NGN" } },
      ],
      features: [
        "Custom Designs",
        "Floral Arrangements",
        "Lighting",
        "Luxury Linens",
      ],
      rating: 4.6,
      reviewCount: 156,
    },
  ],

  transportation: [
    {
      name: "Luxury Ride Services",
      businessName: "Luxury Ride Ltd",
      email: "bookings@luxuryride.ng",
      phone: "+234-813-456-7890",
      tagline: "Arrive in style and comfort",
      description:
        "Premium transportation services for weddings and special events. Fleet includes luxury cars, limousines, and party buses for groups of all sizes.",
      address: {
        street: "45 Adeola Odeku Street",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "106104",
      },
      location: { coordinates: [3.4536, 6.4474] },
      capacity: 50,
      averagePrice: 25000,
      priceRange: { min: 15000, max: 80000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Luxury Car (4 hours)",
          price: { amount: 30000, currency: "NGN" },
        },
        {
          name: "Limousine Service",
          price: { amount: 60000, currency: "NGN" },
        },
        {
          name: "Party Bus (8 hours)",
          price: { amount: 80000, currency: "NGN" },
        },
      ],
      features: [
        "Luxury Vehicles",
        "Professional Drivers",
        "Decorated Cars",
        "Group Transport",
      ],
      rating: 4.4,
      reviewCount: 87,
    },
  ],

  security: [
    {
      name: "Elite Security Services",
      businessName: "Elite Security Ltd",
      email: "operations@elitesecurity.ng",
      phone: "+234-814-567-8901",
      tagline: "Professional security for peace of mind",
      description:
        "Experienced security personnel for events of all sizes. Trained professionals ensuring the safety and security of your guests and venue.",
      address: {
        street: "23 Ikorodu Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100001",
      },
      location: { coordinates: [3.3792, 6.5244] },
      capacity: 1000,
      averagePrice: 15000,
      priceRange: { min: 10000, max: 30000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Security Guard (per person/day)",
          price: { amount: 12000, currency: "NGN" },
        },
        {
          name: "VIP Protection Service",
          price: { amount: 25000, currency: "NGN" },
        },
        {
          name: "Crowd Control Team",
          price: { amount: 50000, currency: "NGN" },
        },
      ],
      features: [
        "Trained Personnel",
        "Crowd Control",
        "VIP Protection",
        "Emergency Response",
      ],
      rating: 4.3,
      reviewCount: 67,
    },
  ],

  audio_visual: [
    {
      name: "Pro AV Solutions",
      businessName: "Pro AV Solutions Ltd",
      email: "tech@proavsolutions.ng",
      phone: "+234-815-678-9012",
      tagline: "Crystal clear sound and stunning visuals",
      description:
        "Professional audio-visual equipment rental and technical support for events. From sound systems to LED screens, we provide complete AV solutions.",
      address: {
        street: "67 Agege Motor Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100001",
      },
      location: { coordinates: [3.3517, 6.5244] },
      capacity: 2000,
      averagePrice: 75000,
      priceRange: { min: 40000, max: 200000 },
      eventTypes: ["corporate", "wedding", "birthday"],
      services: [
        {
          name: "Sound System Package",
          price: { amount: 60000, currency: "NGN" },
        },
        {
          name: "LED Screen Rental",
          price: { amount: 80000, currency: "NGN" },
        },
        { name: "Lighting Package", price: { amount: 50000, currency: "NGN" } },
        {
          name: "Technical Support",
          price: { amount: 25000, currency: "NGN" },
        },
      ],
      features: [
        "Professional Equipment",
        "Technical Support",
        "Setup Service",
        "Backup Systems",
      ],
      rating: 4.5,
      reviewCount: 94,
    },
  ],

  cake_desserts: [
    {
      name: "Sweet Dreams Bakery",
      businessName: "Sweet Dreams Ltd",
      email: "orders@sweetdreams.ng",
      phone: "+234-816-789-0123",
      tagline: "Creating sweet memories one cake at a time",
      description:
        "Custom cake design and dessert catering for weddings and special events. Specializing in multi-tier wedding cakes and dessert tables.",
      address: {
        street: "89 Surulere Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100001",
      },
      location: { coordinates: [3.3517, 6.5244] },
      capacity: 500,
      averagePrice: 45000,
      priceRange: { min: 25000, max: 150000 },
      eventTypes: ["wedding", "birthday"],
      services: [
        {
          name: "3-Tier Wedding Cake",
          price: { amount: 80000, currency: "NGN" },
        },
        {
          name: "Birthday Cake (Custom)",
          price: { amount: 35000, currency: "NGN" },
        },
        {
          name: "Dessert Table Setup",
          price: { amount: 60000, currency: "NGN" },
        },
        { name: "Cupcake Tower", price: { amount: 40000, currency: "NGN" } },
      ],
      features: [
        "Custom Designs",
        "Fresh Ingredients",
        "Delivery Service",
        "Dietary Options",
      ],
      rating: 4.8,
      reviewCount: 178,
    },
  ],

  florals: [
    {
      name: "Bloom & Blossom Florals",
      businessName: "Bloom & Blossom Ltd",
      email: "flowers@bloomblossom.ng",
      phone: "+234-817-890-1234",
      tagline: "Fresh flowers for every celebration",
      description:
        "Premium floral design service for weddings and events. From bridal bouquets to venue decorations, we create stunning floral arrangements.",
      address: {
        street: "34 Ikeja Way",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100218",
      },
      location: { coordinates: [3.3517, 6.5244] },
      capacity: 300,
      averagePrice: 65000,
      priceRange: { min: 30000, max: 200000 },
      eventTypes: ["wedding", "birthday", "corporate"],
      services: [
        { name: "Bridal Bouquet", price: { amount: 25000, currency: "NGN" } },
        {
          name: "Centerpiece Arrangements (set of 10)",
          price: { amount: 80000, currency: "NGN" },
        },
        {
          name: "Ceremony Arch Decoration",
          price: { amount: 120000, currency: "NGN" },
        },
        { name: "Boutonniere Set", price: { amount: 15000, currency: "NGN" } },
      ],
      features: [
        "Fresh Flowers",
        "Custom Arrangements",
        "Seasonal Blooms",
        "Delivery Service",
      ],
      rating: 4.7,
      reviewCount: 145,
    },
  ],

  rentals: [
    {
      name: "Party Rentals Plus",
      businessName: "Party Rentals Plus Ltd",
      email: "rentals@partyrentals.ng",
      phone: "+234-818-901-2345",
      tagline: "Everything you need for the perfect event",
      description:
        "Complete party rental service offering tables, chairs, linens, tents, and more. Quality equipment for events of all sizes.",
      address: {
        street: "56 Apapa Road",
        city: "Lagos",
        state: "Lagos",
        country: "Nigeria",
        zipCode: "100001",
      },
      location: { coordinates: [3.3792, 6.5244] },
      capacity: 1000,
      averagePrice: 500,
      priceRange: { min: 200, max: 2000 },
      eventTypes: ["wedding", "corporate", "birthday"],
      services: [
        {
          name: "Round Table (seats 8)",
          price: { amount: 1500, currency: "NGN" },
        },
        { name: "Chiavari Chair", price: { amount: 800, currency: "NGN" } },
        {
          name: "Tent Rental (20x30)",
          price: { amount: 45000, currency: "NGN" },
        },
        { name: "Linen Package", price: { amount: 25000, currency: "NGN" } },
      ],
      features: [
        "Quality Equipment",
        "Delivery & Setup",
        "Clean & Sanitized",
        "Flexible Packages",
      ],
      rating: 4.4,
      reviewCount: 203,
    },
  ],
};

// Create vendor owner users
const createVendorUsers = async () => {
  const vendorUsers = [];
  let userIndex = 1;

  for (const [category, vendors] of Object.entries(vendorCategories)) {
    for (const vendorData of vendors) {
      const hashedPassword = await bcrypt.hash("VendorPass123!", 12);

      const user = new User({
        firstName: vendorData.name.split(" ")[0],
        lastName: vendorData.name.split(" ").slice(1).join(" ") || "Services",
        email: vendorData.email,
        password: hashedPassword,
        phone: vendorData.phone,
        role: "vendor",
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        profile: {
          bio: vendorData.description,
          location: vendorData.address.city + ", " + vendorData.address.country,
        },
      });

      await user.save();
      vendorUsers.push({ user, category, vendorData });
      console.log(`✅ Created user for ${vendorData.name}`);
    }
  }

  return vendorUsers;
};

// Create vendors
const createVendors = async (vendorUsers) => {
  for (const { user, category, vendorData } of vendorUsers) {
    const vendor = new Vendor({
      owner: user._id,
      name: vendorData.name,
      businessName: vendorData.businessName,
      displayName: vendorData.businessName,
      email: vendorData.email,
      phone: vendorData.phone,
      tagline: vendorData.tagline,
      businessType:
        category === "venue"
          ? "venue"
          : category === "catering"
          ? "catering"
          : category === "photography"
          ? "photography"
          : category === "decoration"
          ? "decoration"
          : category === "entertainment"
          ? "music"
          : "other",
      category: category,
      eventTypes: vendorData.eventTypes,
      averagePrice: vendorData.averagePrice,
      priceRange: vendorData.priceRange,
      capacity: vendorData.capacity,
      availabilityStatus: "high",
      description: vendorData.description,
      address: vendorData.address,
      location: vendorData.location,
      status: "approved",
      isActive: true,
      isFeatured: Math.random() > 0.7, // 30% chance of being featured
      services: vendorData.services,
      rating: vendorData.rating,
      reviewCount: vendorData.reviewCount,
      features: vendorData.features,
    });

    await vendor.save();
    console.log(`✅ Created vendor: ${vendorData.name} (${category})`);
  }
};

// Main seeding function
const seedVendors = async () => {
  try {
    console.log("🌱 Starting comprehensive vendor seeding...");

    // Clear existing vendors (optional - comment out if you want to keep existing data)
    // await Vendor.deleteMany({});
    // console.log("🗑️  Cleared existing vendors");

    // Create users and vendors
    const vendorUsers = await createVendorUsers();
    await createVendors(vendorUsers);

    console.log("✅ Vendor seeding completed successfully!");
    console.log(
      `📊 Total vendors created: ${
        Object.values(vendorCategories).flat().length
      }`
    );
    console.log("📋 Categories covered:");
    Object.keys(vendorCategories).forEach((category) => {
      console.log(
        `   - ${category}: ${vendorCategories[category].length} vendors`
      );
    });
  } catch (error) {
    console.error("❌ Error seeding vendors:", error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the seeding
connectDB().then(() => {
  seedVendors();
});

export default seedVendors;
