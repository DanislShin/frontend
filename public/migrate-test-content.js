import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import "dotenv/config";

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// JSON 파일 디렉토리
const jsonDir = "./data";

// 변환된 테스트 파일 처리
async function migrateTestContent() {
  try {
    const files = await fs.readdir(jsonDir).catch((err) => {
      throw new Error(`Failed to read directory ${jsonDir}: ${err.message}`);
    });
    console.log("Files in directory:", files);

    const testContentFiles = files.filter(
      (file) => file.startsWith("test_content_") && file.endsWith(".json")
    );

    if (testContentFiles.length === 0) {
      console.log(
        `No test content files found in ${jsonDir}. Available files:`,
        files
      );
      return;
    }

    for (const file of testContentFiles) {
      try {
        const filePath = path.join(jsonDir, file);
        const rawData = await fs.readFile(filePath, "utf-8");
        const jsonData = JSON.parse(rawData);

        // 내부 데이터에서 추출 (첫 번째 객체 사용)
        const { language, module_id, test_id, mode, content } = jsonData[0];
        console.log(`Processing ${file}:`, {
          language,
          module_id,
          test_id,
          mode,
        });

        // 일관된 구조로 변환 (mode 상단 고정)
        const transformedData = [
          {
            language,
            module_id,
            test_id,
            mode,
            content,
          },
        ];
        console.log("Transformed data:", transformedData);

        const { data, error } = await supabase
          .from("test_content")
          .upsert(transformedData, {
            onConflict: ["module_id", "test_id", "language", "mode"],
          });

        if (error) {
          console.error(`Error upserting ${file} to test_content:`, error);
        } else {
          console.log(`Successfully upserted ${file} to test_content:`, data);
        }

        // 일관된 순서로 저장
        const outputFile = path.join(jsonDir, `processed_${file}`);
        await fs.writeFile(
          outputFile,
          JSON.stringify(transformedData, null, 2)
        );
        console.log(`Saved processed file: ${outputFile}`);
      } catch (err) {
        console.error(`Skipping ${file} due to error:`, err.message);
        continue;
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

migrateTestContent();
