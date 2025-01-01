import mongoose from 'mongoose'; // v6.0.0
import bcrypt from 'bcrypt'; // v5.0.1
import { config } from 'dotenv'; // v16.0.0
import winston from 'winston'; // v3.8.0
import { User, UserDocument } from '../src/modules/user/schemas/user.schema';
import { Baby, BabyDocument } from '../src/modules/baby/schemas/baby.schema';
import { databaseConfig } from '../src/config/database.config';

// Initialize environment variables
config();

// Global constants
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123!';
const DEFAULT_USER_PASSWORD = process.env.USER_PASSWORD || 'user123!';
const SALT_ROUNDS = 10;
const MAX_RETRY_ATTEMPTS = 3;
const TRANSACTION_TIMEOUT = 30000;

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'seed-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'seed.log' })
  ]
});

/**
 * Creates default users with different roles
 * @returns Promise<UserDocument[]>
 */
async function seedUsers(): Promise<UserDocument[]> {
  logger.info('Starting user seeding process');
  
  const hashedAdminPassword = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS);
  const hashedUserPassword = await bcrypt.hash(DEFAULT_USER_PASSWORD, SALT_ROUNDS);

  const users = [
    // Admin user
    {
      email: 'admin@babycryanalyzer.com',
      password: hashedAdminPassword,
      name: 'System Administrator',
      roles: ['admin'],
      isActive: true
    },
    // Expert users
    {
      email: 'expert1@babycryanalyzer.com',
      password: hashedUserPassword,
      name: 'Expert One',
      roles: ['expert'],
      isActive: true
    },
    // Parent users
    {
      email: 'parent1@example.com',
      password: hashedUserPassword,
      name: 'Parent One',
      roles: ['parent'],
      isActive: true
    },
    {
      email: 'parent2@example.com',
      password: hashedUserPassword,
      name: 'Parent Two',
      roles: ['parent'],
      isActive: true
    },
    // Caregiver users
    {
      email: 'caregiver1@example.com',
      password: hashedUserPassword,
      name: 'Caregiver One',
      roles: ['caregiver'],
      isActive: true
    }
  ];

  const createdUsers = await User.create(users);
  logger.info(`Created ${createdUsers.length} users successfully`);
  return createdUsers;
}

/**
 * Creates sample baby profiles with pattern history
 * @param parentUsers - Array of parent user documents
 * @returns Promise<BabyDocument[]>
 */
async function seedBabies(parentUsers: UserDocument[]): Promise<BabyDocument[]> {
  logger.info('Starting baby profile seeding process');

  const babies = [];
  const now = new Date();

  for (const parent of parentUsers.filter(u => u.roles.includes('parent'))) {
    // Create 2 babies per parent with different ages
    const baby1BirthDate = new Date(now);
    baby1BirthDate.setMonth(now.getMonth() - 3); // 3 months old

    const baby2BirthDate = new Date(now);
    baby2BirthDate.setMonth(now.getMonth() - 8); // 8 months old

    babies.push({
      name: `Baby ${parent.name} One`,
      birthDate: baby1BirthDate,
      userId: parent._id,
      preferences: {
        backgroundMonitoring: true,
        notificationsEnabled: true,
        sensitivity: 'medium',
        noiseThreshold: 0.5,
        nightMode: false
      },
      isActive: true,
      patternHistory: {
        patterns: [
          {
            timestamp: new Date(),
            type: 'hunger',
            confidence: 0.95,
            needType: 'feeding',
            audioRef: 'sample/audio1.wav'
          },
          {
            timestamp: new Date(Date.now() - 3600000),
            type: 'discomfort',
            confidence: 0.88,
            needType: 'diaper',
            audioRef: 'sample/audio2.wav'
          }
        ],
        learningProgress: 15,
        lastUpdate: new Date()
      }
    });

    babies.push({
      name: `Baby ${parent.name} Two`,
      birthDate: baby2BirthDate,
      userId: parent._id,
      preferences: {
        backgroundMonitoring: false,
        notificationsEnabled: true,
        sensitivity: 'high',
        noiseThreshold: 0.3,
        nightMode: true
      },
      isActive: true,
      patternHistory: {
        patterns: [
          {
            timestamp: new Date(),
            type: 'tired',
            confidence: 0.92,
            needType: 'sleep',
            audioRef: 'sample/audio3.wav'
          }
        ],
        learningProgress: 10,
        lastUpdate: new Date()
      }
    });
  }

  const createdBabies = await Baby.create(babies);
  logger.info(`Created ${createdBabies.length} baby profiles successfully`);
  return createdBabies;
}

/**
 * Clears existing database collections
 */
async function clearDatabase(): Promise<void> {
  logger.info('Clearing existing database collections');
  
  const collections = ['users', 'babies'];
  for (const collection of collections) {
    try {
      await mongoose.connection.collection(collection).drop();
      logger.info(`Dropped collection: ${collection}`);
    } catch (error) {
      if (error.code !== 26) { // Collection doesn't exist error
        throw error;
      }
    }
  }
}

/**
 * Main seeding function with error handling and retries
 */
async function main() {
  let retryCount = 0;
  let session: mongoose.ClientSession | null = null;

  try {
    // Connect to database
    await mongoose.connect(databaseConfig.uri, databaseConfig.options);
    logger.info('Connected to database successfully');

    while (retryCount < MAX_RETRY_ATTEMPTS) {
      try {
        session = await mongoose.startSession();
        session.startTransaction();

        // Clear existing data
        await clearDatabase();

        // Seed users
        const users = await seedUsers();

        // Seed babies for parent users
        const parentUsers = users.filter(user => user.roles.includes('parent'));
        await seedBabies(parentUsers);

        await session.commitTransaction();
        logger.info('Database seeding completed successfully');
        break;
      } catch (error) {
        retryCount++;
        if (session) {
          await session.abortTransaction();
        }
        
        if (retryCount === MAX_RETRY_ATTEMPTS) {
          throw error;
        }
        
        logger.warn(`Seeding attempt ${retryCount} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      } finally {
        if (session) {
          session.endSession();
        }
      }
    }
  } catch (error) {
    logger.error('Fatal error during database seeding:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Database connection closed');
  }
}

// Execute seeding
if (require.main === module) {
  main().catch((error) => {
    logger.error('Seeding failed:', error);
    process.exit(1);
  });
}

export { seedUsers, seedBabies, clearDatabase };