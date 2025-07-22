const Booking = require("../models/Booking.js");
const Category = require("../models/Category.js");
const Room = require("../models/Room.js");
const Housekeeping = require("../models/Housekeeping.js");

// 🔹 Generate unique GRC number
const generateGRC = async () => {
  let grcNo, exists = true;
  while (exists) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    grcNo = `GRC-${rand}`;
    exists = await Booking.findOne({ grcNo });
  }
  return grcNo;
};

// Book a room for a category (single or multiple)
exports.bookRoom = async (req, res) => {
  try {
    const handleBooking = async (categoryId, count, extraDetails = {}) => {
      const category = await Category.findById(categoryId);
      if (!category) throw new Error(`Category not found: ${categoryId}`);

      const availableRooms = await Room.find({ category: categoryId, status: 'available' }).limit(count);
      if (availableRooms.length < count) {
        throw new Error(`Not enough available rooms in ${category.name}`);
      }

      const bookedRoomNumbers = [];
      for (let i = 0; i < availableRooms.length; i++) {
        const room = availableRooms[i];
        const referenceNumber = `REF-${Math.floor(100000 + Math.random() * 900000)}`;
        const grcNo = await generateGRC();
        const reservationId = extraDetails.reservationId || null;

        const booking = new Booking({
          grcNo,
          reservationId,
          category: categoryId,
          roomNumber: room.room_number,
          isActive: true,
          numberOfRooms: 1,
          referenceNumber,
          guestDetails: extraDetails.guestDetails,
          contactDetails: extraDetails.contactDetails,
          identityDetails: extraDetails.identityDetails,
          bookingInfo: extraDetails.bookingInfo,
          paymentDetails: extraDetails.paymentDetails,
          vehicleDetails: extraDetails.vehicleDetails || {},
          vip: extraDetails.vip || false
        });

        await booking.save();

        // Set Room.status to 'booked'
        room.status = 'booked';
        await room.save();
        bookedRoomNumbers.push(room.room_number);
      }

      const bookings = await Booking.find({
        roomNumber: { $in: bookedRoomNumbers },
        category: categoryId
      });

      return bookings;
    };

    // 🔹 Multiple Bookings
    if (Array.isArray(req.body.bookings)) {
      const results = [];
      for (const item of req.body.bookings) {
        const { categoryId, count, ...extraDetails } = item;
        const bookings = await handleBooking(categoryId, count, extraDetails);
        results.push(...bookings);
      }
      return res.status(201).json({ success: true, booked: results });
    }

    // 🔹 Single Booking
    const {
      categoryId,
      count,
      guestDetails,
      contactDetails,
      identityDetails,
      bookingInfo,
      paymentDetails,
      vehicleDetails,
      vip,
      reservationId
    } = req.body;

    if (!categoryId) return res.status(400).json({ error: 'categoryId is required' });

    const numRooms = count && Number.isInteger(count) && count > 0 ? count : 1;

    const bookings = await handleBooking(categoryId, numRooms, {
      guestDetails,
      contactDetails,
      identityDetails,
      bookingInfo,
      paymentDetails,
      vehicleDetails,
      vip,
      reservationId
    });

    return res.status(201).json({ success: true, booked: bookings });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 🔹 Get all bookings
exports.getBookings = async (req, res) => {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const bookings = await Booking.find(filter).populate('categoryId');
    
    // Map bookings to ensure safe access to category properties
    const safeBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      if (!bookingObj.category) {
        bookingObj.category = { name: 'Unknown' };
      }
      return bookingObj;
    });
    
    res.json(safeBookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔹 Get bookings by category
exports.getBookingsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const bookings = await Booking.find({ category: categoryId }).populate('categoryId');
    
    // Map bookings to ensure safe access to category properties
    const safeBookings = bookings.map(booking => {
      const bookingObj = booking.toObject();
      if (!bookingObj.category) {
        bookingObj.category = { name: 'Unknown' };
      }
      return bookingObj;
    });
    
    res.json(safeBookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔹 Unbook (soft delete)
exports.deleteBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Even if booking is already inactive, proceed with room status update
    if (!booking.isActive) {
      console.log('Note: Booking was already inactive, proceeding with room status update');
    } else {
      booking.isActive = false;
      await booking.save();
    }

    // Find the room associated with this booking
    // Try to find by room number first
    let room = await Room.findOne({ room_number: String(booking.roomNumber) });
    
    // If not found, try with category as well
    if (!room && booking.category) {
      room = await Room.findOne({ 
        category: booking.category, 
        room_number: String(booking.roomNumber) 
      });
    }
    
    // If still not found, try direct lookup by room number as number
    if (!room) {
      room = await Room.findOne({ room_number: booking.roomNumber });
    }

    if (room) {
      // Set Room.status to 'maintenance' when unbooking
      room.status = 'maintenance';
      await room.save();

      // Check if a housekeeping task already exists for this room
      const existingTask = await Housekeeping.findOne({
        roomId: room._id,
        status: { $in: ['pending', 'in-progress'] }
      });

      if (!existingTask) {
        // Create a housekeeping task for this room
        const housekeepingTask = new Housekeeping({
          roomId: room._id,
          cleaningType: 'checkout',
          notes: 'Room needs cleaning after checkout',
          priority: 'high',
          status: 'pending'
        });

        await housekeepingTask.save();
      }
    }

    res.json({ 
      success: true, 
      message: 'Room set to maintenance status. Housekeeping task created.' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔹 PERMANENT DELETE
exports.permanentlyDeleteBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const deleted = await Booking.findByIdAndDelete(bookingId);
    if (!deleted) return res.status(404).json({ error: 'Booking not found' });

    res.json({ success: true, message: 'Booking permanently deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 🔹 Update booking
exports.updateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const updates = req.body;

    // Fields that cannot be updated directly
    const restrictedFields = ['isActive', 'referenceNumber', 'createdAt', '_id', 'grcNo'];
    restrictedFields.forEach(field => delete updates[field]);

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // 💬 Update allowed nested object fields
    if (updates.guestDetails) {
      if (!booking.guestDetails) booking.guestDetails = {};
      Object.assign(booking.guestDetails, updates.guestDetails);
    }

    if (updates.contactDetails) {
      if (!booking.contactDetails) booking.contactDetails = {};
      Object.assign(booking.contactDetails, updates.contactDetails);
    }

    if (updates.identityDetails) {
      if (!booking.identityDetails) booking.identityDetails = {};
      Object.assign(booking.identityDetails, updates.identityDetails);
    }

    if (updates.bookingInfo) {
      if (!booking.bookingInfo) booking.bookingInfo = {};
      Object.assign(booking.bookingInfo, updates.bookingInfo);
    }

    if (updates.paymentDetails) {
      if (!booking.paymentDetails) booking.paymentDetails = {};
      Object.assign(booking.paymentDetails, updates.paymentDetails);
    }

    if (updates.vehicleDetails) {
      if (!booking.vehicleDetails) booking.vehicleDetails = {};
      Object.assign(booking.vehicleDetails, updates.vehicleDetails);
    }

    // 💬 Update simple fields
    if (updates.roomNumber) booking.roomNumber = updates.roomNumber;
    if (updates.numberOfRooms) booking.numberOfRooms = updates.numberOfRooms;
    if (typeof updates.vip !== 'undefined') booking.vip = updates.vip;
    if (updates.reservationId) booking.reservationId = updates.reservationId;
    if (updates.status) booking.status = updates.status;

    // 💬 Optional: Update actual check-in/out times (if passed)
    if (updates.actualCheckInTime) booking.bookingInfo.actualCheckInTime = new Date(updates.actualCheckInTime);
    if (updates.actualCheckOutTime) booking.bookingInfo.actualCheckOutTime = new Date(updates.actualCheckOutTime);

    // 💬 Handle extensions
    if (updates.extendedCheckOut) {
      const originalCheckIn = booking.bookingInfo.checkIn;
      const originalCheckOut = booking.bookingInfo.checkOut;

      booking.extensionHistory.push({
        originalCheckIn,
        originalCheckOut,
        extendedCheckOut: new Date(updates.extendedCheckOut),
        reason: updates.reason,
        additionalAmount: updates.additionalAmount,
        paymentMode: updates.paymentMode,
        approvedBy: updates.approvedBy
      });

      booking.bookingInfo.checkOut = new Date(updates.extendedCheckOut);

      if (updates.additionalAmount) {
        booking.paymentDetails.totalAmount = (booking.paymentDetails.totalAmount || 0) + updates.additionalAmount;
      }
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Booking updated successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// 🔹 Extend booking stay
exports.extendBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { extendedCheckOut, reason, additionalAmount, paymentMode, approvedBy } = req.body;
    
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    if (!booking.isActive) {
      return res.status(400).json({ error: 'Cannot extend inactive booking' });
    }
    
    // Save original check-in and checkout date
    const originalCheckIn = booking.bookingInfo.checkIn;
    const originalCheckOut = booking.bookingInfo.checkOut;

    // Add to extension history
    booking.extensionHistory.push({
      originalCheckIn,
      originalCheckOut,
      extendedCheckOut: new Date(extendedCheckOut),
      reason,
      additionalAmount,
      paymentMode,
      approvedBy
    });
    
    // Update checkout date
    booking.bookingInfo.checkOut = new Date(extendedCheckOut);
    
    // Update payment if provided
    if (additionalAmount) {
      booking.paymentDetails.totalAmount = 
        (booking.paymentDetails.totalAmount || 0) + additionalAmount;
    }
    
    await booking.save();
    
    res.json({ 
      success: true, 
      message: 'Booking extended successfully',
      booking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get booking by GRC Number
exports.getBookingByGRC = async (req, res) => {
  try {
    const { grcNo } = req.params;

    const booking = await Booking.findOne({ grcNo }).populate('categoryId');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found with given GRC' });
    }

    const result = booking.toObject();
    if (!result.categoryId) {
      result.categoryId = { name: 'Unknown' };
    }

    res.json({ success: true, booking: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get booking by Booking ID
exports.getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId).populate('categoryId');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const result = booking.toObject();
    if (!result.categoryId) {
      result.categoryId = { name: 'Unknown' };
    }

    res.json({ success: true, booking: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
