import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function LearningMode({ module, testId, day, onBack, session, language }) {
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [speechError, setSpeechError] = useState({});
  const [imageError, setImageError] = useState({});
  const [voices, setVoices] = useState([]);

  // Web Speech API 음성 목록 로드
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      const targetLang = language === "jp" ? "ja" : "en";
      setVoices(
        availableVoices.filter((voice) => voice.lang.includes(targetLang))
      );
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [language]);

  // Supabase에서 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadError(null);
        const { data, error } = await supabase
          .from("test_content")
          .select("content")
          .eq("language", language)
          .eq("module_id", module)
          .eq("test_id", testId)
          .eq("mode", "learn")
          .single();

        if (error) throw new Error(`학습 데이터 조회 실패: ${error.message}`);

        if (day) {
          setContent({ [day]: data.content[day] || [] });
        } else {
          setContent(data.content);
        }
      } catch (err) {
        setLoadError(err.message);
        setContent(null);
      }
    };
    loadData();
  }, [module, testId, day, language]);

  const speakWord = (word) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = language === "jp" ? "ja-JP" : "en-US";
      const targetVoice =
        voices.find((voice) =>
          language === "jp"
            ? voice.lang.includes("ja")
            : voice.lang.includes("en")
        ) || voices[0];
      if (targetVoice) utterance.voice = targetVoice;
      utterance.rate = 1;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error(`음성 재생 오류 (${word}):`, err);
      setSpeechError((prev) => ({
        ...prev,
        [word]: `음성 재생 실패: ${err.message}`,
      }));
    }
  };

  const handleImageError = (word) => {
    setImageError((prev) => ({
      ...prev,
      [word]: "이미지를 로드할 수 없습니다.",
    }));
  };

  const handleComplete = async () => {
    if (!session) {
      setError("로그인이 필요합니다.");
      return;
    }

    try {
      const moduleCode = `${module}-${testId}-${day || "all"}`;

      const { error } = await supabase.from("learning_progress").upsert(
        {
          user_id: session.user.email,
          module_code: moduleCode,
          language: language, // 언어 정보 추가
          day: day || null,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,module_code,language", // 충돌 시 업데이트
        }
      );

      if (error) throw new Error(`학습 완료 저장 실패: ${error.message}`);

      setCompleted(true);
      alert("학습 완료가 저장되었습니다!");
    } catch (err) {
      console.error("학습 완료 저장 오류:", err);
      setError(err.message);
    }
  };

  if (loadError) return <p className="text-red-500">{loadError}</p>;
  if (!content) return <p>로딩 중...</p>;

  return (
    <div className="learning-mode p-4">
      <button
        onClick={onBack}
        className="back-btn mb-4 p-2 bg-gray-500 text-white rounded"
      >
        ← 뒤로
      </button>

      <h1 className="text-3xl mb-6 text-center font-bold">
        학습 모드: {module} - {testId} {day ? ` - ${day}일차` : ""}
      </h1>

      <div className="space-y-6">
        {Object.entries(content).map(([dayKey, dayContent]) => (
          <div key={dayKey}>
            {!day && (
              <h2 className="text-xl font-semibold mb-4">{dayKey}일차</h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dayContent.map((item, index) => (
                <div key={index} className="bg-white p-4 rounded-lg shadow">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{item.word}</h3>
                      <p className="text-gray-600">{item.meaning}</p>
                      <p className="text-blue-600 mt-2">{item.example}</p>
                    </div>
                    <button
                      onClick={() => speakWord(item.word)}
                      className="p-2 bg-blue-100 rounded-full"
                    >
                      🔊
                    </button>
                  </div>
                  {item.image && (
                    <div className="mt-4">
                      {imageError[item.word] ? (
                        <p className="text-red-500">{imageError[item.word]}</p>
                      ) : (
                        <img
                          src={item.image}
                          alt={item.word}
                          className="max-w-full h-auto rounded"
                          onError={() => handleImageError(item.word)}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleComplete}
        disabled={completed}
        className={`mt-8 p-3 w-full rounded-lg ${
          completed ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
        } text-white font-bold`}
      >
        {completed ? "학습 완료 ✓" : "학습 완료하기"}
      </button>
    </div>
  );
}

export default LearningMode;
