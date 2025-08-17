import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function MultipleChoiceTest({
  module,
  testId,
  day,
  onBack,
  session,
  language,
}) {
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadQuestions = async () => {
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
        console.log(
          `Questions loaded for ${module}-${testId}-${day}:`,
          data.content[day]
        );
        setQuestions(data.content[day] || []);
      } catch (err) {
        console.error(`데이터 로드 오류 (${module}-${testId}):`, err);
        setError(err.message);
        setQuestions([]);
      }
    };
    loadQuestions();
  }, [day, module, testId, language]);

  const handleAnswerChange = (qId, value) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session) {
      alert("로그인이 필요합니다. 먼저 로그인해 주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newResults = questions.map((q) => {
        const userAnswerIndex = parseInt(answers[q.id]);
        const correctIndex = q.correct;
        const userAnswer = q.options[userAnswerIndex];
        const correctAnswer = q.options[correctIndex];
        const isCorrect = userAnswerIndex === correctIndex;
        return {
          question: q.question,
          userAnswer,
          correctAnswer,
          score: isCorrect ? 100 / questions.length : 0,
          feedback: isCorrect ? "정답!" : `오답 (정답: ${correctAnswer})`,
        };
      });

      const totalScore = newResults.reduce((sum, r) => sum + r.score, 0);
      setResults(newResults);

      const response = await fetch(
        "https://backend-lurm.onrender.com/api/save-result", // ★ 배포 시 https://bestion.netlify.app/api/save-result
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: session.user.email,
            module_code: `${testId}-${day}`,
            language: language, // ★ language 추가
            results: newResults.map((r, index) => ({
              question_text: `${questions[index].word}: ${r.question}`,
              user_answer: r.userAnswer,
              score: r.score,
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const saveResult = await response.json();
      console.log("저장 결과:", saveResult);
    } catch (error) {
      console.error("결과 저장 중 오류:", error);
      setError(`결과 저장 실패: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="test-container">
      <button onClick={onBack} className="back-button">
        뒤로 가기
      </button>
      <h1>객관식 {testId} 올바른 답 맞추기</h1>
      <h4>
        {day ? `${day}일차` : "복습 모드"} - {questions.length}개 문제
      </h4>

      {error ? (
        <p>{error}</p>
      ) : questions.length === 0 ? (
        <p>문제를 로딩 중입니다...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {questions.map((q) => (
            <div key={q.id} className="question">
              <p>
                {q.word}: {q.question}
              </p>
              {q.options.map((option, index) => (
                <div key={index}>
                  <input
                    type="radio"
                    id={`${q.id}-${index}`}
                    name={q.id}
                    value={index}
                    onChange={() => handleAnswerChange(q.id, index)}
                    required
                  />
                  <label htmlFor={`${q.id}-${index}`}>{option}</label>
                </div>
              ))}
            </div>
          ))}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "제출 중..." : "제출"}
          </button>
        </form>
      )}

      {results && (
        <div className="result">
          <h2>채점 결과</h2>
          <p>
            총점: {Math.round(results.reduce((sum, r) => sum + r.score, 0))}/100
          </p>
          {results.map((r, index) => (
            <p key={index}>
              {r.question}: {r.feedback} (점수: {Math.round(r.score)}/100)
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default MultipleChoiceTest;
