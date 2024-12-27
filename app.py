import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, firestore
from openai import OpenAI
from dotenv import load_dotenv
import json
import traceback

# 앱의 환경 변수 설정
current_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(current_dir, '.env'))

#React의 정적 파일(html)을 서빙
app = Flask(__name__, static_folder=os.path.join(current_dir, 'FE', 'build'))
CORS(app, resources={r"/api/*": {"origins": "*"}})

#서버에서 firebase database 접근 설정
cred = credentials.Certificate(os.path.join(current_dir, "serviceAccountKey.json"))
firebase_admin.initialize_app(cred)
db = firestore.client()

#React의 정적파일(CSS,이미지,JS같은 추가자원들)서빙
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')
    
#OpenAPI 클라이언트 설정
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

if not client:
    print("OpenAI API 키를 불러오지 못했습니다.")

#firestore에서 모든 메뉴 가져오기.    
@app.route('/api/all-menus', methods=['GET'])
def get_all_menus():
    try:
        # Firestore에서 모든 메뉴 가져오기
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
            if doc.to_dict().get('minimum',0) <= max_price
        ]

        return jsonify({'success': True, 'menu_list': filtered_menus}), 200
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

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
        추천 시 대화에서 언급된 선호도나 특징을 반영하여 일관성 있는 추천을 해주세요.
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

@app.route('/api/recommend-restaurants', methods=['POST'])
def recommend_restaurants():
    try:
        data = request.json
        selected_menu = data.get('selected_menu', '').lower()
        store_type = data.get('store_type', '')
        max_price = int(data.get('max_price', 0))
        locations = [loc.lower() for loc in data.get('locations', [])]
        user_preferences = data.get('user_preferences', '')

        print(f"[DEBUG] Received data: {data}")

        if not selected_menu or not locations:
            return jsonify({'success': False, 'error': '메뉴와 위치 정보가 필요합니다.'}), 400

        # menu1 컬렉션에서 모든 문서를 가져옵니다
        menu_docs = db.collection('menu1').stream()

        restaurant_names = []
        for doc in menu_docs:
            menu_data = doc.to_dict()
            # menu_upper를 strip하고 소문자로 변환하여 비교합니다
            if menu_data.get('menu_upper', '').lower().strip() == selected_menu:
                if menu_data.get('maximum', 0) <= max_price:
                    names = menu_data.get('name', '')
                    # 쉼표로 분리하고 각 이름을 strip한 후 리스트에 추가
                    restaurant_names.extend([name.strip() for name in names.split(',')])

        print(f"[DEBUG] Filtered restaurant names: {restaurant_names}")

        # restaurant 컬렉션에서 식당 정보 필터링
        restaurant_data = []
        restaurant_docs = db.collection('restaurant').stream()

        for doc in restaurant_docs:
            restaurant_id = doc.id.strip()
            if restaurant_id in restaurant_names:
                restaurant = doc.to_dict()
                restaurant['name'] = restaurant_id
                restaurant_data.append(restaurant)
                print(f"[DEBUG] Added restaurant: {restaurant_id}")

        print(f"[DEBUG] Total restaurants found: {len(restaurant_data)}")

        print(f"[DEBUG] Filtered restaurant data: {restaurant_data}")

        if not restaurant_data:
            return jsonify({'success': False, 'error': '조건에 맞는 레스토랑을 찾을 수 없습니다. 다른 메뉴나 위치를 시도해보세요.'}), 404

        prompt = f"""
        다음 레스토랑 데이터를 기반으로:
        
        {json.dumps(restaurant_data, ensure_ascii=False, indent=2)}
        
        사용자가 선택한 메뉴: {selected_menu}
        사용자의 예산: {max_price}원
        사용자가 선호하는 위치들: {', '.join(locations)}
        사용자의 선호사항: {user_preferences}
        
        사용자의 선호도에 가장 잘 맞는 레스토랑 3곳을 추천해주세요. 
        각 레스토랑에 대해 주요 특징을 강조하는 간단한 한 줄 요약을 제공해주세요.
        응답을 다음과 같은 형식으로 작성해주세요:
        
        1. [레스토랑 이름]: [한 줄 요약]
        2. [레스토랑 이름]: [한 줄 요약]
        3. [레스토랑 이름]: [한 줄 요약]

        각 추천은 반드시 새로운 줄에서 시작하도록 해주세요.
        """

        response = client.chat.completions.create(
            model="gpt-4o-2024-08-06",
            messages=[
                {"role": "system", "content": "당신은 사용자의 선호도를 바탕으로 레스토랑을 추천하는 전문 AI 어시스턴트입니다."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500
        )

        recommended_restaurants = response.choices[0].message.content.strip()
        print(f"[DEBUG] Recommended restaurants: {recommended_restaurants}")

        # 줄 바꿈을 HTML <br> 태그로 변환
        formatted_recommendations = recommended_restaurants.replace('\n', '<br>')

        return jsonify({'success': True, 'recommended_restaurants': formatted_recommendations}), 200

    except Exception as e:
        print(f"[ERROR] Exception in recommend_restaurants: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': f'식당 추천 중 오류 발생: {str(e)}', 'traceback': traceback.format_exc()}), 500

if __name__ == '__main__':
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    app.run(debug=debug_mode, host='0.0.0.0', port=5000)