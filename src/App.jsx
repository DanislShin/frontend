import React, { useState, useEffect } from "react";
import "./App.css";
import { createClient } from "@supabase/supabase-js";
import MultipleChoiceTest from "./MultipleChoiceTest";
import SpeechAccuracyTest from "./SpeechAccuracyTest";
import SubjectiveTest from "./SubjectiveTest";
import AIRreviewTest from "./AIRreviewTest";
import ListeningComprehensionTest from "./ListeningComprehensionTest";
import WritingAccuracyTest from "./WritingAccuracyTest";
import LearningMode from "./LearningMode";
import WordLearning from "./WordLearning";
import GrammarLearning from "./GrammarLearning";
import ReadingLearning from "./ReadingLearning";
import SAPDashboard from "./SAPDashboard";
import Auth from "./Auth";

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
  const [maps, setMaps] = useState({
    topicMaps: {},
    typeMap: {},
    difficultyMap: {},
  });
  const [session, setSession] = useState(null);
  const [learnMode, setLearnMode] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [language, setLanguage] = useState("en");
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [reportData, setReportData] = useState({ progress: [], results: [] });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Initial session:", session);
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth state changed, session:", session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    let inactivityTimer;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        supabase.auth.signOut();
        alert("30분 간 활동이 없어 로그아웃됩니다.");
      }, 1800000);
    };

    const events = ["mousemove", "keydown", "click"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [session]);

  const learnComponentMap = {
    WordLearning: WordLearning,
    LearningMode: LearningMode, // 기존 LearningMode 유지
    GrammarLearning: GrammarLearning,
    ReadingLearning: ReadingLearning,
  };

  const loadLearnData = async () => {
    try {
      setLoadError(null);
      const { data, error } = await supabase
        .from("modules")
        .select("module_id, tests")
        .eq("language", language)
        .eq("mode", "learn");
      if (error) throw new Error(`학습 모듈 조회 실패: ${error.message}`);

      const updatedTests = {};
      data.forEach(({ module_id, tests }) => {
        updatedTests[module_id] = tests.map((test) => ({
          ...test,
          component: test.component || "LearningMode", // 기본값 설정
        }));
      });
      setTests(updatedTests);
    } catch (error) {
      setLoadError(error.message);
      setTests({});
    }
  };

  const loadReviewData = async () => {
    try {
      setLoadError(null);
      console.log(
        `Fetching review data for language=${language}, user=${session.user.email}`
      );
      const [modulesResponse, mappingsResponse, completedResponse] =
        await Promise.all([
          supabase
            .from("modules")
            .select("module_id, tests")
            .eq("language", language)
            .eq("mode", "review"),
          supabase
            .from("mappings")
            .select("type, key, value")
            .eq("language", language),
          supabase
            .from("learning_progress")
            .select("module_code")
            .eq("user_id", session.user.email)
            .eq("completed", true)
            .eq("language", language),
        ]);

      if (modulesResponse.error) {
        console.error("Modules query error:", modulesResponse.error);
        throw new Error(`Modules 조회 실패: ${modulesResponse.error.message}`);
      }
      if (mappingsResponse.error) {
        console.error("Mappings query error:", mappingsResponse.error);
        throw new Error(
          `Mappings 조회 실패: ${mappingsResponse.error.message}`
        );
      }
      if (completedResponse.error) {
        console.error(
          "Learning_progress query error:",
          completedResponse.error
        );
        throw new Error(
          `Learning_progress 조회 실패: ${completedResponse.error.message}`
        );
      }

      console.log("Modules data:", modulesResponse.data);
      console.log("Mappings data:", mappingsResponse.data);
      console.log("Completed data:", completedResponse.data);

      const topicMap = mappingsResponse.data
        .filter((m) => m.type === "topic")
        .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
      const typeMap = mappingsResponse.data
        .filter((m) => m.type === "test_type")
        .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});
      const difficultyMap = mappingsResponse.data
        .filter((m) => m.type === "difficulty")
        .reduce((acc, { key, value }) => ({ ...acc, [key]: value }), {});

      setMaps({ topicMaps: topicMap, typeMap, difficultyMap });

      const completedBaseIds = new Set(
        completedResponse.data.map(
          ({ module_code }) => module_code.split("-")[0]
        )
      );
      console.log("Completed base IDs:", Array.from(completedBaseIds));

      const updatedTests = {};
      const dayMap = {};

      for (const { module_id, tests } of modulesResponse.data) {
        updatedTests[module_id] = [];
        for (const test of tests) {
          const baseTestId = test.id.split("-")[0];
          console.log(
            "Processing test:",
            test.id,
            "Base ID:",
            baseTestId,
            "Included:",
            completedBaseIds.has(baseTestId)
          );
          if (completedBaseIds.has(baseTestId)) {
            const [categoryCode, topicCode, , difficulty] = test.id
              .split("-")
              .concat([null, null, null]);
            const topic =
              topicMap[categoryCode] || `주제 ${topicCode || "없음"}`;
            const diff =
              difficultyMap[difficulty] || (difficulty ? difficulty : "없음");
            const testType = typeMap[test.type] || test.type || "알 수 없음";

            const updatedTest = {
              ...test,
              name: `${
                {
                  1: "문자",
                  101: "발음",
                  201: "문법",
                  301: "단어",
                  401: "시험",
                  501: "영상",
                  601: "교과",
                  701: "읽기",
                }[categoryCode] || `모듈 ${categoryCode}`
              } - 주제 ${topicCode || "없음"} - ${
                test.skill || "알 수 없음"
              } - ${testType} (${diff})`,
            };

            try {
              const { data, error } = await supabase
                .from("test_content")
                .select("content")
                .eq("language", language)
                .eq("module_id", module_id)
                .eq("test_id", test.id)
                .eq("mode", "review")
                .single();
              if (error) {
                console.error(`Test content error for ${test.id}:`, error);
                throw new Error(`질문 데이터 조회 실패: ${error.message}`);
              }
              const days = Object.keys(data.content)
                .map(Number)
                .sort((a, b) => a - b);
              dayMap[test.id] = days;
              updatedTests[module_id].push(updatedTest);
            } catch (error) {
              console.warn(
                `Error loading ${module_id}-${test.id} content:`,
                error
              );
              dayMap[test.id] = [];
            }
          }
        }
      }

      setTests(updatedTests);
      setAvailableDays(dayMap);
      console.log("Updated tests:", updatedTests);
      console.log("Available days:", dayMap);
    } catch (error) {
      console.error("복습 데이터 로드 실패:", error);
      setLoadError(`복습 데이터 로드 실패: ${error.message}`);
      setTests({});
      setAvailableDays({});
    }
  };

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const loadProfileData = async () => {
    try {
      if (!session) return;
      setLoadError(null);
      setIsLoadingProfile(true);
      console.log(
        `Fetching profile data for user=${session.user.email}, language=${language}`
      );

      setProfileData({
        email: session.user.email,
        first_name: "이름 없음",
        last_name: "",
      });

      const [progressResponse, resultsResponse] = await Promise.all([
        supabase
          .from("learning_progress")
          .select("module_code, completed, completed_at, day")
          .eq("user_id", session.user.email)
          .eq("language", language)
          .order("completed_at", { ascending: false }),
        supabase
          .from("practice_results")
          .select("module_code, ai_feedback, timestamp, question_text")
          .eq("user_id", session.user.email)
          .eq("language", language)
          .order("timestamp", { ascending: false }),
      ]);

      console.log("Progress data:", progressResponse.data);
      console.log("Results data:", resultsResponse.data);

      if (progressResponse.error) {
        console.error("Learning_progress fetch error:", progressResponse.error);
        throw new Error(
          `리포트 데이터 조회 실패: ${progressResponse.error.message}`
        );
      }
      if (resultsResponse.error) {
        console.error("Practice_results fetch error:", resultsResponse.error);
        throw new Error(
          `리포트 데이터 조회 실패: ${resultsResponse.error.message}`
        );
      }

      const report = {
        progress: progressResponse.data || [],
        results: resultsResponse.data || [],
      };
      setReportData(report);
      console.log("Report data structure:", JSON.stringify(report, null, 2));
    } catch (error) {
      console.error("프로필 데이터 로드 실패:", error);
      setLoadError(`프로필 데이터 로드 실패: ${error.message}`);
      setProfileData(null);
      setReportData({ progress: [], results: [] });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    console.log("showProfile state changed:", showProfile);
    if (learnMode) {
      loadLearnData();
    } else if (session) {
      loadReviewData();
    }
    if (session && showProfile) {
      loadProfileData();
    }
  }, [session, learnMode, language, showProfile]);

  const modules = [
    { id: "000", name: "000번 문자" },
    { id: "100", name: "100번 발음" },
    { id: "200", name: "200번 문법" },
    { id: "300", name: "300번 단어" },
    { id: "400", name: "400번 시험" },
    { id: "500", name: "500번 영상" },
    { id: "600", name: "600번 교과" },
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

  const renderContent = () => {
    if (!session) return <Auth supabase={supabase} />;

    if (showProfile) {
      return (
        <SAPDashboard
          reportData={reportData}
          profileData={profileData}
          onBack={() => setShowProfile(false)}
          language={language}
        />
      );
    }
    return (
      <div>
        <div className="mode-toggle flex gap-2 mb-4">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="p-2 rounded"
          >
            <option value="en">영어</option>
            <option value="jp">일본어</option>
            <option value="ch">중국어</option>
          </select>
          <button
            onClick={() => setLearnMode(true)}
            disabled={learnMode}
            className="p-2 bg-blue-500 text-white rounded disabled:bg-gray-500"
          >
            학습하기
          </button>
          <button
            onClick={() => setLearnMode(false)}
            disabled={!learnMode}
            className="p-2 bg-blue-500 text-white rounded disabled:bg-gray-500"
          >
            복습하기
          </button>
        </div>

        {loadError && <p className="text-red-500 mb-4">{loadError}</p>}

        {!selectedModule ? (
          <div className="content-center">
            <img
              src="images/7FAD324E-0348-474A-95E1-D4805ED44035-removebg-preview.PNG"
              alt="BESTION LANGUAGE INSTITUTE"
              className="max-w-[80%] max-h-[60vh] object-contain"
            />
            <h2 className="text-2xl mt-4">모듈을 선택해주세요</h2>
            {!learnMode &&
              Object.keys(tests).every((mod) => tests[mod].length === 0) && (
                <p className="mt-2">
                  완료된 학습이 없습니다. 학습 모드에서 먼저 학습을
                  완료해주세요.
                </p>
              )}
          </div>
        ) : !selectedTest ? (
          <div className="content-center">
            <h1 className="text-3xl">
              {modules.find((mod) => mod.id === selectedModule).name}
            </h1>
            <h2 className="text-2xl mt-4">테스트를 선택해주세요</h2>
            {!learnMode && tests[selectedModule]?.length === 0 && (
              <p className="mt-2">
                완료된 학습이 없습니다. 학습 모드에서 먼저 학습을 완료해주세요.
              </p>
            )}
          </div>
        ) : !learnMode &&
          !selectedDay &&
          tests[selectedModule]?.find((t) => t.id === selectedTest) ? (
          <div className="content-center">
            <h1 className="text-3xl">
              {tests[selectedModule].find((t) => t.id === selectedTest).name}
            </h1>
            <h2 className="text-2xl mt-4">일자를 선택해주세요</h2>
          </div>
        ) : (
          <div>
            {learnMode ? (
              (() => {
                const currentTest = tests[selectedModule]?.find(
                  (t) => t.id === selectedTest
                );
                if (!currentTest)
                  return <p>테스트 데이터를 찾을 수 없습니다.</p>;

                const Component =
                  learnComponentMap[currentTest.component] || LearningMode;
                return (
                  <Component
                    module={selectedModule}
                    testId={selectedTest}
                    day={null}
                    supabase={supabase}
                    session={session}
                    language={language}
                    onBack={() => setSelectedTest(null)}
                  />
                );
              })()
            ) : (
              <div>
                {tests[selectedModule]?.find((t) => t.id === selectedTest) ? (
                  (() => {
                    const currentTest = tests[selectedModule].find(
                      (t) => t.id === selectedTest
                    );
                    const TestComponent =
                      testComponentMap[currentTest.type] || MultipleChoiceTest;
                    return (
                      <TestComponent
                        module={selectedModule}
                        testId={selectedTest}
                        day={selectedDay}
                        onBack={() => setSelectedDay(null)}
                        session={session}
                        language={language}
                      />
                    );
                  })()
                ) : (
                  <p>선택한 테스트를 찾을 수 없습니다.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container flex h-screen overflow-hidden">
      {session && !showProfile && (
        <>
          <div
            className={`sidebar ${
              isSidebarCollapsed ? "w-16" : "w-64"
            } bg-gray-100 p-4 transition-all overflow-y-auto`}
          >
            <button
              className="absolute top-2 right-[-15px] bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            >
              {isSidebarCollapsed ? "▶" : "◀"}
            </button>

            {!isSidebarCollapsed && (
              <>
                <div className="sidebar-header mb-4">
                  <h2 className="text-xl font-bold">베스티온 폴리로그</h2>
                  <button
                    className="sidebar-btn w-full p-2 mt-2 bg-blue-500 text-white rounded"
                    onClick={() => {
                      console.log(
                        "Profile button clicked, setting showProfile to true"
                      );
                      setShowProfile(true);
                    }}
                  >
                    프로필
                  </button>
                  <button
                    className="logout-btn w-full p-2 mt-2 bg-red-500 text-white rounded"
                    onClick={() => supabase.auth.signOut()}
                  >
                    로그아웃
                  </button>
                </div>

                <div className="sidebar-menu">
                  {!selectedModule ? (
                    <ul>
                      {modules
                        .filter((mod) => learnMode || tests[mod.id]?.length > 0)
                        .map((mod) => (
                          <li key={mod.id} className="my-1">
                            <button
                              className="sidebar-btn w-full p-2 bg-blue-500 text-white rounded"
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
                        className="sidebar-back-btn w-full p-2 bg-gray-500 text-white rounded mb-2"
                        onClick={() => setSelectedModule(null)}
                      >
                        ← 모듈 선택
                      </button>
                      <ul>
                        {tests[selectedModule]?.map((test) => (
                          <li key={test.id} className="my-1">
                            <button
                              className="sidebar-btn w-full p-2 bg-blue-500 text-white rounded"
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
                        className="sidebar-back-btn w-full p-2 bg-gray-500 text-white rounded mb-2"
                        onClick={() => setSelectedTest(null)}
                      >
                        ← 테스트 선택
                      </button>
                      {!learnMode && (
                        <ul>
                          {Array.from(
                            {
                              length: availableDays[selectedTest]?.length || 0,
                            },
                            (_, i) => availableDays[selectedTest][i]
                          ).map((day) => (
                            <li key={day} className="my-1">
                              <button
                                className="sidebar-btn w-full p-2 bg-blue-500 text-white rounded"
                                onClick={() => setSelectedDay(day)}
                              >
                                {day}일차
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="main-content flex-1 p-4 overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
