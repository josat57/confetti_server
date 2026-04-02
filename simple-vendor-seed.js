// Simple vendor seeding script for MongoDB
// Run this directly in MongoDB shell or via mongosh

const vendorData = [
  // VENUES
  {
    name: "Grand Ballroom Lagos",
    businessName: "Grand Ballroom Events Center",
    email: "info@grandballroom.ng",
    phone: "+234-801-234-5678",
    businessType: "venue",
    category: "venue",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 250000,
    priceRange: { min: 150000, max: 400000 },
    capacity: 500,
    description:
      "Premier event venue in Victoria Island with stunning waterfront views, accommodating 50-500 guests.",
    address: {
      street: "15 Tiamiyu Savage Street",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.4273, 6.4281] },
    status: "approved",
    isActive: true,
    rating: 4.5,
    reviewCount: 127,
    services: [
      {
        name: "Hall Rental (8 hours)",
        price: { amount: 200000, currency: "NGN" },
      },
      { name: "Setup & Cleanup", price: { amount: 50000, currency: "NGN" } },
    ],
    features: ["Air Conditioning", "Parking", "Kitchen", "Sound System"],
  },

  {
    name: "Emerald Gardens",
    businessName: "Emerald Gardens Event Center",
    email: "bookings@emeraldgardens.ng",
    phone: "+234-802-345-6789",
    businessType: "venue",
    category: "venue",
    eventTypes: ["wedding", "birthday", "corporate"],
    averagePrice: 180000,
    priceRange: { min: 120000, max: 250000 },
    capacity: 300,
    description:
      "Versatile event center with lush gardens and modern indoor facilities.",
    address: {
      street: "Plot 45, Admiralty Way",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.4195, 6.4474] },
    status: "approved",
    isActive: true,
    rating: 4.3,
    reviewCount: 89,
    services: [
      {
        name: "Garden Venue (6 hours)",
        price: { amount: 150000, currency: "NGN" },
      },
      {
        name: "Indoor Hall (6 hours)",
        price: { amount: 120000, currency: "NGN" },
      },
    ],
    features: ["Garden Setting", "Indoor Backup", "Bridal Suite", "Parking"],
  },

  // CATERING
  {
    name: "Delicious Delights Catering",
    businessName: "Delicious Delights Ltd",
    email: "orders@deliciousdelights.ng",
    phone: "+234-804-567-8901",
    businessType: "catering",
    category: "catering",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 3500,
    priceRange: { min: 2000, max: 8000 },
    capacity: 1000,
    description:
      "Premium catering service specializing in Nigerian and continental cuisine.",
    address: {
      street: "23 Allen Avenue",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3792, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.6,
    reviewCount: 203,
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
    ],
    features: [
      "Halal Options",
      "Vegetarian Menu",
      "Live Cooking",
      "Professional Staff",
    ],
  },

  {
    name: "Mama's Kitchen Catering",
    businessName: "Mama's Kitchen Services",
    email: "info@mamaskitchen.ng",
    phone: "+234-805-678-9012",
    businessType: "catering",
    category: "catering",
    eventTypes: ["wedding", "birthday"],
    averagePrice: 2500,
    priceRange: { min: 1500, max: 4000 },
    capacity: 500,
    description:
      "Traditional Nigerian catering with authentic recipes passed down through generations.",
    address: {
      street: "67 Opebi Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3517, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.4,
    reviewCount: 145,
    services: [
      {
        name: "Traditional Nigerian (per person)",
        price: { amount: 2200, currency: "NGN" },
      },
      {
        name: "Jollof Rice Special (per person)",
        price: { amount: 1800, currency: "NGN" },
      },
    ],
    features: [
      "Traditional Recipes",
      "Cultural Presentation",
      "Affordable Pricing",
    ],
  },

  // PHOTOGRAPHY
  {
    name: "Moments Photography Studio",
    businessName: "Moments Photography Ltd",
    email: "hello@momentsphotography.ng",
    phone: "+234-807-890-1234",
    businessType: "photography",
    category: "photography",
    eventTypes: ["wedding", "birthday", "corporate"],
    averagePrice: 150000,
    priceRange: { min: 80000, max: 300000 },
    capacity: 1,
    description:
      "Professional wedding and event photography with a creative eye for detail.",
    address: {
      street: "18 Fola Osibo Street",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.4536, 6.4474] },
    status: "approved",
    isActive: true,
    rating: 4.7,
    reviewCount: 167,
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
    ],
    features: ["Professional Equipment", "Same Day Preview", "Online Gallery"],
  },

  {
    name: "Lens Masters Photography",
    businessName: "Lens Masters Studio",
    email: "info@lensmasters.ng",
    phone: "+234-808-901-2345",
    businessType: "photography",
    category: "photography",
    eventTypes: ["wedding", "corporate"],
    averagePrice: 250000,
    priceRange: { min: 150000, max: 500000 },
    capacity: 1,
    description:
      "Award-winning photography studio with expertise in luxury weddings and high-profile events.",
    address: {
      street: "25 Admiralty Way",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.4195, 6.4474] },
    status: "approved",
    isActive: true,
    rating: 4.9,
    reviewCount: 89,
    services: [
      {
        name: "Premium Wedding Package",
        price: { amount: 300000, currency: "NGN" },
      },
      {
        name: "Corporate Event Coverage",
        price: { amount: 200000, currency: "NGN" },
      },
    ],
    features: ["Award Winning", "Drone Services", "Luxury Albums"],
  },

  // VIDEOGRAPHY
  {
    name: "Cinematic Visions",
    businessName: "Cinematic Visions Productions",
    email: "productions@cinematicvisions.ng",
    phone: "+234-809-012-3456",
    businessType: "other",
    category: "videography",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 200000,
    priceRange: { min: 120000, max: 400000 },
    capacity: 1,
    description:
      "Professional videography service creating cinematic wedding films and event documentaries.",
    address: {
      street: "12 Ozumba Mbadiwe",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.4273, 6.4281] },
    status: "approved",
    isActive: true,
    rating: 4.6,
    reviewCount: 134,
    services: [
      {
        name: "Wedding Videography (Full Day)",
        price: { amount: 250000, currency: "NGN" },
      },
      {
        name: "Event Highlight Reel",
        price: { amount: 150000, currency: "NGN" },
      },
    ],
    features: ["4K Recording", "Drone Footage", "Same Day Edit"],
  },

  // ENTERTAINMENT
  {
    name: "Rhythm & Beats Entertainment",
    businessName: "Rhythm & Beats Ltd",
    email: "bookings@rhythmbeats.ng",
    phone: "+234-810-123-4567",
    businessType: "music",
    category: "entertainment",
    eventTypes: ["wedding", "birthday", "corporate"],
    averagePrice: 80000,
    priceRange: { min: 50000, max: 200000 },
    capacity: 1000,
    description:
      "Professional DJ and live music services for all types of events.",
    address: {
      street: "34 Awolowo Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.4536, 6.4474] },
    status: "approved",
    isActive: true,
    rating: 4.5,
    reviewCount: 198,
    services: [
      {
        name: "DJ Service (6 hours)",
        price: { amount: 75000, currency: "NGN" },
      },
      {
        name: "Live Band Performance",
        price: { amount: 150000, currency: "NGN" },
      },
    ],
    features: ["Professional DJ", "Live Musicians", "Sound Equipment"],
  },

  {
    name: "Lagos Live Band",
    businessName: "Lagos Live Entertainment",
    email: "info@lagosliveband.ng",
    phone: "+234-811-234-5678",
    businessType: "music",
    category: "entertainment",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 200000,
    priceRange: { min: 120000, max: 350000 },
    capacity: 500,
    description:
      "Professional live band specializing in Afrobeats, Jazz, and contemporary music.",
    address: {
      street: "56 Herbert Macaulay Way",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3792, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.7,
    reviewCount: 112,
    services: [
      {
        name: "Full Band Performance (4 hours)",
        price: { amount: 220000, currency: "NGN" },
      },
      {
        name: "Acoustic Duo (2 hours)",
        price: { amount: 80000, currency: "NGN" },
      },
    ],
    features: ["Live Band", "Cultural Music", "Professional Musicians"],
  },

  // DECORATION
  {
    name: "Elegant Decor Solutions",
    businessName: "Elegant Decor Ltd",
    email: "design@elegantdecor.ng",
    phone: "+234-812-345-6789",
    businessType: "decoration",
    category: "decoration",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 150000,
    priceRange: { min: 80000, max: 400000 },
    capacity: 1000,
    description:
      "Full-service event decoration company specializing in luxury weddings and corporate events.",
    address: {
      street: "78 Ogudu Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3517, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.6,
    reviewCount: 156,
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
    ],
    features: [
      "Custom Designs",
      "Floral Arrangements",
      "Lighting",
      "Luxury Linens",
    ],
  },

  // TRANSPORTATION
  {
    name: "Luxury Ride Services",
    businessName: "Luxury Ride Ltd",
    email: "bookings@luxuryride.ng",
    phone: "+234-813-456-7890",
    businessType: "other",
    category: "transportation",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 25000,
    priceRange: { min: 15000, max: 80000 },
    capacity: 50,
    description:
      "Premium transportation services for weddings and special events.",
    address: {
      street: "45 Adeola Odeku Street",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.4536, 6.4474] },
    status: "approved",
    isActive: true,
    rating: 4.4,
    reviewCount: 87,
    services: [
      {
        name: "Luxury Car (4 hours)",
        price: { amount: 30000, currency: "NGN" },
      },
      { name: "Limousine Service", price: { amount: 60000, currency: "NGN" } },
    ],
    features: ["Luxury Vehicles", "Professional Drivers", "Decorated Cars"],
  },

  // SECURITY
  {
    name: "Elite Security Services",
    businessName: "Elite Security Ltd",
    email: "operations@elitesecurity.ng",
    phone: "+234-814-567-8901",
    businessType: "other",
    category: "security",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 15000,
    priceRange: { min: 10000, max: 30000 },
    capacity: 1000,
    description: "Experienced security personnel for events of all sizes.",
    address: {
      street: "23 Ikorodu Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3792, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.3,
    reviewCount: 67,
    services: [
      {
        name: "Security Guard (per person/day)",
        price: { amount: 12000, currency: "NGN" },
      },
      {
        name: "VIP Protection Service",
        price: { amount: 25000, currency: "NGN" },
      },
    ],
    features: ["Trained Personnel", "Crowd Control", "VIP Protection"],
  },

  // AUDIO VISUAL
  {
    name: "Pro AV Solutions",
    businessName: "Pro AV Solutions Ltd",
    email: "tech@proavsolutions.ng",
    phone: "+234-815-678-9012",
    businessType: "other",
    category: "audio_visual",
    eventTypes: ["corporate", "wedding", "birthday"],
    averagePrice: 75000,
    priceRange: { min: 40000, max: 200000 },
    capacity: 2000,
    description:
      "Professional audio-visual equipment rental and technical support for events.",
    address: {
      street: "67 Agege Motor Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3517, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.5,
    reviewCount: 94,
    services: [
      {
        name: "Sound System Package",
        price: { amount: 60000, currency: "NGN" },
      },
      { name: "LED Screen Rental", price: { amount: 80000, currency: "NGN" } },
      { name: "Lighting Package", price: { amount: 50000, currency: "NGN" } },
    ],
    features: ["Professional Equipment", "Technical Support", "Setup Service"],
  },

  // CAKE & DESSERTS
  {
    name: "Sweet Dreams Bakery",
    businessName: "Sweet Dreams Ltd",
    email: "orders@sweetdreams.ng",
    phone: "+234-816-789-0123",
    businessType: "other",
    category: "cake_desserts",
    eventTypes: ["wedding", "birthday"],
    averagePrice: 45000,
    priceRange: { min: 25000, max: 150000 },
    capacity: 500,
    description:
      "Custom cake design and dessert catering for weddings and special events.",
    address: {
      street: "89 Surulere Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3517, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.8,
    reviewCount: 178,
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
    ],
    features: ["Custom Designs", "Fresh Ingredients", "Delivery Service"],
  },

  // FLORALS
  {
    name: "Bloom & Blossom Florals",
    businessName: "Bloom & Blossom Ltd",
    email: "flowers@bloomblossom.ng",
    phone: "+234-817-890-1234",
    businessType: "other",
    category: "florals",
    eventTypes: ["wedding", "birthday", "corporate"],
    averagePrice: 65000,
    priceRange: { min: 30000, max: 200000 },
    capacity: 300,
    description: "Premium floral design service for weddings and events.",
    address: {
      street: "34 Ikeja Way",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3517, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.7,
    reviewCount: 145,
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
    ],
    features: ["Fresh Flowers", "Custom Arrangements", "Seasonal Blooms"],
  },

  // RENTALS
  {
    name: "Party Rentals Plus",
    businessName: "Party Rentals Plus Ltd",
    email: "rentals@partyrentals.ng",
    phone: "+234-818-901-2345",
    businessType: "other",
    category: "rentals",
    eventTypes: ["wedding", "corporate", "birthday"],
    averagePrice: 500,
    priceRange: { min: 200, max: 2000 },
    capacity: 1000,
    description:
      "Complete party rental service offering tables, chairs, linens, tents, and more.",
    address: {
      street: "56 Apapa Road",
      city: "Lagos",
      state: "Lagos",
      country: "Nigeria",
    },
    location: { type: "Point", coordinates: [3.3792, 6.5244] },
    status: "approved",
    isActive: true,
    rating: 4.4,
    reviewCount: 203,
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
    ],
    features: ["Quality Equipment", "Delivery & Setup", "Clean & Sanitized"],
  },
];

// Insert vendors into database
db.vendors.insertMany(vendorData);

print("✅ Comprehensive vendor seeding completed!");
print("📊 Total vendors inserted: " + vendorData.length);
print(
  "📋 Categories covered: venue, catering, photography, videography, entertainment, decoration, transportation, security, audio_visual, cake_desserts, florals, rentals"
);
