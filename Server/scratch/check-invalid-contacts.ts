import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ContactsService } from '../src/modules/contacts/contacts.service';
import { getModelToken } from '@nestjs/mongoose';
import { Contact } from '../src/modules/contacts/schemas/contact.schema';
import { Model } from 'mongoose';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const contactModel = app.get<Model<Contact>>(getModelToken(Contact.name));

  const count = await contactModel.countDocuments({
    $or: [
      { email: null },
      { email: '' },
      { email: { $exists: false } }
    ]
  });

  console.log(`Contacts with missing email: ${count}`);

  const sample = await contactModel.find({
    $or: [
      { email: null },
      { email: '' },
      { email: { $exists: false } }
    ]
  }).limit(5).exec();

  console.log('Sample invalid contacts:', JSON.stringify(sample, null, 2));

  await app.close();
}

run().catch(console.error);
