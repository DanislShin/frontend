import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function LearningMode({ module, testId, day, onBack, session }) {
  const [content, setContent] = useState([]);
  const [error, setError] = useState(null);
  const [speechError, setSpeechError] = useState({});
  const [imageError, setImageError] = useState({});
  const [voices, setVoices] = useState([]);

  // Web Speech API 음성 목록 로드
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices.filter((voice) => voice.lang.includes("en")));
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Supabase에서 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data, error } = await supabase
          .from("test_content")
          .select("content")
          .eq("language", "en")
          .eq("module_id", module)
          .eq("test_id", testId)
          .eq("mode", "learn")
          .single();
        if (error) throw new Error(`학습 데이터 조회 실패: ${error.message}`);

        if (day) {
          setContent(data.content[day] || []);
        } else {
          const allContent = Object.values(data.content).flat();
          setContent(allContent);
        }
      } catch (err) {
        console.error(`데이터 로드 오류:`, err);
        setError(err.message);
        setContent([]);
      }
    };
    loadData();
  }, [module, testId, day]);

  const handleComplete = async () => {
    if (!session) {
      setError("로그인이 필요합니다.");
      console.error("No session");
      return;
    }
    try {
      const { data, error } = await supabase.from("learning_progress").insert({
        user_id: session.user.email,
        module_code: `${module}-${testId}-${day || "all"}`,
        day: day || null,
        completed: true,
        completed_at: new Date().toISOString(),
      });
      if (error) throw new Error(`저장 실패: ${error.message}`);
      console.log("Insert successful:", data);
      alert("학습 완료가 저장되었습니다!");
    } catch (err) {
      console.error("Error in handleComplete:", err);
      setError(`저장 실패: ${err.message}`);
    }
  };

  const speakWord = (word) => {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US";
      const enVoice =
        voices.find((voice) => voice.lang === "en-US") || voices[0];
      if (enVoice) utterance.voice = enVoice;
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

  return (
    <div className="learning-container">
      <button onClick={onBack}>뒤로 가기</button>
      <h1>
        학습 모드: {module} - {testId} {day ? ` - ${day}일차` : ""}
      </h1>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {content.length === 0 ? (
        <p>학습 자료를 로딩 중이거나 자료가 없습니다...</p>
      ) : (
        <div>
          {content.map((item, index) => (
            <div key={index} style={{ marginBottom: "20px" }}>
              <h3>{item.word}</h3>
              <p>{item.meaning}</p>
              <p>예문: {item.example}</p>
              <div>
                <button onClick={() => speakWord(item.word)}>
                  {speechError[item.word] ? "음성 재생 실패" : "단어 읽기"}
                </button>
                {speechError[item.word] && (
                  <p style={{ color: "red" }}>{speechError[item.word]}</p>
                )}
              </div>
              {item.image && (
                <div>
                  {imageError[item.word] ? (
                    <p style={{ color: "red" }}>{imageError[item.word]}</p>
                  ) : (
                    <img
                      src={item.image}
                      alt={item.word}
                      style={{ maxWidth: "200px", marginTop: "10px" }}
                      onError={() => handleImageError(item.word)}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
          <button onClick={handleComplete}>학습 완료</button>
        </div>
      )}
    </div>
  );
}

export default LearningMode;
