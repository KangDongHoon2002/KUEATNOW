import os
import difflib
import json
import traceback
import logging
from typing import List, Dict, Any
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from openai import OpenAI
from dotenv import load_dotenv

# 기본 로깅 설정
logging.basicConfig(level=logging.DEBUG, format='[%(levelname)s] %(message)s')

# 앱 환경 변수 로드
current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(current_dir, '.env'))

# React 정적 파일 서빙 설정
app = Flask(__name__, static_folder=os.path.join(current_dir, 'FE', 'build'))
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Firestore 초기화
cred = credentials.Certificate(os.path.join(current_dir, "serviceAccountKey.json"))
firebase_admin.initialize_app(cred)
db = firestore.client()

# OpenAI 클라이언트 설정
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
if not client:
    logging.error("OpenAI API 키를 불러오지 못했습니다.")

# 헬스체크 엔드포인트
@app.route('/api/health', methods=['GET'])
def health_check() -> Any:
    return jsonify({'status': 'OK'}), 200

# React 정적 파일 서빙
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path: str) -> Any:
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# firestore에서 모든 메뉴 가져오기.    
@app.route('/api/all-menus', methods=['GET'])
def get_all_menus():
    try:
        menus_ref = db.collection('menus2')
        docs = menus_ref.stream()
        all_menus = [doc.id for doc in docs]
        return jsonify({'success': True, 'menus': all_menus}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/filter_menus', methods=['POST'])
def filter_menus():
    try:
        data = request.json
        store_type = data.get('store_type')
        max_price = int(data.get('max_price'))
        query = db.collection('menus2')
        docs = query.stream()
        filtered_menus = [
            doc.id for doc in docs
            if doc.to_dict().get('minimum', 0) <= max_price
        ]
        return jsonify({'success': True, 'menu_list': filtered_menus}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
def generate_menu_prompt(conversation: List[Dict[str, str]],
                         menu_list: List[str],
                         store_type: str) -> str:
    prompt = f"""
    사용자와의 대화를 바탕으로, 아래 메뉴 목록 중에서 사용자가 먹고 싶어 할 메뉴 3개를 추천해주세요.

    가능한 메뉴: {', '.join(menu_list)}
    매장 유형: {store_type}

    대화 내용:
    {' '.join([f"{msg['role']}: {msg['content']}" for msg in conversation])}

    추천 시 메뉴명이 정확하지 않더라도 유사한 메뉴를 고려해 주세요.
    이전에 추천되거나 선택된 메뉴는 제외해 주세요.
    """
    return prompt

@app.route('/api/menu-selection', methods=['POST'])
def menu_selection():
    try:
        data = request.json
        menu_list = data.get('menu_list', [])
        excluded_menus = data.get('excluded_menus', [])
        conversation = data.get('conversation', [])
        store_type = data.get('store_type', '')

        print(f"[DEBUG] Available menus: {menu_list}")
        print(f"[DEBUG] Excluded menus: {excluded_menus}")

        prompt = f"""
        사용자와의 대화를 바탕으로, 주어진 메뉴 목록 중 사용자가 가장 먹고싶어 할 메뉴 3개를 찾아내세요.

        가능한 메뉴: {', '.join(menu_list)}
        매장 유형: {store_type}

        대화 내용:
        {' '.join([f"{msg['role']}: {msg['content']}" for msg in conversation])}

        사용자의 응답을 모두 고려하여, 사용자의 선호도에 가장 잘 맞는 메뉴 3개를 쉼표로 구분하여 추천해주세요.
        단, 메뉴명이 정확하지 않더라도 입력값과 유사한 메뉴를 고려해 주세요.
        이전에 추천되거나 선택된 메뉴는 제외하고 새로운 메뉴만 추천해주세요.
        """

        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",
            messages=[
                {"role": "system", "content": "당신은 사용자의 선호도를 정확히 파악하여 가장 적절한 메뉴를 추천하는 AI 어시스턴트입니다."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200
        )

        recommended_menus = response.choices[0].message.content.strip().split(',')
        recommended_menus = [menu.strip() for menu in recommended_menus if menu.strip() in menu_list]

        print(f"[DEBUG] Recommended menus: {recommended_menus}")

        return jsonify({'success': True, 'recommended_menus': recommended_menus}), 200

    except Exception as e:
        print(f"[ERROR] Exception in menu_selection: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


def is_similar(str1: str, str2: str, threshold: float = 0.8) -> bool:
    return difflib.SequenceMatcher(None, str1, str2).ratio() >= threshold

def generate_restaurant_prompt(restaurant_data: List[Dict[str, Any]],
                               selected_menu: str,
                               max_price: int,
                               locations: List[str],
                               user_preferences: str) -> str:
    prompt = f"""
    다음 레스토랑 데이터를 참고하여:
    
    {json.dumps(restaurant_data, ensure_ascii=False, indent=2)}
    
    사용자가 선택한 메뉴: {selected_menu}
    예산: {max_price}원
    선호 지역: {', '.join(locations)}
    추가 선호사항: {user_preferences}
    
    위 정보를 바탕으로 사용자에게 적합한 레스토랑 3곳을 추천하고,
    각 추천에 대해 한 줄 요약을 제공해 주세요.
    형식:
    1. [레스토랑 이름]: [한 줄 요약]
    2. [레스토랑 이름]: [한 줄 요약]
    3. [레스토랑 이름]: [한 줄 요약]
    """
    return prompt

@app.route('/api/recommend-restaurants', methods=['POST'])
def recommend_restaurants() -> Any:
    try:
        data = request.json
        selected_menu = data.get('selected_menu', '').lower().strip()
        max_price = int(data.get('max_price', 0))
        locations = [loc.lower().strip() for loc in data.get('locations', [])]
        user_preferences = data.get('user_preferences', '')
        logging.debug(f"요청 데이터: {data}")

        if not selected_menu or not locations:
            return jsonify({'success': False, 'error': '메뉴와 위치 정보가 필요합니다.'}), 400

        # menu1 컬렉션에서 유사한 메뉴 찾기
        menu_docs = db.collection('menu1').stream()
        restaurant_names = []
        for doc in menu_docs:
            menu_data = doc.to_dict()
            menu_value = menu_data.get('menu_upper', '').lower().strip()
            if is_similar(menu_value, selected_menu) and menu_data.get('maximum', 0) <= max_price:
                names = menu_data.get('name', '')
                restaurant_names.extend([name.strip().lower() for name in names.split(',') if name.strip()])

        logging.debug(f"필터링된 식당 이름: {restaurant_names}")

        # restaurant 컬렉션에서 식당 데이터 가져오기
        restaurant_data = []
        restaurant_docs = db.collection('restaurant').stream()
        for doc in restaurant_docs:
            restaurant_id = doc.id.strip().lower()
            if restaurant_id in restaurant_names:
                restaurant = doc.to_dict()
                restaurant['name'] = restaurant_id
                restaurant_data.append(restaurant)
                logging.debug(f"추가된 식당: {restaurant_id}")

        if not restaurant_data:
            return jsonify({
                'success': False,
                'error': '조건에 맞는 레스토랑을 찾을 수 없습니다. 다른 메뉴나 위치를 시도해보세요.'
            }), 404

        prompt = generate_restaurant_prompt(
            restaurant_data,
            selected_menu,
            max_price,
            locations,
            user_preferences
        )
        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",
            messages=[
                {"role": "system", "content": "당신은 사용자의 선호도를 반영해 레스토랑을 추천하는 전문가입니다."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500
        )
        recommended_restaurants = response.choices[0].message.content.strip()
        logging.debug(f"추천 식당: {recommended_restaurants}")
        formatted = recommended_restaurants.replace('\n', '<br>')
        return jsonify({'success': True, 'recommended_restaurants': formatted}), 200

    except Exception as e:
        logging.error(f"recommend_restaurants 오류: {e}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': f'식당 추천 중 오류 발생: {str(e)}',
            'traceback': traceback.format_exc()
        }), 500

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)
