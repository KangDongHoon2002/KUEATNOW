import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './UserInputScreen.css';
import config from '../../config';

const fixedQuestions = [
    "오늘 식사는 어땠으면 좋겠어? 간단한 한 끼, 든든한 한끼 등으로 답해줘!",
    "어떤 맛이 메뉴에서 도드라졌으면 좋겠어? (단맛, 매운맛, 짠맛 등)",
    "국물 요리가 좋을까, 아니면 볶음/구이 같은 메뉴가 좋을까?",
    "먹고 싶은 요리의 장르를 알려줘! 딱히 없다면 없다고 말해줘.(한식, 중식, 일식, 양식 등)",
    "오늘은 면 요리가 좋을까, 밥 요리가 좋을까? 아니면 그 외?",
    "또 추천에서 고려해야 할 사항이 있을까?"
];

function UserInputScreen() {
    const location = useLocation();
    const { menuList: initialMenuList = [], selectedStore = '', budget = 0 } = location.state || {};
    const [messages, setMessages] = useState([]);
    const [menuList, setMenuList] = useState(initialMenuList);
    const [recommendedMenus, setRecommendedMenus] = useState([]);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [stage, setStage] = useState('initial');
    const [selectedMenu, setSelectedMenu] = useState('');
    const [userLocations, setUserLocations] = useState([]);
    const [debugInfo, setDebugInfo] = useState('');
    const [excludedMenus, setExcludedMenus] = useState([]);
    const [allMenus, setAllMenus] = useState([]);
    const [availableMenus, setAvailableMenus] = useState([]);
    const [isClicked, setIsClicked] = useState(false);
    const handleButtonClick = () => {
        setIsClicked(true); // 버튼 클릭 시 클릭 상태 변경
        handleSendMessage();
      };
    
      
    useEffect(() => {
        fetchAllMenus();
        startMenuRecommendation();
    }, [selectedStore, budget]);

    const fetchAllMenus = async () => {
        try {
            const response = await fetch(`${config.apiUrl}/api/all-menus`);
            const data = await response.json();
            if (data.success) {
                setAllMenus(data.menus);
                setAvailableMenus(data.menus);
                console.log("가져온 전체 메뉴 목록:", data.menus);
            }
        } catch (error) {
            console.error('메뉴 목록을 가져오는 중 오류 발생:', error);
        }
    };

    const addMessage = (content, isUser) => {
        setMessages(prev => [...prev, { content, isUser }]);
    };

    const startMenuRecommendation = () => {
        setMessages([]);
        setQuestionIndex(0);
        setStage('initial');
        setSelectedMenu('');
        setUserLocations([]);
        setExcludedMenus([]);
        setAvailableMenus(allMenus);
        const storeTypeKorean = selectedStore === 'restaurant' ? '밥집' : selectedStore === 'cafe' ? '카페' : '술집';
        addMessage(`안녕하세요! ${storeTypeKorean}에서 예산 ${budget}원으로 메뉴를 추천드리겠습니다.`, false);
        askNextQuestion();
    };

    const askNextQuestion = () => {
        if (questionIndex < fixedQuestions.length) {
            addMessage(fixedQuestions[questionIndex], false);
            setQuestionIndex(prevIndex => prevIndex + 1);
        } else {
            getMenuRecommendations();
        }
    };

    const getMenuRecommendations = async (isRecommendation = false) => {
        try {
            console.log("현재 사용 가능한 메뉴 목록:", availableMenus);
            console.log("제외된 메뉴 목록:", excludedMenus);
            
            if (availableMenus.length < 3) {
                addMessage("죄송합니다. 더 이상 추천할 수 있는 메뉴가 없습니다. 처음부터 다시 시작하시겠습니까?", false);
                setStage('restart_prompt');
                return;
            }

            const response = await fetch(`${config.apiUrl}/api/menu-selection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    menu_list: availableMenus,
                    excluded_menus: excludedMenus,
                    conversation: messages.map(msg => ({
                        role: msg.isUser ? 'user' : 'assistant',
                        content: msg.content
                    })),
                    store_type: selectedStore
                }),
            });
            const data = await response.json();
    
            if (data.success) {
                setRecommendedMenus(data.recommended_menus);
                console.log("추천된 메뉴:", data.recommended_menus);
                const messagePrefix = isRecommendation ? "새로운 추천 메뉴: " : "추천 메뉴: ";
                addMessage(`${messagePrefix}${data.recommended_menus.join(', ')}`, false);
                addMessage('위 메뉴 중에서 선택하고 싶은 메뉴를 입력해주세요. 없다면 "다시 추천"이라고 입력해주세요.', false);
                setStage('menu_selection');
            }
        } catch (error) {
            console.error('메뉴 추천 중 오류 발생:', error);
            addMessage('죄송합니다. 메뉴 추천 중 오류가 발생했습니다.', false);
        }
    };

    const handleSendMessage = async () => {
        const userInput = document.getElementById('userInput').value.trim();
        if (userInput) {
            addMessage(userInput, true);
            document.getElementById('userInput').value = '';

            const lowerInput = userInput.toLowerCase().replace(/\s/g, '');
            if (lowerInput === '다시추천' || lowerInput === '다시추천') {
                const newExcludedMenus = [...excludedMenus, ...recommendedMenus];
                setExcludedMenus(newExcludedMenus);
                const newAvailableMenus = availableMenus.filter(menu => !newExcludedMenus.includes(menu));
                setAvailableMenus(newAvailableMenus);
                console.log("다시 추천 요청. 현재 제외된 메뉴:", newExcludedMenus);
                console.log("남은 사용 가능한 메뉴:", newAvailableMenus);
                await getMenuRecommendations(true);
                return;
            }

            switch (stage) {
                case 'initial':
                    if (questionIndex < fixedQuestions.length) {
                        askNextQuestion();
                    } else {
                        getMenuRecommendations();
                    }
                    break;
                case 'menu_selection':
                    setSelectedMenu(userInput);
                    const newExcludedMenus = [...excludedMenus, userInput];
                    setExcludedMenus(newExcludedMenus);
                    const newAvailableMenus = availableMenus.filter(menu => menu !== userInput);
                    setAvailableMenus(newAvailableMenus);
                    addMessage(`${userInput} 메뉴를 선택하셨습니다.`, false);
                    addMessage('법대후문, 고대정문앞, 고대사거리, 정대후문, 참살이길, 안암로터리, 제기동, 이공계, 교내 중 원하시는 지역들을 입력해주세요. 여러 지역을 입력하실 경우 쉼표로 구분해주세요.', false);
                    setStage('location_selection');
                    break;
                case 'location_selection':
                    const locations = userInput.split(',').map(loc => loc.trim());
                    setUserLocations(locations);
                    addMessage(`선택하신 지역은 "${locations.join(', ')}"입니다.`, false);
                    addMessage('좋아요! 해당 지역들을 바탕으로 식당을 추천해줄게요. 만족도, 분위기, 서비스, 맛, 양, 위생과 관련해서 의견을 제시해주세요.', false);
                    setStage('preferences');
                    break;
                case 'preferences':
                    await recommendRestaurants(userInput);
                    break;
                case 'restart_prompt':
                    if (lowerInput === '네' || lowerInput === '예' || lowerInput === '다시시작') {
                        setExcludedMenus([]);
                        setMessages([]);
                        setStage('initial');
                        startMenuRecommendation();
                    } else {
                        addMessage("대화를 종료합니다. 새로운 추천이 필요하시면 페이지를 새로고침해 주세요.", false);
                    }
                    break;
                case 'completed':
                    if (lowerInput === '다시시작') {
                        startMenuRecommendation();
                    }
                    break;
                default:
                    break;
            }
        }
    };

    const recommendRestaurants = async (preferences) => {
        try {
            console.log('Sending request with:', {
                selected_menu: selectedMenu,
                store_type: selectedStore,
                max_price: budget,
                locations: userLocations,
                user_preferences: preferences
            });
    
            const response = await fetch(`${config.apiUrl}/api/recommend-restaurants`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    selected_menu: selectedMenu,
                    store_type: selectedStore,
                    max_price: budget,
                    locations: userLocations,
                    user_preferences: preferences
                }),
            });
            const data = await response.json();
    
            if (data.success) {
                addMessage(<div dangerouslySetInnerHTML={{ __html: data.recommended_restaurants }} />, false);
                setStage('completed');
                addMessage('다른 메뉴나 지역을 추천받고 싶으시면 "다시 시작"이라고 입력해주세요.', false);
            } else {
                addMessage(data.error || '식당 추천 중 오류가 발생했습니다.', false);
                if (data.error.includes('조건에 맞는 레스토랑을 찾을 수 없습니다')) {
                    addMessage('다른 메뉴나 위치를 선택해보시겠어요? "다시 시작"이라고 입력하시면 처음부터 다시 시작할 수 있습니다.', false);
                    setStage('completed');
                }
                if (data.traceback) {
                    setDebugInfo(`오류 내용:\n${data.error}\n\n스택 트레이스:\n${data.traceback}`);
                    addMessage('오류가 발생했습니다. 개발자에게 문의하실 때 아래의 디버그 정보를 함께 보내주세요.', false);
                }
            }
        } catch (error) {
            console.error('Error recommending restaurants:', error.message, error.stack);
            addMessage('죄송합니다. 식당 추천 중 오류가 발생했습니다. 다시 시도해 주세요.', false);
            setDebugInfo(`클라이언트 오류:\n${error.message}\n\n${error.stack}`);
            setStage('completed');
        }
    };

    return (
        <div className="chat-container">
            <header className="header">
                <img src="\logo.png" alt="임시로고" className="logo-image" />
        </header>
            <header className="chat-header">쿠잇나우</header>
            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.isUser ? 'user' : 'bot'}`}>
                        {!msg.isUser && <div className="circle bot"></div>}
                        <div className="message-bubble">{msg.content}</div>
                    </div>
                ))}
                {debugInfo && (
                    <div className="debug-info">
                        <h4>디버그 정보 (개발자용)</h4>
                        <pre>{debugInfo}</pre>
                        <button onClick={() => {navigator.clipboard.writeText(debugInfo)}}>
                            디버그 정보 복사
                        </button>
                    </div>
                )}
            </div>
            <div className="chat-input-container">
                <input
                    type="text"
                    id="userInput"
                    placeholder="메시지를 입력해주세요."
                    className="chat-input"
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') handleSendMessage();
                    }}
                />
                <button 
                   onClick={handleButtonClick} 
                   className="send-button"
                   style={{
                    backgroundImage: isClicked
                        ? `url('/sending_button_2.png')` // 클릭 시 이미지 교체
                        : `url('/sending_button_1.png')`, // 기본 이미지
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    width: '60px', // 버튼 크기 설정
                    height: '40px',
                    border: 'none',
                    cursor: 'pointer',
                   }}
                   onMouseDown={() => setIsClicked(true)}//클릭 시 이미지 변경
                   onMouseUp={() => setIsClicked(false)}//클릭 해제 시 다시 원상태
                ></button>
            </div>
        </div>
    );
}

export default UserInputScreen;