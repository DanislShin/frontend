// src/App.jsx
import React, { useState, useEffect } from "react";
import "./App.css";
import { createClient } from "@supabase/supabase-js";
import MultipleChoiceTest from "./MultipleChoiceTest";
import SpeechAccuracyTest from "./SpeechAccuracyTest";
import SubjectiveTest from "./SubjectiveTest";
import AIRreviewTest from "./AIRreviewTest";
import ListeningComprehensionTest from "./ListeningComprehensionTest";
import WritingAccuracyTest from "./WritingAccuracyTest";

// 환경 변수로 Supabase 초기화
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function App() {
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [tests, setTests] = useState({});
  const [availableDays, setAvailableDays] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [maps, setMaps] = useState({ topicMaps: {}, typeMap: {} });
  const [session, setSession] = useState(null);

  // 세션 상태 관리
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  // 2️⃣ 🔥 새로 추가: 비활성 로그아웃 로직 (독립적인 useEffect)
  useEffect(() => {
    if (!session) return;

    let inactivityTimer;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        supabase.auth.signOut();
        alert("30분 간 활동이 없어 로그아웃됩니다.");
      }, 1800000); // 30분
    };

    const events = ["mousemove", "keydown", "click"];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    resetTimer(); // 초기 타이머 설정

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [session]); // session이 변경될 때마다 실행

  // 기존 데이터 로딩 로직 (변경 없음)
  useEffect(() => {
    const loadData = async () => {
      try {
        const [testsResponse, mapsResponse] = await Promise.all([
          fetch("/config/tests.json?" + new Date().getTime()),
          fetch("/config/maps.json?" + new Date().getTime()),
        ]);
        if (!testsResponse.ok) throw new Error("테스트 파일 로드 실패");
        if (!mapsResponse.ok) throw new Error("매핑 파일 로드 실패");
        const testsData = await testsResponse.json();
        const mapsData = await mapsResponse.json();
        setMaps(mapsData);

        const updatedTests = {};
        const dayMap = {};
        for (const module in testsData) {
          updatedTests[module] = testsData[module].map((test) => {
            const [categoryCode, topicCode, , difficulty] = test.id.split("-");
            const categoryMap = {
              100: "발음",
              200: "문법",
              300: "단어",
              400: "시험",
              700: "읽기",
            };
            const skillMap = {
              0: "종합",
              1: "읽기",
              2: "쓰기",
              3: "말하기",
              4: "듣기",
            };
            const difficultyMap = { A: "고급", I: "중급", B: "초급" };

            const topic =
              mapsData.topicMaps[categoryCode] || `주제 ${categoryCode}`;
            const skill = skillMap[test.skill] || test.skill;
            const diff = difficultyMap[difficulty] || difficulty;
            const testType = mapsData.typeMap[test.type] || test.type;

            return {
              ...test,
              name: `${
                categoryMap[categoryCode] || `모듈 ${categoryCode}`
              } - ${topic} - ${skill} - ${testType} (${diff})`,
            };
          });
          await Promise.all(
            testsData[module].map(async (test) => {
              try {
                const response = await fetch(
                  `/data/${module}-${test.id}-questions.json`
                );
                if (!response.ok) {
                  dayMap[test.id] = 0;
                  return;
                }
                const data = await response.json();
                const days = Object.keys(data)
                  .map(Number)
                  .sort((a, b) => a - b);
                dayMap[test.id] = days.length > 0 ? Math.max(...days) : 0;
              } catch (error) {
                dayMap[test.id] = 0;
              }
            })
          );
        }
        setTests(updatedTests);
        setAvailableDays(dayMap);
      } catch (error) {
        console.error("데이터 로드 오류:", error);
      }
    };

    if (session) {
      loadData();
    }
  }, [session]);

  const modules = [
    { id: "100", name: "100번 발음" },
    { id: "200", name: "200번 문법" },
    { id: "300", name: "300번 단어" },
    { id: "400", name: "400번 시험" },
    { id: "700", name: "700번 읽기" },
  ];

  const testComponentMap = {
    "speech-accuracy": SpeechAccuracyTest,
    "multiple-choice": MultipleChoiceTest,
    subjective: SubjectiveTest,
    "ai-review": AIRreviewTest,
    "listening-comprehension": ListeningComprehensionTest,
    "writing-accuracy": WritingAccuracyTest,
  };

  // 로그인 컴포넌트
  const Auth = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      }

      setLoading(false);
    };

    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>로그인</h2>
          {error && <div className="auth-error">{error}</div>}
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!session) {
      return <Auth />;
    }

    if (!selectedModule) {
      return (
        <div className="content-center">
          <img
            src="images/7FAD324E-0348-474A-95E1-D4805ED44035-removebg-preview.PNG"
            alt="BESTION LANGUAGE INSTITUTE"
            style={{
              maxWidth: "80%",
              maxHeight: "60vh",
              objectFit: "contain",
            }}
          />
          <h2>모듈을 선택해주세요</h2>
        </div>
      );
    }

    if (!selectedTest) {
      return (
        <div className="content-center">
          <h1>{modules.find((mod) => mod.id === selectedModule).name}</h1>
          <h2>테스트를 선택해주세요</h2>
        </div>
      );
    }

    if (
      !selectedDay &&
      tests[selectedModule]?.find((t) => t.id === selectedTest)?.days
    ) {
      return (
        <div className="content-center">
          <h1>
            {tests[selectedModule].find((t) => t.id === selectedTest).name}
          </h1>
          <h2>일자를 선택해주세요</h2>
        </div>
      );
    }

    const currentTest = tests[selectedModule]?.find(
      (t) => t.id === selectedTest
    );
    const TestComponent = currentTest
      ? testComponentMap[currentTest.type] || MultipleChoiceTest
      : MultipleChoiceTest;

    return (
      <TestComponent
        module={selectedModule}
        testId={selectedTest}
        day={selectedDay}
        onBack={() => setSelectedDay(null)}
        session={session} // 추가된 부분
      />
    );
  };

  return (
    <div className="app-container">
      {session && (
        <>
          <div className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
            <button
              className="sidebar-toggle"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
              {isSidebarCollapsed ? "▶" : "◀"}
            </button>

            {!isSidebarCollapsed && (
              <>
                <div className="sidebar-header">
                  <h2>베스티온 폴리로그</h2>
                  <button
                    className="logout-btn"
                    onClick={() => supabase.auth.signOut()}
                  >
                    로그아웃
                  </button>
                </div>

                <div className="sidebar-menu">
                  {!selectedModule ? (
                    <ul>
                      {modules.map((mod) => (
                        <li key={mod.id}>
                          <button
                            className="sidebar-btn"
                            onClick={() => setSelectedModule(mod.id)}
                          >
                            {mod.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : !selectedTest ? (
                    <>
                      <button
                        className="sidebar-back-btn"
                        onClick={() => setSelectedModule(null)}
                      >
                        ← 모듈 선택
                      </button>
                      <ul>
                        {tests[selectedModule]?.map((test) => (
                          <li key={test.id}>
                            <button
                              className="sidebar-btn"
                              onClick={() => setSelectedTest(test.id)}
                            >
                              {test.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <button
                        className="sidebar-back-btn"
                        onClick={() => setSelectedTest(null)}
                      >
                        ← 테스트 선택
                      </button>
                      <ul>
                        {Array.from(
                          { length: availableDays[selectedTest] || 0 },
                          (_, i) => i + 1
                        ).map((day) => (
                          <li key={day}>
                            <button
                              className="sidebar-btn"
                              onClick={() => setSelectedDay(day)}
                            >
                              {day}일차
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="main-content">{renderContent()}</div>
    </div>
  );
}

export default App;
