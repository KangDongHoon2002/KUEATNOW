import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';  // CSS 파일을 포함하고 있는지 확인
import App from './App';  // App 컴포넌트 가져오기

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')  // public/index.html 파일의 root div에 렌더링
);
