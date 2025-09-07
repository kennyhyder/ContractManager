module.exports = {
  description: 'Add two-factor authentication fields to User model',

  async up(session) {
    const User = mongoose.model('User');
    
    // Add 2FA fields to all existing users
    await User.updateMany(
      {},
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          backupCodes: [],
          lastBackupCodeUsed: null
        }
      },
      { session }
    );

    return {
      usersUpdated: await User.countDocuments({}, { session })
    };
  },

  async down(session) {
    const User = mongoose.model('User');
    
    // Remove 2FA fields
    await User.updateMany(
      {},
      {
        $unset: {
          twoFactorEnabled: 1,
          twoFactorSecret: 1,
          backupCodes: 1,
          lastBackupCodeUsed: 1
        }
      },
      { session }
    );

    return {
      fieldsRemoved: true
    };
  }
};