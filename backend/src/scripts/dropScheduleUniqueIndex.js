import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function dropScheduleUniqueIndex() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('schedules');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes);

    // Drop the unique index if it exists
    try {
      await collection.dropIndex('employeeName_1_date_1');
      console.log('✅ Successfully dropped unique index: employeeName_1_date_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Index does not exist, skipping...');
      } else {
        throw error;
      }
    }

    // Create a non-unique index instead
    await collection.createIndex({ employeeName: 1, date: 1 });
    console.log('✅ Created non-unique index: employeeName_1_date_1');

    // Verify the new indexes
    const newIndexes = await collection.indexes();
    console.log('New indexes:', newIndexes);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

dropScheduleUniqueIndex();

