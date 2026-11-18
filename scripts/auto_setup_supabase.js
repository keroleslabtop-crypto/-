require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.log('\n❌ يرجى وضع رابط الاتصال بقاعدة بيانات سوبابيز DATABASE_URL داخل ملف .env\n');
    console.log('يمكنك الحصول عليه من: Supabase -> Project Settings -> Database -> Connection string -> URI\n');
    process.exit(1);
  }

  console.log('🔄 جاري الاتصال بقاعدة بيانات Supabase...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ تم الاتصال بنجاح بقاعدة بيانات Supabase!');

    console.log('🔄 جاري إنشاء الجداول وحقن الـ 21 أصحاح والأسئلة وحساب الأدمن...');
    const sqlPath = path.join(__dirname, '../supabase_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);

    console.log('\n🎉 تم إعداد قاعدة البيانات بالكامل بنجاح!');
    console.log('1. تم إنشاء جداول المستخدمين والأصحاحات والأسئلة والنتائج.');
    console.log('2. تم تسجيل الأصحاحات الـ 21 بالكامل.');
    console.log('3. تم إنشاء حساب الأدمن (admin / admin123).');
    console.log('4. الموقع الآن مربوط سحابياً بالكامل بـ Supabase 🚀\n');
  } catch (err) {
    console.error('❌ حدث خطأ أثناء تنفيذ الأوامر:', err.message);
  } finally {
    await client.end();
  }
}

run();
