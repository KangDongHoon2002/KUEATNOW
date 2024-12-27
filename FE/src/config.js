const config = {
  apiUrl: process.env.NODE_ENV === 'production' 
    ? '/api' // 프로덕션 환경에서는 같은 도메인의 /api 경로 사용
    : 'http://localhost:5000' // 개발 환경에서는 백엔드 서버 주소 사용
};

export default config;