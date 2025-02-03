import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './UserInputScreen.css';
import config from '../../config';

const fixedQuestions = [
  "오늘 식사는 어땠으면 좋겠어? 간단한 한 끼, 든든한 한끼 등으로 답해줘!",
  "어떤 맛이 메뉴에서 도드라졌으면 좋겠어? (단맛, 매운맛, 짠맛 등)",
  "국물 요리가 좋을까, 아니면 볶음/구이 같은 메뉴가 좋을까?",
  "먹고 싶은 요리의 장르를 알려줘! 딱히 없다면 없다고 말해줘.(한식, 중식, 일식, 양식 등)",
  "오늘은 면 요리가 좋을까, 밥 요리가 좋을까? 아니면 그 외?",
  "추가로 고려할 사항이 있을까?"
];

// 미리 정의된 지역 옵션 배열
const regionOptions = [
  "법대후문",
  "고대정문앞",
  "고대사거리",
  "정대후문",
  "참살이길",
  "안암로터리",
  "제기동",
  "이공계",
  "교내"
];

function UserInputScreen() {
  const location = useLocation();
  const { menuList: initialMenuList = [], selectedStore = '', budget = 0 } = location.state || {};
  
  // 기존 상태들
  const [messages, setMessages] = useState([]);
  const [recommendedMenus, setRecommendedMenus] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stage, setStage] = useState('initial');
  const [selectedMenu, setSelectedMenu] = useState('');
  const [userLocations, setUserLocations] = useState([]);
  const [excludedMenus, setExcludedMenus] = useState([]);
  const [allMenus, setAllMenus] = useState([]);
  const [availableMenus, setAvailableMenus] = useState([]);
  const [inputValue, setInputValue] = useState('');
  
  // 지역 선택 state
  const [selectedRegions, setSelectedRegions] = useState([]);
  
  // 식당 추천 결과를 저장할 state (버튼 UI용)
  const [recommendedRestaurants, setRecommendedRestaurants] = useState([]);
  
  const messagesEndRef = useRef(null);

  // 대화창 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchAllMenus();
    startMenuRecommendation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore, budget]);

  const fetchAllMenus = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/all-menus`);
      const data = await response.json();
      if (data.success) {
        setAllMenus(data.menus);
        setAvailableMenus(data.menus);
        console.log("전체 메뉴 목록:", data.menus);
      }
    } catch (error) {
      console.error('메뉴 목록 가져오기 오류:', error);
    }
  };

  const addMessage = (content, isUser = false) => {
    setMessages(prev => [...prev, { content, isUser }]);
  };

  // 서비스 초기화: 메뉴 추천 처음부터 시작
  const startMenuRecommendation = () => {
    setMessages([]);
    setQuestionIndex(0);
    setStage('initial');
    setSelectedMenu('');
    setUserLocations([]);
    setExcludedMenus([]);
    setAvailableMenus(allMenus);
    setSelectedRegions([]);
    setRecommendedRestaurants([]);
    const storeTypeKorean =
      selectedStore === 'restaurant'
        ? '밥집'
        : selectedStore === 'cafe'
        ? '카페'
        : '술집';
    addMessage(`안녕하세요! ${storeTypeKorean}에서 예산 ${budget}원으로 메뉴 추천을 시작하겠습니다.`, false);
    askNextQuestion();
  };

  const askNextQuestion = () => {
    if (questionIndex < fixedQuestions.length) {
      addMessage(fixedQuestions[questionIndex], false);
      setQuestionIndex(prev => prev + 1);
    } else {
      getMenuRecommendations();
    }
  };

  const getMenuRecommendations = async (isResend = false) => {
    if (availableMenus.length < 3) {
      addMessage("더 이상 추천할 메뉴가 없습니다. 처음부터 다시 시작하시겠습니까?", false);
      setStage('restart_prompt');
      return;
    }
    try {
      const response = await fetch(`${config.apiUrl}/api/menu-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu_list: availableMenus,
          excluded_menus: excludedMenus,
          conversation: messages.map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.content
          })),
          store_type: selectedStore
        })
      });
      const data = await response.json();
      if (data.success) {
        setRecommendedMenus(data.recommended_menus);
        const prefix = isResend ? "새로운 추천 메뉴: " : "추천 메뉴: ";
        addMessage(`${prefix}${data.recommended_menus.join(', ')}`, false);
        addMessage('위 메뉴 중에서 선택하고 싶은 메뉴를 입력하거나, "다시추천"을 입력하세요.', false);
        setStage('menu_selection');
      }
    } catch (error) {
      console.error('메뉴 추천 오류:', error);
      addMessage('메뉴 추천 중 오류가 발생했습니다.', false);
    }
  };

  // 기존 텍스트 입력 처리 (메뉴 선택, 지역 선택 등)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    addMessage(inputValue, true);
    const userInput = inputValue.trim();
    setInputValue('');
    const lowerInput = userInput.toLowerCase().replace(/\s/g, '');

    if (stage === 'menu_selection') {
      if (lowerInput === '다시추천') {
        const newExcluded = [...excludedMenus, ...recommendedMenus];
        setExcludedMenus(newExcluded);
        setAvailableMenus(prev => prev.filter(menu => !newExcluded.includes(menu)));
        await getMenuRecommendations(true);
        return;
      }
      setSelectedMenu(userInput);
      setExcludedMenus(prev => [...prev, userInput]);
      setAvailableMenus(prev => prev.filter(menu => menu !== userInput));
      addMessage(`${userInput} 메뉴를 선택하셨습니다.`, false);
      addMessage('원하는 지역을 선택해주세요.', false);
      setStage('location_selection');
    } else if (stage === 'preferences') {
      await recommendRestaurants(userInput);
    } else if (stage === 'restart_prompt' || stage === 'completed') {
      if (lowerInput === '다시시작' || lowerInput === '다시추천') {
        startMenuRecommendation();
      } else {
        addMessage("대화를 종료합니다. 새로운 추천을 원하시면 '다시추천'을 입력해주세요.", false);
      }
    } else {
      if (questionIndex < fixedQuestions.length) {
        askNextQuestion();
      } else {
        getMenuRecommendations();
      }
    }
  };

  // 지역 선택: 버튼 토글
  const toggleRegion = (region) => {
    setSelectedRegions(prev => {
      if (prev.includes(region)) {
        return prev.filter(r => r !== region);
      } else {
        return [...prev, region];
      }
    });
  };

  // 지역 선택 확정: 버튼 UI에서 "확인" 누를 시 처리
  const handleRegionConfirm = () => {
    if (selectedRegions.length === 0) {
      addMessage("최소한 한 개의 지역을 선택해주세요.", false);
      return;
    }
    setUserLocations(selectedRegions);
    addMessage(`선택하신 지역: ${selectedRegions.join(', ')}`, false);
    addMessage('이제 만족도, 분위기, 서비스, 맛, 양, 위생 등 추가 의견을 입력해주세요.', false);
    setStage('preferences');
  };

  // 식당 추천 API 호출 및 결과 처리
  const recommendRestaurants = async (preferences) => {
    try {
      const response = await fetch(`${config.apiUrl}/api/recommend-restaurants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_menu: selectedMenu,
          store_type: selectedStore,
          max_price: budget,
          locations: userLocations,
          user_preferences: preferences
        })
      });
      const data = await response.json();
      if (data.success) {
        // data.recommended_restaurants는 HTML 문자열(줄바꿈은 <br> 처리됨)
        const htmlString = data.recommended_restaurants;
        const lines = htmlString.split('<br>').filter(line => line.trim() !== '');
        // 각 줄을 파싱하여 식당명과 요약 추출 (형식: "1. 식당명: 요약")
        const restaurants = lines.map(line => {
          const regex = /^[0-9]+\.\s*(.*?):\s*(.*)$/;
          const match = line.match(regex);
          if (match) {
            return { name: match[1].trim(), summary: match[2].trim() };
          }
          const parts = line.split(':');
          if (parts.length >= 2) {
            return { name: parts[0].trim(), summary: parts.slice(1).join(':').trim() };
          }
          return { name: line.trim(), summary: '' };
        });
        setRecommendedRestaurants(restaurants);
        setStage('restaurant_selection');
      } else {
        addMessage(data.error || '식당 추천 오류 발생.', false);
        setStage('completed');
      }
    } catch (error) {
      console.error('식당 추천 오류:', error);
      addMessage('식당 추천 중 오류가 발생했습니다.', false);
      setStage('completed');
    }
  };

  // 식당 버튼 클릭 처리: 사용자가 식당 선택 시
  const handleRestaurantSelect = (restaurant) => {
    addMessage(`${restaurant.name} 식당을 선택하셨습니다.`, false);
    setStage('completed');
    addMessage('만족스러운 식당 선택 감사합니다. 새로운 추천을 원하시면 아래 "다시추천" 버튼을 눌러주세요.', false);
  };

  return (
    <div className="chat-container">
      <header className="header">
        <img src="/logo.png" alt="임시로고" className="logo-image" />
      </header>
      <header className="chat-header">쿠잇나우</header>
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.isUser ? 'user' : 'bot'}`}>
            {!msg.isUser && <div className="circle bot"></div>}
            <div className="message-bubble">{msg.content}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
  
      {stage === 'location_selection' ? (
        // 지역 선택 UI: 버튼 목록과 확인 버튼
        <div className="region-selection-container">
          <div className="region-options">
            {regionOptions.map(option => (
              <button
                key={option}
                onClick={() => toggleRegion(option)}
                className={`region-button ${selectedRegions.includes(option) ? 'selected' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>
          <button className="confirm-button" onClick={handleRegionConfirm}>
            확인
          </button>
        </div>
      ) : stage === 'restaurant_selection' ? (
        <>
          {/* 일반 텍스트 메시지: 클릭 가능한 버튼이 아니라 안내 메시지 */}
          <div className="restaurant-recommendation-message">
            사용자의 요구 사항을 바탕으로 적합한 레스토랑을 다음과 같이 추천해드립니다. 식당을 선택하셨습니다.
          </div>
          {/* 식당 추천 UI: 카드형 버튼으로 표시 */}
          <div className="restaurant-selection-container">
            <div className="restaurant-options">
              {recommendedRestaurants.map((restaurant, index) => (
                <button
                  key={index}
                  className="restaurant-button"
                  onClick={() => handleRestaurantSelect(restaurant)}
                >
                  <div className="restaurant-name">{restaurant.name}</div>
                  <div className="restaurant-summary">{restaurant.summary}</div>
                </button>
              ))}
              <button className="restaurant-button restart" onClick={startMenuRecommendation}>
                다시추천
              </button>
            </div>
          </div>
        </>
      ) : (
        // 그 외 단계에서는 기존 텍스트 입력 UI 사용
        <form className="chat-input-container" onSubmit={handleSubmit}>
          <input
            type="text"
            value={inputValue}
            placeholder="메시지를 입력해주세요."
            className="chat-input"
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button
            type="submit"
            className="send-button"
            style={{
              backgroundSize: 'cover',
              backgroundRepeat: 'no-repeat',
              width: '60px',
              height: '40px',
              border: 'none',
              cursor: 'pointer',
              backgroundImage: `url(${inputValue.trim() ? '/sending_button_2.png' : '/sending_button_1.png'})`
            }}
          ></button>
        </form>
      )}
  
      {stage === 'completed' && (
        <div className="completed-container">
          <button className="restart-button" onClick={startMenuRecommendation}>
            다시추천
          </button>
        </div>
      )}
    </div>
  );
  
}

export default UserInputScreen;
