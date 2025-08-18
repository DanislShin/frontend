import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 초기화
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function ListeningComprehensionTest({
  module,
  testId,
  day,
  onBack,
  session,
  language,
}) {
  // 상태 관리
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);

  // Supabase에서 질문 데이터 가져오기
  useEffect(() => {
    const loadQuestions = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("test_content")
          .select("content")
          .eq("language", language)
          .eq("module_id", module)
          .eq("test_id", testId)
          .eq("mode", "review")
          .single();
        if (error) throw new Error(`질문 데이터 조회 실패: ${error.message}`);
        setQuestions(data.content[day] || []);
      } catch (err) {
        console.error(`데이터 로드 오류 (${module}-${testId}):`, err);
        setError(err.message);
        setQuestions([]);
      } finally {
        setIsSubmitting(false);
      }
    };
    loadQuestions();
  }, [day, module, testId, language]);

  // 크롬 Google 음성으로 재생
  const playAudio = () => {
    if (questions.length > 0) {
      const utterance = new SpeechSynthesisUtterance(
        questions[currentQuestionIndex].word
      );
      utterance.lang = "en-US";

      // Google 음성 목록에서 선택 (US English 우선)
      const voices = window.speechSynthesis.getVoices();
      const googleVoice = voices.find(
        (v) => v.lang === "en-US" && v.name.toLowerCase().includes("google")
      );

      if (googleVoice) {
        utterance.voice = googleVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  };
  // 답변 저장 함수 (save-result 엔드포인트 사용)
  const saveResponse = async (questionId, selectedIndex, isCorrect) => {
    if (!session) {
      setError("로그인이 필요합니다. 먼저 로그인해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const question = questions[currentQuestionIndex];
      const userAnswer = question.options[selectedIndex];
      const result = {
        question_text: `${question.word}: ${question.question}`,
        user_answer: userAnswer,
        score: isCorrect ? 100 / questions.length : 0, // 문제당 점수 균등 분배
      };

      // 결과 상태 업데이트
      setResults((prev) => [...prev, result]);

      const response = await fetch(
        import.meta.env.VITE_API_URL ||
          "https://backend-lurm.onrender.com/api/save-result",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: session.user.email,
            module_code: `${testId}-${day}`,
            language,
            test_id: testId, // 추가: 테스트 ID로 유형 추적
            results: [result],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const saveResult = await response.json();
      console.log("저장 결과:", saveResult);
    } catch (err) {
      setError("답변 저장 실패: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 선택지 클릭 시 처리
  const handleOptionClick = (index) => {
    const correctIndex = questions[currentQuestionIndex].correct;
    const isAnswerCorrect = index === correctIndex;
    setSelectedOption(index);
    setIsCorrect(isAnswerCorrect);
    saveResponse(questions[currentQuestionIndex].id, index, isAnswerCorrect);
  };

  // 다음 문제로 이동
  const goToNextQuestion = () => {
    setSelectedOption(null);
    setIsCorrect(null);
    setError(null);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setCurrentQuestionIndex(questions.length); // 결과 화면으로 전환
    }
  };

  // 결과 초기화
  const resetSelection = () => {
    setSelectedOption(null);
    setIsCorrect(null);
    setError(null);
  };

  // 결과 화면 렌더링
  if (currentQuestionIndex === questions.length && results.length > 0) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <button
          onClick={onBack}
          style={{
            padding: "10px 20px",
            backgroundColor: "#f0f0f0",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          뒤로 가기
        </button>
        <h1>듣기 이해 테스트 결과</h1>
        <h4>
          {day ? `${day}일차` : "복습 모드"} - 총점:{" "}
          {Math.round(results.reduce((sum, r) => sum + r.score, 0))}/100
        </h4>
        <div>
          {results.map((r, index) => (
            <p key={index}>
              {r.question_text}:{" "}
              {r.score > 0
                ? "정답!"
                : `오답 (정답: ${
                    questions[index].options[questions[index].correct]
                  })`}{" "}
              (점수: {Math.round(r.score)}/100)
            </p>
          ))}
          <button
            onClick={() => {
              setCurrentQuestionIndex(0);
              setResults([]);
              setSelectedOption(null);
              setIsCorrect(null);
              setError(null);
            }}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            테스트 다시 시작
          </button>
        </div>
      </div>
    );
  }

  // 로딩 중이거나 데이터가 없으면 메시지 표시
  if (isSubmitting && questions.length === 0) return <p>데이터 로딩 중...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (questions.length === 0) return <p>테스트 데이터를 찾을 수 없습니다.</p>;

  // 현재 문제 데이터
  const questionData = questions[currentQuestionIndex];

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <button
        onClick={onBack}
        style={{
          padding: "10px 20px",
          backgroundColor: "#f0f0f0",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        뒤로 가기
      </button>
      <h1>듣기 이해 테스트</h1>
      <h4>
        {day ? `${day}일차` : "복습 모드"} - {currentQuestionIndex + 1}/
        {questions.length} 문제
      </h4>
      <div>
        <button
          onClick={playAudio}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            margin: "10px 0",
          }}
        >
          단어 듣기
        </button>
        <p>{questionData.question}</p>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {questionData.options.map((option, index) => (
            <li key={index} style={{ margin: "10px 0" }}>
              <button
                onClick={() => handleOptionClick(index)}
                disabled={selectedOption !== null || isSubmitting}
                style={{
                  padding: "10px",
                  width: "100%",
                  backgroundColor:
                    selectedOption === index
                      ? isCorrect
                        ? "#28a745"
                        : "#dc3545"
                      : "#f8f9fa",
                  border: "1px solid #ccc",
                  borderRadius: "5px",
                  cursor:
                    selectedOption !== null || isSubmitting
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
        {selectedOption !== null && (
          <div>
            <p>{isCorrect ? "정답입니다!" : "틀렸습니다. 다시 시도하세요."}</p>
            {error && <p style={{ color: "red" }}>{error}</p>}
            <button
              onClick={resetSelection}
              disabled={isSubmitting}
              style={{
                padding: "10px 20px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                marginRight: "10px",
              }}
            >
              다시 풀기
            </button>
            <button
              onClick={goToNextQuestion}
              disabled={isSubmitting}
              style={{
                padding: "10px 20px",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              다음 문제
            </button>
          </div>
        )}
        {isSubmitting && <p>답변 저장 중...</p>}
      </div>
    </div>
  );
}

export default ListeningComprehensionTest;
