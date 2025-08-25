import React, { useState, useEffect } from "react";

const ReadingLearning = ({
  module,
  testId,
  supabase,
  session,
  language,
  onBack,
}) => {
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeSection, setActiveSection] = useState("reading");
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const loadContent = async () => {
      try {
        const { data, error } = await supabase
          .from("test_content")
          .select("content")
          .eq("module_id", module)
          .eq("test_id", testId)
          .eq("language", language)
          .eq("mode", "learn")
          .single();
        if (error) throw error;
        setContent(data.content);
      } catch (err) {
        setLoadError(err.message);
      }
    };
    loadContent();
  }, [module, testId, language, supabase]);

  const handlePronounce = (text, rate = 0.7) => {
    const utterance = new SpeechSynthesisUtterance(text);

    // 언어 코드에 따른 TTS 언어 설정
    switch (language) {
      case "en":
        utterance.lang = "en-US";
        break;
      case "jp":
        utterance.lang = "ja-JP";
        break;
      case "ch":
        utterance.lang = "zh-CN"; // 중국어 간체
        break;
      case "sp":
        utterance.lang = "es-ES"; // 스페인어
        break;
      default:
        utterance.lang = "en-US";
    }

    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  };

  const handleComplete = async () => {
    if (!session) return;
    try {
      const moduleCode = `${module}-${testId}-all`;
      const { error } = await supabase.from("learning_progress").upsert(
        {
          user_id: session.user.email,
          module_code: moduleCode,
          language: language,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id, module_code, language" }
      );
      if (error) throw error;
      setCompleted(true);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  if (loadError) return <p className="text-red-500">{loadError}</p>;
  if (!content) return <p>Loading...</p>;

  const isArray = Array.isArray(content);
  const current = isArray ? content[activeIndex] : content;

  // 언어에 따른 텍스트 필드 선택
  const getTextContent = (para) => {
    switch (language) {
      case "en":
        return { text: para.english, pronunciation: para.pronunciation };
      case "jp":
        return { text: para.japanese, pronunciation: para.pronunciation };
      case "ch":
        return { text: para.chinese, pronunciation: para.pronunciation };
      case "sp":
        return { text: para.spanish, pronunciation: para.pronunciation };
      default:
        return { text: para.english, pronunciation: para.pronunciation };
    }
  };

  return (
    <div className="reading-learning p-4 max-w-4xl mx-auto">
      <button
        onClick={onBack}
        className="back-btn mb-4 p-2 bg-gray-500 text-white rounded"
      >
        ← 뒤로
      </button>

      {isArray && (
        <div className="flex space-x-2 mb-6">
          {content.map((section, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`px-4 py-2 rounded-lg ${
                activeIndex === idx
                  ? "bg-blue-500 text-white font-bold"
                  : "bg-gray-200 text-gray-700"
              }`}
            >
              {section.title}
            </button>
          ))}
        </div>
      )}

      <div className="tabs flex mb-6 border-b">
        <button
          className={`p-3 ${
            activeSection === "reading"
              ? "border-b-2 border-blue-500 font-bold"
              : "text-gray-500"
          }`}
          onClick={() => setActiveSection("reading")}
        >
          리딩
        </button>
        <button
          className={`p-3 ${
            activeSection === "vocabulary"
              ? "border-b-2 border-blue-500 font-bold"
              : "text-gray-500"
          }`}
          onClick={() => setActiveSection("vocabulary")}
        >
          단어 학습
        </button>
        <button
          className={`p-3 ${
            activeSection === "grammar"
              ? "border-b-2 border-blue-500 font-bold"
              : "text-gray-500"
          }`}
          onClick={() => setActiveSection("grammar")}
        >
          문법 포인트
        </button>
      </div>

      {current && (
        <>
          {activeSection === "reading" && (
            <div className="reading-section space-y-6">
              <h1 className="text-2xl font-bold text-center mb-6">
                {current.title}
              </h1>
              {current.paragraphs.map((para, idx) => {
                const { text, pronunciation } = getTextContent(para);
                return (
                  <div
                    key={idx}
                    className="paragraph-group bg-white p-4 rounded-lg shadow"
                  >
                    <div className="flex items-start mb-2">
                      <button
                        onClick={() => handlePronounce(text)}
                        className="mr-3 p-2 bg-blue-100 rounded-full hover:bg-blue-200"
                      >
                        🔊
                      </button>
                      <div>
                        <p className="text-lg foreign-text mb-2">{text}</p>
                        <p className="text-gray-600 pronunciation">
                          {pronunciation}
                        </p>
                      </div>
                    </div>
                    <p className="korean-text pl-11 text-gray-800">
                      {para.korean}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {activeSection === "vocabulary" && (
            <div className="vocabulary-section">
              <h2 className="text-xl font-bold mb-4">주요 단어</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {current.vocabulary.map((word, idx) => (
                  <div
                    key={idx}
                    className="word-card p-4 border rounded-lg hover:shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg">{word.word}</h3>
                        <p className="text-gray-600">{word.pronunciation}</p>
                        <p className="text-blue-600">{word.meaning}</p>
                      </div>
                      <button
                        onClick={() => handlePronounce(word.word)}
                        className="p-2 bg-green-100 rounded-full"
                      >
                        🔊
                      </button>
                    </div>
                    {word.example && (
                      <div className="mt-2 pl-2 border-l-4 border-green-200">
                        <p className="italic">{word.example}</p>
                        <p className="text-gray-500">
                          {word.exampleTranslation}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "grammar" && (
            <div className="grammar-section">
              <h2 className="text-xl font-bold mb-4">문법 포인트</h2>
              {current.grammarPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="grammar-point mb-6 p-4 bg-gray-50 rounded-lg"
                >
                  <h3 className="font-semibold text-lg mb-2">{point.title}</h3>
                  <p className="mb-3">{point.explanation}</p>
                  <div className="examples space-y-2">
                    {point.examples.map((ex, exIdx) => {
                      const { text, pronunciation } = getTextContent(ex);
                      return (
                        <div
                          key={exIdx}
                          className="example p-2 bg-white rounded border"
                        >
                          <p className="font-medium">{text}</p>
                          <p className="text-gray-600">{pronunciation}</p>
                          <p className="text-gray-800">{ex.korean}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button
        onClick={handleComplete}
        disabled={completed}
        className={`mt-8 p-3 w-full rounded-lg ${
          completed ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
        } text-white font-bold`}
      >
        {completed ? "학습 완료 ✓" : "이 단원 마치기"}
      </button>
    </div>
  );
};

export default ReadingLearning;
