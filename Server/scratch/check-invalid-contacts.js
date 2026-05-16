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

  const count = await Contact.countDocuments({
    $or: [
      { email: null },
      { email: '' },
      { email: { $exists: false } }
    ]
  });

  console.log(`Contacts with missing email: ${count}`);

  const sample = await Contact.find({
    $or: [
      { email: null },
      { email: '' },
      { email: { $exists: false } }
    ]
  }).limit(5).lean().exec();

  console.log('Sample invalid contacts:', JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
