module.exports = {
  description: 'Add version tracking to contracts',

  async up(session) {
    const Contract = mongoose.model('Contract');
    
    // Initialize version numbers for existing contracts
    await Contract.updateMany(
      { version: { $exists: false } },
      {
        $set: {
          version: 1,
          versionHistory: [],
          isDraft: false
        }
      },
      { session }
    );

    // Create ContractVersion collection
    const versionSchema = new mongoose.Schema({
      contract: { type: mongoose.Schema.Types.ObjectId, ref: 'Contract', required: true },
      version: { type: Number, required: true },
      content: { type: String, required: true },
      changes: mongoose.Schema.Types.Mixed,
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
      metadata: mongoose.Schema.Types.Mixed
    });

    // Create indexes
    versionSchema.index({ contract: 1, version: -1 });
    versionSchema.index({ createdAt: -1 });

    mongoose.model('ContractVersion', versionSchema);

    return {
      contractsUpdated: await Contract.countDocuments({}, { session }),
      versionCollectionCreated: true
    };
  },

  async down(session) {
    const Contract = mongoose.model('Contract');
    
    // Remove version fields
    await Contract.updateMany(
      {},
      {
        $unset: {
          version: 1,
          versionHistory: 1,
          isDraft: 1
        }
      },
      { session }
    );

    // Drop ContractVersion collection
    await mongoose.connection.dropCollection('contractversions');

    return {
      versionFieldsRemoved: true,
      versionCollectionDropped: true
    };
  }
};