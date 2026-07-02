import express from "express";
import { authenticate, allowRoles } from "../authMiddleWare/authGuard.js";
import { validateComplaint, validateComplaintReview } from "../authMiddleWare/validation.js";
import { createComplaint, getMyComplaints, getAllComplaints, updateComplaintStatus } from "../controller/complaint_ctr.js";

const router = express.Router();

router.post("/", authenticate, allowRoles("user", "provider"), validateComplaint, createComplaint);
router.get("/mine", authenticate, allowRoles("user", "provider"), getMyComplaints);
router.get("/", authenticate, allowRoles("admin", "owner"), getAllComplaints);
router.patch("/:id", authenticate, allowRoles("admin", "owner"), validateComplaintReview, updateComplaintStatus);

export default router;
