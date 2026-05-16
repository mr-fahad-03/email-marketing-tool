const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error('MONGODB_URI not found in .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const contactSchema = new mongoose.Schema({}, { strict: false, collection: 'contacts' });
  const Contact = mongoose.model('Contact', contactSchema);

  const filter = {
    $or: [
      { email: null },
      { email: '' },
      { email: { $exists: false } },
      { email: /^\s*$/ }
    ]
  };

  const countBefore = await Contact.countDocuments(filter);
  console.log(`Found ${countBefore} invalid contacts to delete.`);

  if (countBefore > 0) {
    const result = await Contact.deleteMany(filter);
    console.log(`Deleted ${result.deletedCount} invalid contacts.`);
  } else {
    console.log('No invalid contacts found.');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
