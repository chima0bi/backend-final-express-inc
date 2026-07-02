const PAYSTACK_BASE_URL = "https://api.paystack.co";

const paystackFetch = async (path, options = {}) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const data = await response.json();
  if (!response.ok || data.status === false) {
    const message = data?.message || "Paystack request failed";
    const err = new Error(message);
    err.paystackResponse = data;
    throw err;
  }
  return data;
};

// Initializes a transaction. Amount must be in Naira; Paystack expects kobo.
export const initializeTransaction = async ({ email, amountNaira, reference, callback_url, metadata }) => {
  return paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount: Math.round(amountNaira * 100),
      reference,
      callback_url,
      metadata,
    }),
  });
};

export const verifyTransaction = async (reference) => {
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
  });
};

// Creates a transfer recipient for a provider payout (run once, cache the code)
export const createTransferRecipient = async ({ name, accountNumber, bankCode }) => {
  return paystackFetch("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: "NGN",
    }),
  });
};

export const initiateTransfer = async ({ amountNaira, recipientCode, reason }) => {
  return paystackFetch("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: Math.round(amountNaira * 100),
      recipient: recipientCode,
      reason,
    }),
  });
};

export const listBanks = async () => {
  return paystackFetch("/bank?country=nigeria", { method: "GET" });
};
