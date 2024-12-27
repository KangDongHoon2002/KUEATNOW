import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import IndexScreen from './components/IndexScreen/IndexScreen';
import ExplanationScreen1 from './components/ExplanationScreen1/ExplanationScreen1';
import ExplanationScreen2 from './components/ExplanationScreen2/ExplanationScreen2';
import ExplanationScreen3 from './components/ExplanationScreen3/ExplanationScreen3';
import UserInputScreen from './components/UserInputScreen/UserInputScreen';
import UserLimitScreen2 from './components/UserLimitScreen2/UserLimitScreen2';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<IndexScreen />} />
                <Route path="/explanation-1" element={<ExplanationScreen1 />} />
                <Route path="/explanation-2" element={<ExplanationScreen2 />} />
                <Route path="/explanation-3" element={<ExplanationScreen3 />} />
                <Route path="/user-input" element={<UserInputScreen />} />
                <Route path="/user-limit-2" element={<UserLimitScreen2 />} />
            </Routes>
        </Router>
    );
}

export default App;
