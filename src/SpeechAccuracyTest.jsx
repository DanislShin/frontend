// src/SpeechAccuracyTest.jsx
import React, { useState, useEffect, useRef } from "react";

function SpeechAccuracyTest({ module, testId, day, onBack, session }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const jsonFilePath = `/data/${module}-${testId}-questions.json`;
    fetch(jsonFilePath)
      .then((response) => {
        if (!response.ok) throw new Error("파일을 찾을 수 없습니다.");
        return response.json();
      })
      .then((data) => {
        setQuestions(data[day] || []);
      })
      .catch((error) => {
        console.error(`데이터 로드 오류 (${jsonFilePath}):`, error);
        setError(`질문 데이터를 불러오는데 실패했습니다: ${error.message}`);
      });

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [day, module, testId]);

  const testAccuracy = (questionId) => async () => {
    setError(null);
    setCurrentQuestion(questionId);

    try {
      const recognition = new (window.SpeechRecognition ||
        window.webkitSpeechRecognition)();
      recognitionRef.current = recognition;
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setAnswers((prev) => ({ ...prev, [questionId]: transcript }));
        setIsRecording(false);
        setCurrentQuestion(null);
      };

      recognition.onerror = (event) => {
        setIsRecording(false);
        setCurrentQuestion(null);
        console.error("음성 인식 오류:", event.error);
        setError(`음성 인식 오류: ${event.error}`);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setCurrentQuestion(null);
      };

      recognition.start();
    } catch (err) {
      setIsRecording(false);
      setCurrentQuestion(null);
      console.error("음성 인식 초기화 오류:", err);
      setError(`음성 인식을 시작할 수 없습니다: ${err.message}`);
    }
  };

  const levenshteinDistance = (s, t) => {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= s.length; i++) {
      arr[i] = [i];
      for (let j = 1; j <= t.length; j++) {
        arr[i][j] =
          i === 0
            ? j
            : Math.min(
                arr[i - 1][j] + 1,
                arr[i][j - 1] + 1,
                arr[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1)
              );
      }
    }
    return arr[s.length][t.length];
  };

  const cleanText = (text) => {
    return text.replace(/[.,!?]/g, "").trim();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session) {
      setError("로그인 상태가 아닙니다");
      console.error("로그인 상태가 아닙니다");
      return;
    }

    const newResults = questions.map((q) => {
      const userAnswer = answers[q.id] || "";
      const cleanUserAnswer = cleanText(userAnswer);
      const cleanCorrectText = cleanText(q.correct_text);
      const distance = levenshteinDistance(
        cleanUserAnswer.toLowerCase(),
        cleanCorrectText.toLowerCase()
      );
      const maxLength = Math.max(
        cleanUserAnswer.length,
        cleanCorrectText.length
      );
      const score =
        maxLength > 0 ? Math.max(0, 100 - (distance / maxLength) * 100) : 0;
      return {
        question_text: q.question_text,
        user_answer: userAnswer,
        score: score,
      };
    });
    setResults(newResults);

    try {
      const response = await fetch(
        "https://backend-lurm.onrender.com/api/save-result",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: session.user.email,
            module_code: `${testId}-${day}`,
            results: newResults,
          }),
        }
      );
      if (!response.ok)
        throw new Error("서버 응답 오류: " + response.statusText);
      const data = await response.json();
      console.log("Supabase 저장 성공:", data);
    } catch (error) {
      console.error("Supabase 저장 실패:", error);
      setError(`결과 저장 실패: ${error.message}`);
    }
  };

  return (
    <div className="test-container">
      <button onClick={onBack} className="back-button">
        뒤로 가기
      </button>
      <h1>발음 정확도 테스트</h1>
      <p>⚠️ 마이크 접근 권한이 필요합니다</p>
      <ol>
        <li>아래 버튼을 클릭하면 권한 요청이 표시됩니다</li>
        <li>"허용"을 선택해주세요</li>
        <li>한 번 허용하면 다음부터는 자동으로 인식됩니다</li>
      </ol>

      {error && (
        <div className="error-message" style={{ color: "red" }}>
          {error}
        </div>
      )}

      {questions.map((q) => (
        <div key={q.id} className="question">
          <p>{q.question_text}</p>
          <button
            onClick={testAccuracy(q.id)}
            disabled={isRecording}
            style={{
              backgroundColor: currentQuestion === q.id ? "red" : "",
              color: currentQuestion === q.id ? "white" : "",
            }}
          >
            {currentQuestion === q.id
              ? "녹음 중... (말해주세요)"
              : answers[q.id]
              ? "다시 녹음하기"
              : "정확도 테스트"}
          </button>
          {answers[q.id] && (
            <div style={{ marginTop: "5px" }}>
              <strong>인식된 답변:</strong> {answers[q.id]}
            </div>
          )}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <button type="submit" disabled={isRecording}>
          제출
        </button>
      </form>

      {isRecording && (
        <div style={{ margin: "10px 0", color: "red" }}>
          마이크에 말하고 있습니다...
        </div>
      )}

      {results && (
        <div className="result">
          <h2>채점 결과</h2>
          {results.map((r, index) => (
            <p key={index}>
              {r.question_text}: 점수 {r.score.toFixed(2)}%
              <br />
              <small>당신의 답변: {r.user_answer}</small>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default SpeechAccuracyTest;
