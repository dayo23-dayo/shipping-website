const supabase = require('../src/supabase');

async function main() {
  const tables = {
    shipments: 'id,tracking_number,status,current_location,updated_at',
    tracking_events: 'id,shipment_id,status,location,occurred_at',
    messages: 'id,customer_email,sender_type,message,created_at',
  };
  let failed = false;

  for (const [table, columns] of Object.entries(tables)) {
    const { error } = await supabase.from(table).select(columns, { count: 'exact', head: true });
    if (error) {
      failed = true;
      const detail = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' - ');
      console.error(`${table}: ${detail || 'schema does not match'}`);
    } else {
      console.log(`${table}: ready`);
    }
  }

  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
