require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
// Use service_role / secret key for backend if available, fallback to anon
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-project-id')) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  console.log('✅ تم تفعيل الربط السحابي مع Supabase بنجاح باستخدام المفتاح السري!');
} else {
  console.log('ℹ️ لم يتم العثور على مفاتيح Supabase في .env - التطبيق يعمل على قاعدة البيانات المحلية SQLite.');
}

module.exports = supabase;
