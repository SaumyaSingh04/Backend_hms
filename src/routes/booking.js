const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Book a room (admin or staff from 'reception')
router.post(
  "/book",
  bookingController.bookRoom
);

// ✅ Get all bookings (admin or staff from 'reception')
router.get(
  "/all",
  bookingController.getBookings
);

// ✅ Get bookings by category (admin or staff from 'reception')
router.get(
  "/category/:categoryId",
  bookingController.getBookingsByCategory
);

// get by grc number
router.get(
  "/grc/:grcNo",
  bookingController.getBookingByGRC
);

// ✅ Get booking by ID (admin or staff from 'reception')
router.get(
  "/:bookingId",
  bookingController.getBookingById
);

// ✅ Unbook (soft delete) (admin or staff from 'reception')
router.delete(
  "/unbook/:bookingId",
  bookingController.deleteBooking
);

// ✅ Permanently delete (admin only)
router.delete(
  "/delete/:bookingId",
  authMiddleware(["admin"]),
  bookingController.permanentlyDeleteBooking
);

// ✅ Update booking (admin or staff from 'reception')
router.put(
  "/update/:bookingId",
  bookingController.updateBooking
);

// ✅ Extend booking (admin or staff from 'reception')
router.post(
  "/extend/:bookingId",
  bookingController.extendBooking
);

module.exports = router;
