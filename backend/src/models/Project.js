const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Project title is required'],
      trim:      true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    description: {
      type:      String,
      required:  [true, 'Project description is required'],
      trim:      true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    tech: {
      type:     [String],
      required: [true, 'At least one technology is required'],
      validate: {
        validator: (arr) => arr.length > 0,
        message:   'Tech array cannot be empty',
      },
    },
    githubUrl: {
      type:     String,
      required: [true, 'GitHub URL is required'],
      trim:     true,
    },
    liveUrl: {
      type:    String,
      default: null,
      trim:    true,
    },
    imageUrl: {
      type:    String,
      default: null,
    },
    featured: {
      type:    Boolean,
      default: false,
    },
    order: {
      type:    Number,
      default: 0,
    },
  },
  { timestamps: true }  // Adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('Project', projectSchema);