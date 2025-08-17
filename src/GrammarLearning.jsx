import React, { useState, useEffect } from "react";

const GrammarLearning = ({
  module,
  testId,
  supabase,
  session,
  language,
  onBack,
}) => {
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
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

  const handlePronounce = (text, rate = 0.8) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "jp" ? "ja-JP" : "en-US";
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

  return (
    <div className="grammar-learning p-4">
      <button
        onClick={onBack}
        className="back-btn mb-4 p-2 bg-gray-500 text-white rounded"
      >
        ← 뒤로
      </button>
      <h1 className="text-2xl font-bold mb-4">{content.title}</h1>

      <div className="tabs flex overflow-x-auto mb-4 border-b">
        {content.topics.map((topic, index) => (
          <button
            key={index}
            className={`whitespace-nowrap p-3 ${
              activeTab === index
                ? "border-b-2 border-blue-500 font-bold"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab(index)}
          >
            {topic.subtitle}
          </button>
        ))}
      </div>

      <div className="tab-content bg-white p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-3 text-blue-600">
          {content.topics[activeTab].subtitle}
        </h2>
        <p className="mb-4 p-3 bg-gray-50 rounded">
          {content.topics[activeTab].explanation}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">유형</th>
                <th className="p-3 border text-left">영어 예문</th>
                <th className="p-3 border text-left">한국어 번역</th>
                <th className="p-3 border text-left">발음</th>
              </tr>
            </thead>
            <tbody>
              {content.topics[activeTab].examples.map((example, idx) => (
                <tr key={idx} className="border hover:bg-gray-50">
                  <td className="p-3 border">{example.type}</td>
                  <td className="p-3 border">{example.english}</td>
                  <td className="p-3 border">{example.korean}</td>
                  <td className="p-3 border">
                    <button
                      onClick={() => handlePronounce(example.english)}
                      className="p-2 bg-blue-100 rounded-full hover:bg-blue-200"
                    >
                      🔊
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={handleComplete}
        disabled={completed}
        className={`mt-6 p-3 w-full rounded-lg ${
          completed ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"
        } text-white font-bold`}
      >
        {completed ? "학습 완료 ✓" : "이 단원 마치기"}
      </button>
    </div>
  );
};

export default GrammarLearning;
