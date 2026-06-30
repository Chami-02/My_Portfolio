const mongoose = require('mongoose');

const aboutSchema = new mongoose.Schema(
  {
    // Basic info
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      default:  'Parindra Chameekara Gallage',
    },
    title: {
      type:    String,
      trim:    true,
      default: 'Full-Stack Developer',
    },
    location: {
      type:    String,
      trim:    true,
      default: 'Galle,Sri Lanka',
    },
    email: {
      type:    String,
      trim:    true,
      default: 'parindrachameekara@gmail.com',
    },

    // Bio paragraphs — each element is one paragraph
    bio: {
      type:    [String],
      default: [
        "I'm a self-taught developer based in Sri Lanka, building my skills one real project at a time.",
        "This portfolio is not a template — it's a live MERN application tracked in Jira, containerized with Docker, and deployed through a CI/CD pipeline.",
      ],
    },

    // Availability for hire
    availableForWork: {
      type:    Boolean,
      default: true,
    },
    availabilityNote: {
      type:    String,
      default: 'Currently open to junior developer roles',
    },

    // Profile image
    avatarUrl: {
      type:    String,
      default: null,
    },

    // CV/Resume
    cvUrl: {
      type:    String,
      default: null,
    },

    // Social links
    social: {
      github:   { type: String, default: 'https://github.com/Chami-02' },
      linkedin: { type: String, default: 'https://www.linkedin.com/in/chamikara-gallege-3b0861295/' },
      facebook: { type: String, default: 'https://web.facebook.com/parindra.chameekara'},
      instagram:{ type: String, default: 'https://www.instagram.com/__pc_02/' },
      email:    { type: String, default: 'parindrachameekara@gmail.com' },
    },

    // Stats shown in the About section cards
    stats: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('About', aboutSchema);