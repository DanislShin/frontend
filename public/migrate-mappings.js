// migrate-mappings.js
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

async function migrateMappings() {
  const data = JSON.parse(fs.readFileSync("mappings.json"));
  const inserts = data.map((row) => ({
    language: row.language,
    type: row.type,
    key: row.key,
    value: row.value,
  }));

  const { error } = await supabase.from("mappings").insert(inserts);
  if (error) {
    console.error("삽입 오류:", error);
    return;
  }
  console.log("매핑 삽입 완료:", inserts.length);
}

migrateMappings();
