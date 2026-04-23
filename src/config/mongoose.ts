import mongoose from 'mongoose';
import { config } from './index';

const uri = config.DATABASE_URL || 'mongodb://localhost:27017/siteSock';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      bufferCommands: false, // Disable mongoose buffering
    });

    // Add connection event listeners
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });

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
