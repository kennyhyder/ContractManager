const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const userData = [
  {
    email: 'admin@example.com',
    password: 'Admin123!',
    name: 'Admin User',
    role: 'admin',
    isActive: true,
    isVerified: true,
    company: 'Contract Management Inc.',
    jobTitle: 'System Administrator',
    department: 'IT',
    profilePicture: 'https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff'
  },
  {
    email: 'john.doe@example.com',
    password: 'User123!',
    name: 'John Doe',
    role: 'user',
    isActive: true,
    isVerified: true,
    company: 'Acme Corporation',
    jobTitle: 'Legal Manager',
    department: 'Legal',
    profilePicture: 'https://ui-avatars.com/api/?name=John+Doe&background=28A745&color=fff'
  },
  {
    email: 'jane.smith@example.com',
    password: 'User123!',
    name: 'Jane Smith',
    role: 'user',
    isActive: true,
    isVerified: true,
    company: 'Tech Solutions Ltd.',
    jobTitle: 'Contract Specialist',
    department: 'Procurement',
    profilePicture: 'https://ui-avatars.com/api/?name=Jane+Smith&background=DC3545&color=fff'
  },
  {
    email: 'mike.wilson@example.com',
    password: 'User123!',
    name: 'Mike Wilson',
    role: 'user',
    isActive: true,
    isVerified: true,
    company: 'Global Enterprises',
    jobTitle: 'Business Development Manager',
    department: 'Sales',
    profilePicture: 'https://ui-avatars.com/api/?name=Mike+Wilson&background=FFC107&color=fff'
  },
  {
    email: 'sarah.johnson@example.com',
    password: 'User123!',
    name: 'Sarah Johnson',
    role: 'manager',
    isActive: true,
    isVerified: true,
    company: 'Contract Management Inc.',
    jobTitle: 'Operations Manager',
    department: 'Operations',
    profilePicture: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=6610F2&color=fff'
  }
];

module.exports = {
  async seed() {
    try {
      // Check if users already exist
      const existingUsers = await User.countDocuments();
      if (existingUsers > 0) {
        logger.info('Users already exist, skipping seed');
        return { skipped: true, reason: 'Users already exist' };
      }

      // Hash passwords
      const users = await Promise.all(userData.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        return { ...user, password: hashedPassword };
      }));

      // Create users
      const createdUsers = await User.insertMany(users);

      // Add some relationships (e.g., following)
      const [admin, john, jane, mike, sarah] = createdUsers;

      // Admin follows everyone
      admin.following = [john._id, jane._id, mike._id, sarah._id];
      await admin.save();

      // Some mutual follows
      john.following = [jane._id, mike._id];
      jane.following = [john._id, sarah._id];
      mike.following = [john._id];
      sarah.following = [jane._id];

      await Promise.all([john.save(), jane.save(), mike.save(), sarah.save()]);

      return {
        created: createdUsers.length,
        users: createdUsers.map(u => ({
          id: u._id,
          email: u.email,
          name: u.name,
          role: u.role
        }))
      };
    } catch (error) {
      logger.error('Error seeding users:', error);
      throw error;
    }
  },

  async clean() {
    try {
      const result = await User.deleteMany({
        email: { $in: userData.map(u => u.email) }
      });

      return {
        deleted: result.deletedCount
      };
    } catch (error) {
      logger.error('Error cleaning users:', error);
      throw error;
    }
  }
};