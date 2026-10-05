const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Skill name is required'],
      trim:     true,
      unique:   true,     // No duplicate skill names
    },
    // PF-114 — the KEY of a SkillCategory (an owner-managed section). No enum
    // any more: the list lives in the database. ⚠️ Existence is checked in
    // skillController on every API write (an async schema validator would also
    // run on every test fixture and seed insert, which write trusted keys).
    category: {
      type:     String,
      required: [true, 'Skill category is required'],
      trim:     true,
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