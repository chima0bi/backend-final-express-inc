import User from "../model/user_model.js";
import bcrypt from "bcryptjs";
import { signToken, sanitizeUser } from "../utils/token.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import cloudinary from "../config/cloudinary.js";

const MAX_LOGIN_ATTEMPTS = 7;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// REGISTER
export const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    username,
    password,
    state,
    country,
    address,
    phone,
    role,
    experienceYears,
    bio,
  } = req.body;

  const existingUser = await User.findOne({
    $or: [
      { email: email.toLowerCase() },
      { username: username.toLowerCase() },
      { phone },
    ],
  });

  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) {
      return res
        .status(409)
        .json({
          message: "An account with this email already exists, please log in",
        });
    }
    if (existingUser.username === username.toLowerCase()) {
      return res
        .status(409)
        .json({ message: "Username already taken, please choose another" });
    }
    return res
      .status(409)
      .json({ message: "An account with this phone number already exists" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await User.create({
    name,
    username,
    email,
    password: hashedPassword,
    phone,
    country,
    state,
    address,
    role: role === "provider" ? "provider" : "user", // never trust role:"admin" from client
    experienceYears,
    bio,
  });

  const token = signToken(newUser);

  return res.status(201).json({
    message: "Account created successfully",
    token,
    user: sanitizeUser(newUser),
  });
});

// LOGIN
// GET CURRENT USER (the authenticated person's own profile)
export const getMe = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json({ message: "User retrieved", user: sanitizeUser(req.user) });
});

// GET USER BY ID (admin/owner, or the user themselves)
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  return res
    .status(200)
    .json({ message: "User retrieved", user: sanitizeUser(user) });
});

// GET ALL USERS (admin/owner only) - paginated, filterable by role
export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20, search } = req.query;
  const query = {};
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(query),
  ]);

  return res.status(200).json({
    message: "Users retrieved successfully",
    users: users.map(sanitizeUser),
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

// UPDATE OWN PROFILE (or admin updating someone else's, via /users/:id)
export const updateUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id || req.user._id;
  const {
    name,
    email,
    phone,
    password,
    country,
    state,
    address,
    username,
    experienceYears,
    bio,
    avatar,
    paymentDetails,
  } = req.body;

  const user = await User.findById(targetId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email.toLowerCase();
  if (username !== undefined) user.username = username.toLowerCase();
  if (country !== undefined) user.country = country;
  if (state !== undefined) user.state = state;
  if (address !== undefined) user.address = address;
  if (phone !== undefined) user.phone = phone;
  if (experienceYears !== undefined) user.experienceYears = experienceYears;
  if (bio !== undefined) user.bio = bio;
  if (avatar !== undefined) user.avatar = avatar;
  if (paymentDetails !== undefined) {
    user.paymentDetails = { ...user.paymentDetails, ...paymentDetails };
  }

  if (password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
  }

  await user.save();

  return res
    .status(200)
    .json({
      message: "Profile updated successfully",
      user: sanitizeUser(user),
    });
});

// ADMIN: promote a user to admin
export const promoteToAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (user.role === "owner") {
    return res.status(403).json({ message: "Cannot change the owner's role" });
  }
  user.role = "admin";
  await user.save();
  return res
    .status(200)
    .json({ message: "User promoted to admin", user: sanitizeUser(user) });
});

// ADMIN: demote an admin back to user
export const demoteAdmin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (user.role === "owner") {
    return res.status(403).json({ message: "Cannot change the owner's role" });
  }
  user.role = "user";
  await user.save();
  return res
    .status(200)
    .json({ message: "Admin demoted successfully", user: sanitizeUser(user) });
});

// ADMIN: suspend / unsuspend a user
export const suspendUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (user.role === "owner" || user.role === "admin") {
    return res
      .status(403)
      .json({ message: "Cannot suspend an admin or owner account" });
  }
  user.isActive = false;
  user.suspendedAt = new Date();
  user.suspendedReason = reason || "Violation of platform terms";
  await user.save();
  return res
    .status(200)
    .json({ message: "User suspended", user: sanitizeUser(user) });
});

export const unsuspendUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  user.isActive = true;
  user.suspendedAt = undefined;
  user.suspendedReason = undefined;
  await user.save();
  return res
    .status(200)
    .json({ message: "User reinstated", user: sanitizeUser(user) });
});

// DELETE - self or admin
export const deleteUser = asyncHandler(async (req, res) => {
  const targetId = req.params.id || req.user._id;
  const user = await User.findByIdAndDelete(targetId);
  if (!user) {
    return res.status(404).json({ message: "User does not exist" });
  }
  return res.status(200).json({ message: "Account deleted successfully" });
});

