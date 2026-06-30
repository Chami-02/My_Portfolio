const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Name is required'],
      trim:      true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type:      String,
      required:  [true, 'Email is required'],
      trim:      true,
      lowercase: true,
      match:     [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    message: {
      type:      String,
      required:  [true, 'Message is required'],
      trim:      true,
      minlength: [10, 'Message must be at least 10 characters'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    read: {
      type:    Boolean,
      default: false,     // Shows as unread in admin panel
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);