import React, { useState } from 'react';
import './ExplanationScreen.css';

function ExplanationScreen() {
    // 현재 화면을 표시하기 위한 state
    const [currentStep, setCurrentStep] = useState(1);

    // 각 화면의 내용을 정의하는 함수
    const renderContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="screen-content">
                        <h2>가격, 분류</h2>
                        <p>예산과 분류를 선택해주세요.</p>
                        <div className="content-box">UserLimitScreen<br/>목업</div>
                    </div>
                );
            case 2:
                return (
                    <div className="screen-content">
                        <h2>메뉴 추천</h2>
                        <p>[character_name]와의 대화를 통해 지금 딱 먹고 싶은 음식을 골라보세요!</p>
                        <div className="content-box">UserStandardCheckScreen<br/>목업</div>
                    </div>
                );
            case 3:
                return (
                    <div className="screen-content">
                        <h2>식당 추천</h2>
                        <p>식당들의 리뷰 분석을 통해 취향에 딱 맞는 리스트를 추천드려요 (고려대 지역 한정)</p>
                        <div className="content-box">RegionSelectScreen<br/>목업</div>
                    </div>
                );
            default:
                return null;
        }
    };

    // 다음 화면으로 넘어가는 함수
    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    return (
        <div className="explanation-container">
            {renderContent()}
            <div className="step-indicator">Step indicator</div>
            <button className="next-button" onClick={handleNext}>다음으로</button>
            <button className="skip-button">건너뛰기</button>
        </div>
    );
}

export default ExplanationScreen;
