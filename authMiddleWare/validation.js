import Joi from "joi";

const phonePattern = /^\+?[0-9]{10,15}$/;

export const validateRegistration = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    username: Joi.string().min(3).max(30).required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().pattern(phonePattern).required(),
    country: Joi.string().required(),
    state: Joi.string().required(),
    address: Joi.string().allow("").optional(),
    role: Joi.string().valid("user", "provider").default("user"), // admin/owner can never self-register
    experienceYears: Joi.number().min(0).max(60).optional(),
    bio: Joi.string().max(1000).allow("").optional(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message:
        "Validation error, input data missing or not matching expected patterns",
      details: error.details[0].message,
    });
  }
  next();
};

export const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

export const validateUpdate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    username: Joi.string().min(3).max(30).optional(),
    password: Joi.string().min(6).optional(),
    phone: Joi.string().pattern(phonePattern).optional(),
    country: Joi.string().optional(),
    state: Joi.string().optional(),
    address: Joi.string().allow("").optional(),
    experienceYears: Joi.number().min(0).max(60).optional(),
    bio: Joi.string().max(1000).allow("").optional(),
    avatar: Joi.string().allow("").optional(),
    paymentDetails: Joi.object({
      bankName: Joi.string().allow(""),
      accountNumber: Joi.string().allow(""),
      accountName: Joi.string().allow(""),
    }).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message:
        "Validation error, input data does not match expected pattern(s)",
      details: error.details[0].message,
    });
  }
  next();
};

// Category must now be an existing, approved ServiceCategory id. Providers
// can no longer create a category inline while creating a listing - if
// their service doesn't fit anything that exists, they submit a separate
// CategoryRequest (see validateCategoryRequest below) for an admin/owner to
// review, and can only create this listing once that request is approved
// and the category becomes real.
//
// PROVIDER submitting a request for a brand new category
export const validateCategoryRequest = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(60).required(),
    description: Joi.string().max(500).allow("").optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

// ADMIN/OWNER reviewing a category request
export const validateCategoryReview = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string().valid("approved", "rejected").required(),
    reviewNotes: Joi.string().max(500).allow("").optional(),
    icon: Joi.string().max(40).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

export const validateListing = (req, res, next) => {
  const schema = Joi.object({
    category: Joi.string().required(),
    title: Joi.string().min(3).max(120).required(),
    description: Joi.string().min(10).max(2000).required(),
    price: Joi.number().min(0).required(),
    pricingUnit: Joi.string().max(40).optional(),
    location: Joi.string().max(200).optional().allow(""),
    estimatedTime: Joi.string().max(60).optional().allow(""),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    }).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

export const validateListingUpdate = (req, res, next) => {
  const schema = Joi.object({
    category: Joi.string().optional(),
    title: Joi.string().min(3).max(120).optional(),
    description: Joi.string().min(10).max(2000).optional(),
    price: Joi.number().min(0).optional(),
    pricingUnit: Joi.string().max(40).optional(),
    location: Joi.string().max(200).optional().allow(""),
    estimatedTime: Joi.string().max(60).optional().allow(""),
    isActive: Joi.boolean().optional(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required(),
    }).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

export const validateBooking = (req, res, next) => {
  const schema = Joi.object({
    listing: Joi.string().required(),
    address: Joi.string().min(5).required(),
    scheduledDate: Joi.date().min("now").required(),
    scheduledTime: Joi.string().required(),
    notes: Joi.string().max(1000).allow("").optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

export const validateReview = (req, res, next) => {
  const schema = Joi.object({
    booking: Joi.string().required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().min(3).max(1000).required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

export const validateCategory = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(60).required(),
    description: Joi.string().max(500).allow("").optional(),
    icon: Joi.string().max(40).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

// PROVIDER updating their availability calendar
export const validateAvailability = (req, res, next) => {
  const schema = Joi.object({
    unavailableDates: Joi.array().items(Joi.date()).required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

// ADMIN/OWNER reviewing a listing for verification
export const validateListingVerification = (req, res, next) => {
  const schema = Joi.object({
    isVerified: Joi.boolean().required(),
    verificationNotes: Joi.string().max(500).allow("").optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

// CUSTOMER or PROVIDER filing a complaint about a booking
export const validateComplaint = (req, res, next) => {
  const schema = Joi.object({
    booking: Joi.string().required(),
    subject: Joi.string().min(3).max(150).required(),
    description: Joi.string().min(10).max(2000).required(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};

// ADMIN/OWNER reviewing/resolving a complaint
export const validateComplaintReview = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string().valid("investigating", "resolved", "dismissed").required(),
    resolutionNotes: Joi.string().max(1000).allow("").optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: "Validation error",
      details: error.details[0].message,
    });
  }
  next();
};
