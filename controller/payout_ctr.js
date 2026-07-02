import User from "../model/user_model.js";
import { createTransferRecipient, listBanks } from "../utils/paystack.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sanitizeUser } from "../utils/token.js";

// PROVIDER: list Nigerian banks for the bank-select dropdown
export const getBanks = asyncHandler(async (req, res) => {
  const result = await listBanks();
  return res.status(200).json({ message: "Banks retrieved", banks: result.data });
});

// PROVIDER: set up payout account - creates a Paystack transfer recipient
// and stores the recipient code so future payouts are a single API call.
export const setupPayoutAccount = asyncHandler(async (req, res) => {
  const { accountNumber, bankCode, bankName, accountName } = req.body;

  if (!accountNumber || !bankCode) {
    return res.status(400).json({ message: "Account number and bank are required" });
  }

  const recipient = await createTransferRecipient({
    name: accountName || req.user.name,
    accountNumber,
    bankCode,
  });

  req.user.paymentDetails = {
    bankName,
    accountNumber,
    accountName: recipient.data.details?.account_name || accountName || req.user.name,
    paystackRecipientCode: recipient.data.recipient_code,
  };
  await req.user.save();

  return res.status(200).json({
    message: "Payout account set up successfully",
    user: sanitizeUser(req.user),
  });
});
