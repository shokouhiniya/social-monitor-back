import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { User } from './modules/user/user.entity';
import { hashPassword } from './users/password.util';

loadEnv();

/**
 * اسکریپت seed کاربرانِ هر نقش محصول جدید میکرورسانه (micromedia-transformation).
 *
 * برای هر نقش یک کاربر با یوزرنیم/پسورد مشخص می‌سازد تا برای تحویل به کارفرما
 * استفاده شود. **idempotent**: اگر username موجود باشد، نقش و رمز عبور به‌روزرسانی
 * می‌شود (اجرای دوباره امن است). رمز عبور با همان `hashPassword` (scrypt) پروژه
 * هش می‌شود تا با login سازگار باشد.
 *
 * اجرا (پس از build):  node dist/seed-users
 * یا از طریق npm:       npm run seed:users:prod
 */

interface SeedUser {
  name: string;
  username: string;
  password: string;
  role: string;
  phone: string;
}

const USERS: SeedUser[] = [
  { name: 'مدیر کل سیستم', username: 'superadmin', password: 'SuperAdmin@1404', role: 'super_admin', phone: '+989000000001' },
  { name: 'مدیر عملیات', username: 'ops_manager', password: 'OpsManager@1404', role: 'operations_manager', phone: '+989000000002' },
  { name: 'مدیر هاب', username: 'hub_manager', password: 'HubManager@1404', role: 'hub_manager', phone: '+989000000003' },
  { name: 'کارشناس هاب', username: 'hub_expert', password: 'HubExpert@1404', role: 'hub_expert', phone: '+989000000004' },
  { name: 'بیننده', username: 'viewer', password: 'Viewer@1404', role: 'viewer', phone: '+989000000005' },
];

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'secret',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'postgres',
  entities: [User],
  synchronize: false,
});

async function seedUsers(): Promise<void> {
  await dataSource.initialize();
  const repo = dataSource.getRepository(User);

  console.log('🌱 Seeding role users...\n');
  for (const u of USERS) {
    const password_hash = await hashPassword(u.password);
    const existing = await repo.findOne({ where: { username: u.username } });

    if (existing) {
      existing.name = u.name;
      existing.role = u.role;
      existing.password_hash = password_hash;
      existing.is_active = true;
      await repo.save(existing);
      console.log(`♻️  updated: ${u.username} (${u.role})`);
    } else {
      const user = repo.create({
        name: u.name,
        username: u.username,
        password_hash,
        role: u.role,
        phone: u.phone,
        is_active: true,
      });
      await repo.save(user);
      console.log(`✅ created: ${u.username} (${u.role})`);
    }
  }

  console.log('\n=== Credentials (deliver to client; ask them to change) ===');
  for (const u of USERS) {
    console.log(`${u.role.padEnd(20)} | username: ${u.username.padEnd(12)} | password: ${u.password}`);
  }

  await dataSource.destroy();
}

seedUsers()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed users failed:', err);
    process.exit(1);
  });
