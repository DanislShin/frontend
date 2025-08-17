import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";
import "dotenv/config";

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// JSON 파일 디렉토리 (실제 경로로 수정)
const jsonDir = "./config"; // 예: '/Users/danielshin/Downloads/english-review-app/frontend/public/data'

// 모듈 파일만 처리
async function migrateModules() {
  try {
    // 디렉토리 읽기
    const files = await fs.readdir(jsonDir).catch((err) => {
      throw new Error(`Failed to read directory ${jsonDir}: ${err.message}`);
    });
    const moduleFiles = files.filter(
      (file) => file.startsWith("modules_") && file.endsWith(".json")
    );

    if (moduleFiles.length === 0) {
      console.log("No module files found in", jsonDir);
      return;
    }

    for (const file of moduleFiles) {
      const filePath = path.join(jsonDir, file);
      const rawData = await fs.readFile(filePath, "utf-8");
      const jsonData = JSON.parse(rawData);

      // modules 테이블 형식으로 변환 (이미 language 포함 가정)
      const transformedData = jsonData.map((item) => ({
        language: item.language || "en", // 기본값 영어
        module_id: item.module_id,
        mode: item.mode,
        tests: item.tests,
      }));

      // Supabase modules 테이블에 upsert
      const { data, error } = await supabase
        .from("modules")
        .upsert(transformedData, {
          onConflict: ["module_id", "language", "mode"],
        });

      if (error) {
        console.error(`Error upserting ${file}:`, error);
      } else {
        console.log(`Successfully upserted ${file}:`, data);
      }

      // 변환된 JSON 저장 (디버깅용)
      const outputFile = path.join(jsonDir, `transformed_${file}`);
      await fs.writeFile(outputFile, JSON.stringify(transformedData, null, 2));
      console.log(`Saved transformed file: ${outputFile}`);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

migrateModules();
