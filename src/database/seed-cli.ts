import { seedDemoData } from './seed';
import { getDatabasePath } from './connection';

console.log('Seeding DukaanLens demo data...');
try {
  seedDemoData();
  console.log(`Successfully seeded demo data into ${getDatabasePath()}`);
  console.log('Default credentials: username=admin, password=dukaan123');
} catch (error) {
  console.error('Failed to seed demo data:', error);
  process.exit(1);
}
