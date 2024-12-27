import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './UserLimitScreen2.css';
import config from '../../config';

function UserLimitScreen2() {
    const [selectedStore, setSelectedStore] = useState(null);
    const [budget, setBudget] = useState('');
    const navigate = useNavigate();

    //가게 선택 핸들러
    const handleStoreClick = (store) => {
        setSelectedStore(store);
    };

    //예산 입력 핸들러
    const handleBudgetChange = (e) => {
        setBudget(e.target.value);
    };

    //"다음으로" 버튼 클릭 시 UserInputScreen으로 이동
    const handleNextClick = async () => {
        if (selectedStore && parseInt(budget) >= 3000) {
            try {
                const response = await fetch(`${config.apiUrl}/api/filter_menus`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        store_type: selectedStore,
                        max_price: parseInt(budget)
                    }),
                });
                const data = await response.json();
                if (data.success) {
                    navigate('/user-input', { 
                        state: { 
                            menuList: data.menu_list, 
                            selectedStore, 
                            budget 
                        } 
                    });
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                console.error("Error fetching menus:", error);
                alert("메뉴를 가져오는 중 오류가 발생했습니다. 다시 시도해 주세요.");
            }
        } else {
            alert("가게 종류를 선택하고 3000원 이상의 예산을 입력해주세요.");
        }
    };

    return (
        <div className="user-limit-container">
            <header className="header">
                <img src="\logo.png" alt="임시로고" className="logo-image" />
            </header>
            
            <div className="section">
                <h2>가게 종류</h2>
                <p>찾고 있는 가게의 종류에 따라 질문이 달라져요.</p>
                <div className="store-buttons">
                    {['restaurant', 'cafe', 'bar'].map((store) => (
                        <button
                            key={store}
                            className={`store-button ${selectedStore === store ? 'selected' : ''}`}
                            onClick={() => handleStoreClick(store)}
                            style={{
                                backgroundImage: `url(/${store}.png)`, // 여기서 public 폴더의 이미지를 참조
                                backgroundSize: 'contain',
                                backgroundRepeat: 'no-repeat',
                                width: '100px', // 버튼 크기 설정
                                height: '100px',
                                borderRadius: '15px',
                                border: '2px solid lightgray', // 선택된 경우 테두리 색 변경
                                padding: '0',
                            }}
                        > 
                            <span style={{ visibility: 'hidden' }}>{store}</span>{' '}
                            {/* 텍스트 숨김 */}
                        </button>
                    ))}
                </div>
            </div>

            <div className="section">
                <h2>식사 예산</h2>
                <p>다양한 메뉴 추천을 위해<br/>4000원 이상을 입력하는 걸 권장해요.</p>
                <div className="budget-input-container">
                    <input
                        type="number"
                        placeholder="예산을 입력해주세요."
                        value={budget}
                        onChange={handleBudgetChange}
                    />
                    <span>원</span>
                </div>
            </div>

            <button
                className={`user-limit-next-button ${selectedStore && parseInt(budget) >= 3000 ? 'active' : ''}`}
                onClick={handleNextClick}
                disabled={!selectedStore || parseInt(budget) < 3000}
            >
                다음으로
            </button>
        </div>
    );
}

export default UserLimitScreen2;