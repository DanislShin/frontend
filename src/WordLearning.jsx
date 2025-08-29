import React, { useState, useEffect } from "react";

const WordLearning = ({
  module,
  testId,
  supabase,
  session,
  language,
  onBack,
}) => {
  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [currentUnit, setCurrentUnit] = useState(null);

  useEffect(() => {
    const loadContent = async () => {
      try {
        setLoadError(null);
        const { data, error } = await supabase
          .from("test_content")
          .select("content")
          .eq("module_id", module)
          .eq("test_id", testId)
          .eq("language", language)
          .eq("mode", "learn")
          .single();

        if (error) throw new Error(`콘텐츠 로드 실패: ${error.message}`);
        setContent(data.content);
        // 첫 번째 유닛을 기본으로 설정
        setCurrentUnit(Object.keys(data.content)[0]);
      } catch (err) {
        setLoadError(err.message);
        setContent(null);
      }
    };
    loadContent();
  }, [module, testId, language, supabase]);

  const handlePronounce = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "jp" ? "ja-JP" : "en-US";
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
      if (error) throw new Error(`학습 완료 저장 실패: ${error.message}`);
      setCompleted(true);
    } catch (err) {
      setLoadError(err.message);
    }
  };

  if (loadError) return <p className="text-red-500">{loadError}</p>;
  if (!content) return <p>로딩 중...</p>;

  return (
    <div className="word-learning p-4">
      <button
        onClick={onBack}
        className="back-btn mb-4 p-2 bg-gray-500 text-white rounded"
      >
        ← 뒤로
      </button>

      {/* 유닛 선택 탭 */}
      <div className="flex mb-6 border-b">
        {Object.keys(content).map((unitId) => (
          <button
            key={unitId}
            onClick={() => setCurrentUnit(unitId)}
            className={`px-4 py-2 font-medium ${
              currentUnit === unitId
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {content[unitId].title}
          </button>
        ))}
      </div>

      <h1 className="text-3xl mb-6 text-center font-bold">
        {content[currentUnit].title}
      </h1>

      {/* 단어 표 */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="py-2 px-4 border-b">단어</th>
              <th className="py-2 px-4 border-b">발음</th>
              <th className="py-2 px-4 border-b">품사</th>
              <th className="py-2 px-4 border-b">의미</th>
              <th className="py-2 px-4 border-b">예문</th>
              <th className="py-2 px-4 border-b">예문 발음</th>{" "}
              {/* 추가된 열 */}
              <th className="py-2 px-4 border-b">번역</th>
              <th className="py-2 px-4 border-b">발음 듣기</th>
            </tr>
          </thead>
          <tbody>
            {content[currentUnit].words.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="py-3 px-4 border-b font-semibold">
                  {item.word}
                </td>
                <td className="py-3 px-4 border-b">{item.pronunciation}</td>
                <td className="py-3 px-4 border-b">{item.part_of_speech}</td>
                <td className="py-3 px-4 border-b">{item.meaning}</td>
                <td className="py-3 px-4 border-b">{item.example}</td>
                <td className="py-3 px-4 border-b">
                  {item.example_pronunciation}
                </td>{" "}
                {/* 추가된 열 */}
                <td className="py-3 px-4 border-b">{item.translation}</td>
                <td className="py-3 px-4 border-b">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handlePronounce(item.word)}
                      className="p-1 bg-green-500 text-white rounded text-sm"
                      title="단어 발음"
                    >
                      🔈
                    </button>
                    <button
                      onClick={() => handlePronounce(item.example)}
                      className="p-1 bg-blue-500 text-white rounded text-sm"
                      title="예문 발음"
                    >
                      🔊
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 유닛 완료 버튼 (선택사항) */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => {
            const unitKeys = Object.keys(content);
            const currentIndex = unitKeys.indexOf(currentUnit);
            if (currentIndex > 0) {
              setCurrentUnit(unitKeys[currentIndex - 1]);
            }
          }}
          disabled={Object.keys(content).indexOf(currentUnit) === 0}
          className="p-2 bg-gray-500 text-white rounded disabled:opacity-50"
        >
          이전 유닛
        </button>

        <button
          onClick={handleComplete}
          disabled={completed}
          className="p-2 bg-blue-500 text-white rounded disabled:bg-gray-500"
        >
          {completed ? "학습 완료됨" : "학습 완료하기"}
        </button>

        <button
          onClick={() => {
            const unitKeys = Object.keys(content);
            const currentIndex = unitKeys.indexOf(currentUnit);
            if (currentIndex < unitKeys.length - 1) {
              setCurrentUnit(unitKeys[currentIndex + 1]);
            }
          }}
          disabled={
            Object.keys(content).indexOf(currentUnit) ===
            Object.keys(content).length - 1
          }
          className="p-2 bg-gray-500 text-white rounded disabled:opacity-50"
        >
          다음 유닛
        </button>
      </div>
    </div>
  );
};

export default WordLearning;
