import crypto from "crypto";
import Payment from "../model/payment_model.js";
import Booking from "../model/booking_model.js";
import {
  initializeTransaction,
  verifyTransaction,
  initiateTransfer,
} from "../utils/paystack.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const PLATFORM_FEE_PERCENT = 10; // Express.Inc takes 10%, provider gets the rest

// CUSTOMER: initialize payment for a pending booking
export const initializePayment = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;

  const booking = await Booking.findById(bookingId).populate("customer", "email name");
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }
  if (String(booking.customer._id) !== String(req.user._id)) {
    return res.status(403).json({ message: "This is not your booking" });
  }
  if (booking.payment) {
    return res.status(409).json({ message: "This booking already has a payment record" });
  }

  const reference = `expinc_${booking._id}_${Date.now()}`;
  const platformFee = Math.round(booking.price * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
  const providerPayout = booking.price - platformFee;

  const paystackResponse = await initializeTransaction({
    email: booking.customer.email,
    amountNaira: booking.price,
    reference,
    callback_url: process.env.PAYSTACK_CALLBACK_URL,
    metadata: { bookingId: String(booking._id), customerName: booking.customer.name },
  });

  const payment = await Payment.create({
    booking: booking._id,
    customer: booking.customer._id,
    provider: booking.provider,
    amount: booking.price,
    platformFee,
    providerPayout,
    paystackReference: reference,
    paystackAccessCode: paystackResponse.data.access_code,
  });

  booking.payment = payment._id;
  await booking.save();

  return res.status(200).json({
    message: "Payment initialized",
    authorizationUrl: paystackResponse.data.authorization_url,
    reference,
  });
});

// CUSTOMER (or callback redirect): verify a payment manually
export const verifyPayment = asyncHandler(async (req, res) => {
  const { reference } = req.params;

  const payment = await Payment.findOne({ paystackReference: reference });
  if (!payment) {
    return res.status(404).json({ message: "Payment record not found" });
  }

  if (payment.status === "paid" || payment.status === "released") {
    return res.status(200).json({ message: "Payment already verified", payment });
  }

  const result = await verifyTransaction(reference);

  if (result.data.status === "success") {
    payment.status = "paid";
    payment.paidAt = new Date();
    await payment.save();
  } else {
    payment.status = "failed";
    await payment.save();
    return res.status(400).json({ message: "Payment was not successful", payment });
  }

  return res.status(200).json({ message: "Payment verified successfully", payment });
});

// PAYSTACK WEBHOOK - the source of truth for payment confirmation.
// Must use the raw request body for signature verification (configured in index.js).
export const paystackWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers["x-paystack-signature"];
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(req.rawBody)
    .digest("hex");

  if (hash !== signature) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = req.body;

  if (event.event === "charge.success") {
    const reference = event.data.reference;
    const payment = await Payment.findOne({ paystackReference: reference });
    if (payment && payment.status === "pending") {
      payment.status = "paid";
      payment.paidAt = new Date();
      await payment.save();
    }
  }

  return res.status(200).json({ received: true });
});

// Triggered internally when a booking moves to "completed" - releases the
// held funds to the provider via Paystack transfer. Requires the provider
// to have a paystackRecipientCode set up (see createPayoutRecipient below).
export const releasePayout = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId).populate("payment").populate("provider");
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }
  if (booking.status !== "completed") {
    return res.status(400).json({ message: "Booking must be completed before releasing payout" });
  }
  if (!booking.payment) {
    return res.status(400).json({ message: "No payment record linked to this booking" });
  }
  if (booking.payment.status !== "paid") {
    return res.status(400).json({ message: "Payment has not been confirmed yet" });
  }
  if (!booking.provider.paymentDetails?.paystackRecipientCode) {
    return res.status(400).json({ message: "Provider has not set up payout details yet" });
  }

  const transfer = await initiateTransfer({
    amountNaira: booking.payment.providerPayout,
    recipientCode: booking.provider.paymentDetails.paystackRecipientCode,
    reason: `Payout for completed booking ${booking._id}`,
  });

  booking.payment.status = "released";
  booking.payment.releasedAt = new Date();
  await booking.payment.save();

  return res.status(200).json({ message: "Payout released to provider", transfer: transfer.data });
});

export const getPaymentByBooking = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ booking: req.params.bookingId });
  if (!payment) {
    return res.status(404).json({ message: "No payment found for this booking" });
  }
  const isParticipant =
    String(payment.customer) === String(req.user._id) || String(payment.provider) === String(req.user._id);
  if (!isParticipant && !["admin", "owner"].includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  return res.status(200).json({ message: "Payment retrieved", payment });
});
