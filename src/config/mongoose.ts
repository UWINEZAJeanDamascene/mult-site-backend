import mongoose from 'mongoose';
import { config } from './index';

const uri = config.DATABASE_URL || 'mongodb://localhost:27017/siteSock';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB via Mongoose');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

export default mongoose;
