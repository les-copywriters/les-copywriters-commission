const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSalesDates() {
  const { data, error } = await supabase
    .from('sales')
    .select('client_name, date, created_at')
    .order('date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Latest Sales Dates:');
  console.table(data);
}

checkSalesDates();