// PUBLIC: browse providers (for "find a provider" pages)
export const getAllProviders = asyncHandler(async (req, res) => {
  const { state, search, page = 1, limit = 20 } = req.query;
  const query = { role: "provider", isActive: true };
  if (state) query.state = { $regex: state, $options: "i" };
  if (search) query.name = { $regex: search, $options: "i" };

  const skip = (Number(page) - 1) * Number(limit);
  const [providers, total] = await Promise.all([
    User.find(query)
      .select(
        "name avatar state country bio experienceYears averageRating reviewCount createdAt",
      )
      .sort({ averageRating: -1, reviewCount: -1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(query),
  ]);

  return res.status(200).json({
    message: "Providers retrieved",
    providers,
    pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
  });
});

export const getProviderProfile = asyncHandler(async (req, res) => {
  const provider = await User.findOne({
    _id: req.params.id,
    role: "provider",
  }).select(
    "name avatar state country bio experienceYears averageRating reviewCount createdAt unavailableDates portfolio",
  );
  if (!provider) {
    return res.status(404).json({ message: "Provider not found" });
  }
  return res.status(200).json({ message: "Provider retrieved", provider });
});

// PROVIDER: set their own availability calendar (full replace - the
// frontend sends the complete updated list of unavailable dates each time,
// simpler than incremental add/remove for a calendar UI where the provider
// is toggling individual days on and off).
export const updateAvailability = asyncHandler(async (req, res) => {
  const { unavailableDates } = req.body;
  req.user.unavailableDates = unavailableDates;
  await req.user.save();
  return res.status(200).json({
    message: "Availability updated",
    unavailableDates: req.user.unavailableDates,
  });
});

// PROVIDER: add a portfolio item (certificate, past-work photo/video).
// Expects a single file under the "file" field, handled by multer in the
// route via Cloudinary storage (see config/upload.js's uploadPortfolioItem) -
// req.file.path is Cloudinary's permanent URL for the uploaded file.
export const addPortfolioItem = asyncHandler(async (req, res) => {
  const { type, caption } = req.body;
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  if (!["image", "video", "certificate"].includes(type)) {
    return res.status(400).json({ message: "Invalid portfolio item type" });
  }

  req.user.portfolio.push({ url: req.file.path, type, caption });
  await req.user.save();

  return res.status(201).json({
    message: "Portfolio item added",
    portfolio: req.user.portfolio,
  });
});

// Best-effort Cloudinary cleanup alongside removing the portfolio entry -
// extracts the public_id from the stored URL the same way listing media
// removal does, and never blocks the response on cleanup failing.
export const removePortfolioItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const item = req.user.portfolio.find((i) => String(i._id) === itemId);
  req.user.portfolio = req.user.portfolio.filter((i) => String(i._id) !== itemId);
  await req.user.save();

  if (item?.url) {
    try {
      const isVideo = item.url.includes("/video/upload/");
      const isRaw = item.url.includes("/raw/upload/");
      const afterUpload = item.url.split("/upload/")[1];
      const withoutVersion = afterUpload.replace(/^v\d+\//, "");
      const publicId = isRaw ? withoutVersion : withoutVersion.replace(/\.[a-zA-Z0-9]+$/, "");
      await cloudinary.uploader.destroy(publicId, {
        resource_type: isVideo ? "video" : isRaw ? "raw" : "image",
      });
    } catch (err) {
      console.warn("Could not remove portfolio file from Cloudinary:", err.message);
    }
  }

  return res.status(200).json({ message: "Portfolio item removed", portfolio: req.user.portfolio });
});

// CUSTOMER: favorite / unfavorite a provider
export const toggleFavoriteProvider = asyncHandler(async (req, res) => {
  const { providerId } = req.params;

  const provider = await User.findOne({ _id: providerId, role: "provider" });
  if (!provider) {
    return res.status(404).json({ message: "Provider not found" });
  }

  const alreadyFavorited = req.user.favoriteProviders.some((id) => String(id) === providerId);

  if (alreadyFavorited) {
    req.user.favoriteProviders = req.user.favoriteProviders.filter((id) => String(id) !== providerId);
  } else {
    req.user.favoriteProviders.push(providerId);
  }
  await req.user.save();

  return res.status(200).json({
    message: alreadyFavorited ? "Removed from favorites" : "Added to favorites",
    isFavorited: !alreadyFavorited,
    favoriteProviders: req.user.favoriteProviders,
  });
});

// CUSTOMER: list their favorited providers, populated with basic profile info
export const getMyFavoriteProviders = asyncHandler(async (req, res) => {
  await req.user.populate({
    path: "favoriteProviders",
    select: "name avatar state country bio experienceYears averageRating reviewCount",
  });
  return res.status(200).json({ message: "Favorite providers retrieved", providers: req.user.favoriteProviders });
});
