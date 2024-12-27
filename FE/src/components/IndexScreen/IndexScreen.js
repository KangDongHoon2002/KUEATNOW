import React from 'react';
import { useNavigate } from 'react-router-dom';
import './IndexScreen.css';

function IndexScreen() {
  const navigate = useNavigate();

  // "시작하기" 버튼 클릭 시 ExplanationScreen1로 이동
  const handleStartClick = () => {
    navigate('/explanation-1'); // ExplanationScreen1로 이동하는 경로 설정
  };

  return (
    <div className="index-container">
      {/* 로고 박스 */}
      <div className="logo-box">
        {/* 호랑이 로고 이미지 */}
        <img src="/logo.png" alt="logo" className="tiger-logo" />
      </div>
      {/* 시작하기 버튼 */}
      <button className="start-button" onClick={handleStartClick}>
        시작하기
      </button>
    </div>
  );
}

export default IndexScreen;
