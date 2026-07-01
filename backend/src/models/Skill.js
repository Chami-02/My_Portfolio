const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Skill name is required'],
      trim:     true,
      unique:   true,     // No duplicate skill names
    },
    category: {
      type:     String,
      required: [true, 'Skill category is required'],
      enum: {
        values:  ['language', 'frontend', 'backend', 'database', 'devops', 'other'],
        message: '{VALUE} is not a valid category',
      },
    },
    level: {
      type:     String,
      required: [true, 'Skill level is required'],
      enum: {
        values:  ['beginner', 'intermediate', 'advanced'],
        message: '{VALUE} is not a valid level',
      },
    },
    order: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Skill', skillSchema);