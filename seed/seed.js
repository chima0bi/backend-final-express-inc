// Run with: npm run seed
// WARNING: this wipes the relevant collections before reseeding. Do not run
// against a production database with real user data.

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "../config/db.js";

import User from "../model/user_model.js";
import ServiceCategory from "../model/serviceCategory_model.js";
import ProviderListing from "../model/providerListing_model.js";
import Booking from "../model/booking_model.js";
import Review from "../model/review_model.js";
import Payment from "../model/payment_model.js";

const hash = (pw) => bcrypt.hashSync(pw, 10);

const run = async () => {
  await connectDB();

  console.log("🧹 Clearing existing data...");
  await Promise.all([
    User.deleteMany({}),
    ServiceCategory.deleteMany({}),
    ProviderListing.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({}),
    Payment.deleteMany({}),
  ]);

  // ── Categories ──────────────────────────────────────────────────────
  console.log("📁 Seeding categories...");
  const categories = await ServiceCategory.insertMany([
    { name: "Plumbing", icon: "Wrench", description: "Pipe repairs, installations, leak fixes" },
    { name: "Electrical", icon: "Zap", description: "Wiring, installations, electrical repairs" },
    { name: "Cleaning", icon: "Sparkles", description: "Home and office cleaning services" },
    { name: "Painting", icon: "Paintbrush", description: "Interior and exterior painting" },
    { name: "Carpentry", icon: "Hammer", description: "Furniture, fittings, woodwork repairs" },
    { name: "Gardening", icon: "Trees", description: "Landscaping and garden maintenance" },
    { name: "AC Repair", icon: "Wind", description: "Air conditioning installation and servicing" },
    { name: "Moving & Hauling", icon: "Truck", description: "Home and office relocation services" },
  ]);
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  // ── Owner + Admin ────────────────────────────────────────────────────
  console.log("👑 Seeding owner and admin...");
  const owner = await User.create({
    name: "Chimaobi Ozomamelu",
    username: "chims",
    email: "ozomameluchimaobi123@gmail.com",
    password: hash("Owner@123"),
    phone: "+2347047966730",
    country: "Nigeria",
    state: "Imo",
    address: "Owerri, Imo State",
    role: "owner",
    isVerified: true,
  });

  const admin = await User.create({
    name: "Adaeze Okafor",
    username: "adaeze_admin",
    email: "admin@expressinc.ng",
    password: hash("Admin@123"),
    phone: "+2348011110002",
    country: "Nigeria",
    state: "Imo",
    address: "Owerri, Imo State",
    role: "admin",
    isVerified: true,
  });

  // ── Providers ────────────────────────────────────────────────────────
  console.log("🛠️  Seeding providers...");
  const providerSeeds = [
    {
      name: "Emeka Nwosu",
      username: "emeka_plumber",
      email: "emeka.plumber@example.com",
      phone: "+2348021110001",
      state: "Imo",
      category: "Plumbing",
      experienceYears: 8,
      bio: "Certified plumber with 8 years fixing leaks, installing fittings, and emergency pipe repairs across Owerri.",
      title: "Emergency Plumbing & Pipe Repairs",
      price: 8000,
      pricingUnit: "per visit",
      estimatedTime: "1-3 hours",
    },
    {
      name: "Ifeoma Chukwu",
      username: "ifeoma_clean",
      email: "ifeoma.clean@example.com",
      phone: "+2348021110002",
      state: "Imo",
      category: "Cleaning",
      experienceYears: 5,
      bio: "Professional home and office cleaner. Deep cleaning, fumigation-ready prep, and post-construction cleanup.",
      title: "Deep Home & Office Cleaning",
      price: 12000,
      pricingUnit: "per session",
      estimatedTime: "2-4 hours",
    },
    {
      name: "Tunde Adebayo",
      username: "tunde_electric",
      email: "tunde.electric@example.com",
      phone: "+2348021110003",
      state: "Lagos",
      category: "Electrical",
      experienceYears: 10,
      bio: "Licensed electrician handling wiring, installations, and fault diagnosis for homes and small businesses.",
      title: "Residential Wiring & Electrical Repairs",
      price: 15000,
      pricingUnit: "per job",
      estimatedTime: "2-5 hours",
    },
    {
      name: "Grace Eze",
      username: "grace_paints",
      email: "grace.paints@example.com",
      phone: "+2348021110004",
      state: "Imo",
      category: "Painting",
      experienceYears: 6,
      bio: "Interior and exterior painting specialist. Clean finishes, color consultation included.",
      title: "Interior & Exterior Wall Painting",
      price: 25000,
      pricingUnit: "per room",
      estimatedTime: "1-2 days",
    },
    {
      name: "Chidi Okoro",
      username: "chidi_carpenter",
      email: "chidi.carpenter@example.com",
      phone: "+2348021110005",
      state: "Imo",
      category: "Carpentry",
      experienceYears: 12,
      bio: "Master carpenter — custom furniture, door/window fittings, and repairs.",
      title: "Custom Furniture & Woodwork Repairs",
      price: 18000,
      pricingUnit: "per job",
      estimatedTime: "1-3 days",
    },
    {
      name: "Blessing Nnamdi",
      username: "blessing_ac",
      email: "blessing.ac@example.com",
      phone: "+2348021110006",
      state: "Rivers",
      category: "AC Repair",
      experienceYears: 7,
      bio: "AC installation, gas refill, and servicing for split and standing units.",
      title: "AC Installation & Servicing",
      price: 10000,
      pricingUnit: "per unit",
      estimatedTime: "1-2 hours",
    },
  ];

  const providers = [];
  for (const p of providerSeeds) {
    const user = await User.create({
      name: p.name,
      username: p.username,
      email: p.email,
      password: hash("Provider@123"),
      phone: p.phone,
      country: "Nigeria",
      state: p.state,
      address: `${p.state} State`,
      role: "provider",
      experienceYears: p.experienceYears,
      bio: p.bio,
      isVerified: true,
    });
    providers.push({ user, seed: p });
  }

  // ── Listings ─────────────────────────────────────────────────────────
  console.log("📋 Seeding provider listings...");
  const listings = [];
  for (const { user, seed } of providers) {
    const listing = await ProviderListing.create({
      provider: user._id,
      category: catByName[seed.category]._id,
      title: seed.title,
      description: `${seed.bio} Book me for reliable, on-time service with transparent pricing.`,
      price: seed.price,
      pricingUnit: seed.pricingUnit,
      location: `${seed.state}, Nigeria`,
      estimatedTime: seed.estimatedTime,
      images: [],
      videos: [],
      isFeatured: Math.random() > 0.5,
    });
    listings.push(listing);
  }

  // ── Customers ────────────────────────────────────────────────────────
  console.log("👤 Seeding customers...");
  const customerSeeds = [
    { name: "Ngozi Umeh", username: "ngozi_u", email: "ngozi.u@example.com", phone: "+2348031110001", state: "Imo" },
    { name: "Femi Bankole", username: "femi_b", email: "femi.b@example.com", phone: "+2348031110002", state: "Lagos" },
    { name: "Aisha Bello", username: "aisha_b", email: "aisha.b@example.com", phone: "+2348031110003", state: "Abuja" },
  ];

  const customers = [];
  for (const c of customerSeeds) {
    const user = await User.create({
      name: c.name,
      username: c.username,
      email: c.email,
      password: hash("Customer@123"),
      phone: c.phone,
      country: "Nigeria",
      state: c.state,
      address: `${c.state} State`,
      role: "user",
    });
    customers.push(user);
  }

  // ── Bookings + Reviews (a realistic mix of statuses) ────────────────
  console.log("📅 Seeding bookings and reviews...");
  const statuses = ["completed", "completed", "accepted", "pending", "in-progress"];
  let bookingCount = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const customer = customers[i % customers.length];
    const status = statuses[i % statuses.length];

    const booking = await Booking.create({
      customer: customer._id,
      provider: listing.provider,
      listing: listing._id,
      price: listing.price,
      address: `${customer.address}, near city center`,
      scheduledDate: new Date(Date.now() + (i + 1) * 86400000),
      scheduledTime: "10:00",
      status,
      notes: "Please call when you arrive at the gate.",
      isReviewed: status === "completed",
    });
    bookingCount++;

    if (status === "completed") {
      await Review.create({
        booking: booking._id,
        customer: customer._id,
        provider: listing.provider,
        listing: listing._id,
        rating: 4 + Math.round(Math.random()), // 4 or 5
        comment: "Great service, arrived on time and did excellent work. Would book again!",
      });

      const platformFee = Math.round(listing.price * 0.1);
      await Payment.create({
        booking: booking._id,
        customer: customer._id,
        provider: listing.provider,
        amount: listing.price,
        platformFee,
        providerPayout: listing.price - platformFee,
        paystackReference: `seed_ref_${booking._id}`,
        status: "released",
        paidAt: new Date(),
        releasedAt: new Date(),
      });
    }
  }

  // Recalculate aggregate ratings the same way the review controller does
  console.log("⭐ Recalculating ratings...");
  for (const listing of listings) {
    const reviews = await Review.find({ listing: listing._id });
    if (reviews.length) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      listing.averageRating = Math.round(avg * 10) / 10;
      listing.reviewCount = reviews.length;
      await listing.save();

      await User.findByIdAndUpdate(listing.provider, {
        averageRating: listing.averageRating,
        reviewCount: listing.reviewCount,
      });
    }
  }

  console.log("\n✅ Seed complete!");
  console.log(`   ${categories.length} categories`);
  console.log(`   ${providers.length} providers + 1 admin + 1 owner`);
  console.log(`   ${customers.length} customers`);
  console.log(`   ${listings.length} listings`);
  console.log(`   ${bookingCount} bookings\n`);
  console.log("🔑 Login credentials:");
  console.log("   Owner:    owner@expressinc.ng / Owner@123");
  console.log("   Admin:    admin@expressinc.ng / Admin@123");
  console.log("   Provider: emeka.plumber@example.com / Provider@123");
  console.log("   Customer: ngozi.u@example.com / Customer@123\n");

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
