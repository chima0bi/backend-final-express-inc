import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { getBanks, setupPayoutAccount } from "../controller/payout_ctr.js";

const router = express.Router();

router.get("/banks", authenticate, allowRoles("provider"), getBanks);
router.post("/setup", authenticate, allowRoles("provider"), setupPayoutAccount);

export default router;
